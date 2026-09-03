'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { PLAYER_NAMES } from './game';
import { BALLOON_HOLD_MS, BALLOON_START_LEVEL, balloonTurnGrowth, makeBalloonThreshold, pickBalloonStarter } from './balloon-game';

type Phase = 'setup' | 'handoff' | 'play' | 'burst';

const COLORS = ['#4ceaff', '#ff638d', '#a580ff', '#62e59b', '#ff9ec1', '#ffd15c'];
const clock = () => performance.now();

export default function BalloonGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [player, setPlayer] = useState(0);
  const [level, setLevel] = useState(BALLOON_START_LEVEL);
  const [holding, setHolding] = useState(false);
  const [holdGrowth, setHoldGrowth] = useState(0);
  const thresholdRef = useRef(90);
  const levelRef = useRef(BALLOON_START_LEVEL);
  const holdingRef = useRef(false);
  const holdStartedRef = useRef(0);
  const holdLevelRef = useRef(BALLOON_START_LEVEL);
  const frameRef = useRef(0);

  const risk = level < 60 ? 'calm' : level < 75 ? 'tense' : 'danger';
  const riskLabel = risk === 'calm' ? '아직 여유 있어요' : risk === 'tense' ? '점점 팽팽해집니다' : '언제 터져도 이상하지 않아요';
  const visualProgress = Math.max(0, Math.min(1, (level - BALLOON_START_LEVEL) / (100 - BALLOON_START_LEVEL)));
  const style = {
    '--balloon-player': COLORS[player],
    '--balloon-x': .18 + visualProgress * 1.49,
    '--balloon-y': .38 + visualProgress * 1.34,
    '--balloon-ring': .3 + visualProgress * 1.28,
    '--balloon-progress': visualProgress,
    '--balloon-tilt': `${-8 * (1 - visualProgress)}deg`,
    '--balloon-hue': '0deg',
  } as CSSProperties;
  const freshBalloon = level <= BALLOON_START_LEVEL + .01;
  const previousPlayer = (player + players - 1) % players;

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  function resetBalloon() {
    cancelAnimationFrame(frameRef.current);
    holdingRef.current = false;
    levelRef.current = BALLOON_START_LEVEL;
    thresholdRef.current = makeBalloonThreshold();
    setLevel(BALLOON_START_LEVEL);
    setHolding(false);
    setHoldGrowth(0);
  }

  function startGame() {
    setPlayer(pickBalloonStarter(players));
    resetBalloon();
    setPhase('handoff');
  }

  function settleTurn(activePlayer: number, startLevel: number, elapsedMs: number) {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    cancelAnimationFrame(frameRef.current);
    const growth = balloonTurnGrowth(players, Math.max(180, elapsedMs));
    const nextLevel = startLevel + growth;
    setHolding(false);
    setHoldGrowth(0);
    if (nextLevel >= thresholdRef.current) {
      levelRef.current = thresholdRef.current;
      setLevel(thresholdRef.current);
      setPhase('burst');
      return;
    }
    levelRef.current = nextLevel;
    setLevel(nextLevel);
    setPlayer((activePlayer + 1) % players);
    setPhase('handoff');
  }

  function beginHold() {
    if (phase !== 'play' || holdingRef.current) return;
    const activePlayer = player;
    const startLevel = levelRef.current;
    const started = clock();
    holdingRef.current = true;
    holdStartedRef.current = started;
    holdLevelRef.current = startLevel;
    setHolding(true);
    const tick = (now: number) => {
      if (!holdingRef.current) return;
      const elapsed = now - started;
      const growth = balloonTurnGrowth(players, elapsed);
      const nextLevel = startLevel + growth;
      levelRef.current = nextLevel;
      setLevel(nextLevel);
      setHoldGrowth(Math.min(1, elapsed / BALLOON_HOLD_MS));
      if (nextLevel >= thresholdRef.current || elapsed >= BALLOON_HOLD_MS) {
        settleTurn(activePlayer, startLevel, elapsed);
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  function finishHold() {
    settleTurn(player, holdLevelRef.current, clock() - holdStartedRef.current);
  }

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    beginHold();
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault();
      beginHold();
    }
  }

  function keyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      finishHold();
    }
  }

  return <main className={`balloon-shell risk-${risk}`} style={style}>
    <header className="balloon-topbar"><div><p>HOLD · RISK · PASS</p><h1>터질까 말까</h1></div><button onClick={onExit}>게임 선택</button></header>

    {phase === 'setup' && <section className="balloon-setup">
      <div className="balloon-hero" aria-hidden="true"><span>🎈</span><i /><i /><i /></div>
      <p className="balloon-kicker">누를수록 커지는 위험</p><h2>부풀리고,<br />다음 사람에게 넘겨라</h2>
      <p>하나뿐인 풍선이 언제 터질지는 아무도 모릅니다.<br />첫 바퀴는 안전하고, 터뜨린 사람이 바로 패배합니다.</p>
      <label>참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
      <button className="balloon-primary" onClick={startGame}>풍선 하나 꺼내기</button>
      <div className="balloon-rules"><span>🎲 시작 순서 랜덤</span><span>🛡️ 첫 바퀴 안전</span><span>☕ 터뜨리면 패배</span></div>
    </section>}

    {phase === 'handoff' && <section className="balloon-handoff"><div>
      <div className={`balloon-pass ${freshBalloon ? 'fresh' : ''}`}>{freshBalloon ? <span>새 풍선 · 첫 주자</span> : <><span>{previousPlayer + 1}번 {PLAYER_NAMES[previousPlayer]}</span><b>→</b><span>{player + 1}번 {PLAYER_NAMES[player]}</span></>}</div>
      <span className="balloon-mini" aria-hidden="true"><span>🎈</span></span><small>하나뿐인 풍선</small><p className="balloon-now">현재 참가자</p><h2><b>{player + 1}번</b>{PLAYER_NAMES[player]} 차례</h2>
      <strong>{riskLabel}</strong><p>짧게 눌러 안전하게 넘기거나<br />길게 눌러 다음 사람을 압박하세요.</p>
      <button className="balloon-primary" onClick={() => setPhase('play')}>{player + 1}번 {PLAYER_NAMES[player]}, 시작하기</button>
    </div></section>}

    {phase === 'play' && <section className="balloon-play">
      <div className="balloon-status"><span className="balloon-player-number">{player + 1}</span><div><small>현재 참가자 · 하나뿐인 풍선</small><strong>{PLAYER_NAMES[player]} · {holding ? '손을 떼면 다음 사람 차례' : riskLabel}</strong></div><b>내 차례</b></div>
      <button className={`balloon-stage ${holding ? 'holding' : ''}`} onPointerDown={pointerDown} onPointerUp={finishHold} onPointerCancel={finishHold} onKeyDown={keyDown} onKeyUp={keyUp} onContextMenu={(event) => event.preventDefault()} aria-label="풍선 누르고 부풀리기">
        <div className="balloon-pressure"><span>안전</span><i /><span>팽팽</span><i /><span>위험</span></div>
        <div className="balloon-object" aria-hidden="true"><span>🎈</span><i /><b /></div>
        <div className="balloon-hold-label"><span>이번에 넣는 바람</span><small>{Math.round(holdGrowth * 100)}%</small></div><div className="balloon-hold-meter"><i style={{ width: `${holdGrowth * 100}%` }} /></div>
        <strong>{holding ? `${PLAYER_NAMES[player]}이 누르는 중…` : `${player + 1}번 ${PLAYER_NAMES[player]} · 풍선을 누르세요`}</strong><small>{holding ? '최대가 되면 자동으로 넘깁니다' : '짧게 누르면 조금만 부풀어요'}</small>
      </button>
      <div className="balloon-score-row">{Array.from({ length: players }, (_, index) => <span key={index} className={index === player ? 'current' : ''}><i style={{ background: COLORS[index] }} />{index + 1}번 {PLAYER_NAMES[index]}</span>)}</div>
    </section>}

    {phase === 'burst' && <section className="balloon-burst">
      <div className="balloon-pop" aria-hidden="true"><span>💥</span>{Array.from({ length: 9 }, (_, index) => <i key={index} style={{ '--pop-angle': `${index * 40}deg` } as CSSProperties} />)}</div>
      <p>풍선 폭발 · 게임 종료</p><h2>{player + 1}번 {PLAYER_NAMES[player]} 패배!</h2><strong>오늘 커피 담당입니다</strong>
      <button className="balloon-primary" onClick={startGame}>새 풍선으로 한 판 더</button><button className="balloon-secondary" onClick={onExit}>게임 선택으로</button>
    </section>}
  </main>;
}
