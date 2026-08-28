'use client';

import { lazy, Suspense, useMemo, useRef, useState, type CSSProperties } from 'react';
import { boardRadius, iceSize, makeIce, PLAYER_NAMES, resolveHit, ROULETTE_RESULTS, type Ice, type RouletteResult } from './game';

const MarbleGame = lazy(() => import('./marbles'));
const PegDropGame = lazy(() => import('./pegdrop'));
const LotteryGame = lazy(() => import('./lottery'));
const TimingGame = lazy(() => import('./timing'));
const PerfectCurveGame = lazy(() => import('./circle'));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ROULETTE_LABELS: Record<RouletteResult, string> = {
  blue: '파란 얼음',
  white: '하얀 얼음',
  any: '아무 얼음',
  pass: '차례 통과',
};

type GameMode = 'menu' | 'ice' | 'marbles' | 'pegdrop' | 'lottery' | 'timing' | 'circle';

export default function Home() {
  const [mode, setMode] = useState<GameMode>('menu');
  if (mode === 'ice') return <IceGame onExit={() => setMode('menu')} />;
  if (mode === 'marbles') return (
    <Suspense fallback={<main className="menu-shell"><p className="menu-note">3D 타워를 준비하고 있습니다…</p></main>}>
      <MarbleGame onExit={() => setMode('menu')} />
    </Suspense>
  );
  if (mode === 'pegdrop') return (
    <Suspense fallback={<main className="menu-shell"><p className="menu-note">게임판을 준비하고 있습니다…</p></main>}>
      <PegDropGame onExit={() => setMode('menu')} />
    </Suspense>
  );
  if (mode === 'lottery') return (
    <Suspense fallback={<main className="menu-shell"><p className="menu-note">행운 종이를 섞고 있습니다…</p></main>}>
      <LotteryGame onExit={() => setMode('menu')} />
    </Suspense>
  );
  if (mode === 'timing') return (
    <Suspense fallback={<main className="menu-shell"><p className="menu-note">스톱워치를 맞추고 있습니다…</p></main>}>
      <TimingGame onExit={() => setMode('menu')} />
    </Suspense>
  );
  if (mode === 'circle') return (
    <Suspense fallback={<main className="menu-shell"><p className="menu-note">별빛 캔버스를 펼치고 있습니다…</p></main>}>
      <PerfectCurveGame onExit={() => setMode('menu')} />
    </Suspense>
  );
  return (
    <main className="menu-shell">
      <header className="menu-hero">
        <p className="eyebrow">ONE MINUTE BOARD GAMES</p>
        <h1>커피 한 판</h1>
        <p>2명부터 한 기기로 즐기는 빠른 내기 게임</p>
      </header>
      <section className="game-grid" aria-label="게임 선택">
        <button className="game-card ice-card" onClick={() => setMode('ice')}>
          <span className="game-card-art" aria-hidden="true">🐧</span>
          <small>운과 연쇄 붕괴</small>
          <strong>얼음깨기</strong>
          <p>룰렛 색에 맞춰 얼음을 깨고 펭귄을 지키세요.</p>
          <b>게임 시작</b>
        </button>
        <button className="game-card marble-card" onClick={() => setMode('marbles')}>
          <span className="game-card-art" aria-hidden="true">🔴</span>
          <small>선택과 낙하 물리</small>
          <strong>구슬 타워</strong>
          <p>막대를 빼고 떨어진 구슬을 가장 적게 모으세요.</p>
          <b>게임 시작</b>
        </button>
        <button className="game-card peg-card" onClick={() => setMode('pegdrop')}>
          <span className="game-card-art" aria-hidden="true">🟠</span>
          <small>직접 만든 길과 튕김</small>
          <strong>툭 떨어뜨려</strong>
          <p>돌기를 놓고 구슬을 쏴 가장 높은 점수를 만드세요.</p>
          <b>게임 시작</b>
        </button>
        <button className="game-card lottery-card" onClick={() => setMode('lottery')}>
          <span className="game-card-art" aria-hidden="true">🎫</span>
          <small>선택과 짜릿한 공개</small>
          <strong>긁어봐!</strong>
          <p>스크래치 복권을 직접 긁고 오늘 커피나 밥을 살 사람을 정하세요.</p>
          <b>게임 시작</b>
        </button>
        <button className="game-card timing-card" onClick={() => setMode('timing')}>
          <span className="game-card-art" aria-hidden="true">⏱️</span>
          <small>감각과 순간 판단</small>
          <strong>멈춰!</strong>
          <p>시간을 숨기거나 보면서 목표 초에 가장 가깝게 멈추세요.</p>
          <b>2가지 방식</b>
        </button>
        <button className="game-card circle-card" onClick={() => setMode('circle')}>
          <span className="game-card-art circle-card-art" aria-hidden="true">∿</span>
          <small>다섯 곡선과 손끝 감각</small>
          <strong>완벽한 곡선</strong>
          <p>오늘의 곡선을 기억해 한 번에 그리고 가장 닮은 한 붓에 도전하세요.</p>
          <b>곡선 뽑기</b>
        </button>
      </section>
      <p className="menu-note">설명은 10초, 한 판은 약 1분.</p>
    </main>
  );
}

function initialGame(round: number, players: number) {
  return makeIce(players, 20260821 + round * 97 + players * 13);
}

function IceGame({ onExit }: { onExit: () => void }) {
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(1);
  const [starter, setStarter] = useState(0);
  const [ice, setIce] = useState<Ice[]>(() => initialGame(1, 2));
  const [player, setPlayer] = useState(0);
  const [move, setMove] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loser, setLoser] = useState<number | null>(null);
  const [pulse, setPulse] = useState<string[]>([]);
  const [falling, setFalling] = useState<string[]>([]);
  const [hammer, setHammer] = useState<string | null>(null);
  const [shake, setShake] = useState<'' | 'small' | 'large'>('');
  const [penguinMood, setPenguinMood] = useState<'calm' | 'tense' | 'panic'>('calm');
  const [muted, setMuted] = useState(true);
  const [roulette, setRoulette] = useState<RouletteResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const remaining = useMemo(() => ice.filter((tile) => tile.state === 'solid').length, [ice]);
  const radius = boardRadius(players);
  const completedCycles = Math.floor((move - 1) / players);

  function audioContext() {
    if (muted) return null;
    audioRef.current ??= new AudioContext();
    if (audioRef.current.state === 'suspended') void audioRef.current.resume();
    return audioRef.current;
  }

  function tone(start: number, end: number, duration: number, type: OscillatorType, volume: number) {
    const context = audioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function canHit(tile: Ice) {
    return tile.state === 'solid' && (roulette === 'any' || roulette === tile.color);
  }

  const needsRespin = roulette === 'blue' || roulette === 'white'
    ? !ice.some((tile) => tile.state === 'solid' && tile.color === roulette)
    : false;

  async function spinRoulette() {
    if (busy || spinning || loser !== null || (roulette !== null && !needsRespin)) return;
    setSpinning(true);
    setRoulette(null);
    const random = crypto.getRandomValues(new Uint32Array(1))[0];
    const result = ROULETTE_RESULTS[random % ROULETTE_RESULTS.length];
    const targetAngle = -ROULETTE_RESULTS.indexOf(result) * 90;
    setWheelRotation((current) => current + 1440 + ((targetAngle - current % 360 + 360) % 360));
    await wait(850);
    setRoulette(result);
    if (result === 'pass') {
      await wait(700);
      setPlayer((current) => (current + 1) % players);
      setRoulette(null);
    }
    setSpinning(false);
  }

  async function breakIce(id: string) {
    if (busy || spinning || loser !== null) return;
    if (!ice.some((tile) => tile.id === id && canHit(tile))) return;
    setBusy(true);
    audioContext();
    const { final, steps } = resolveHit(ice, id, move, players);

    setHammer(id);
    setPenguinMood('tense');
    await wait(140);
    tone(150, 70, 0.08, 'square', 0.07);
    setShake('small');
    setFalling([id]);
    setIce((current) => current.map((tile) => tile.id === id ? { ...tile, state: 'gone' } : tile));
    await wait(80);
    setHammer(null);
    setShake('');

    for (const step of steps) {
      setFalling([]);
      setPulse(step.affected);
      setPenguinMood('tense');
      tone(680, 360, 0.08, 'triangle', 0.025);
      await wait(140);
      if (step.falling.length) {
        setPulse([]);
        setFalling(step.falling);
        setShake(step.falling.length >= 4 ? 'large' : 'small');
        setPenguinMood(step.falling.length >= 4 ? 'panic' : 'tense');
        tone(110, 35, 0.18, 'sawtooth', Math.min(0.12, 0.04 + step.falling.length * 0.01));
        setIce((current) => current.map((tile) => step.falling.includes(tile.id) ? { ...tile, state: 'gone' } : tile));
        await wait(140);
        setShake('');
      }
    }

    setIce(final);
    setPulse([]);
    setFalling([]);
    setHammer(null);
    setShake('');
    setPenguinMood('calm');
    const penguinFell = final.find((tile) => tile.id === '0:0')?.state === 'gone';
    setBusy(false);
    if (penguinFell) setLoser(player);
    else {
      setPlayer((current) => (current + 1) % players);
      setMove((current) => current + 1);
      setRoulette(null);
    }
  }

  function restart(nextPlayers = players) {
    if (busy || spinning) return;
    const nextRound = round + 1;
    const nextStarter = nextPlayers === players ? (starter + 1) % nextPlayers : 0;
    setPlayers(nextPlayers);
    setRound(nextRound);
    setStarter(nextStarter);
    setIce(initialGame(nextRound, nextPlayers));
    setPlayer(nextStarter);
    setMove(1);
    setLoser(null);
    setPulse([]);
    setFalling([]);
    setHammer(null);
    setShake('');
    setPenguinMood('calm');
    setRoulette(null);
    setSpinning(false);
    setWheelRotation(0);
  }

  const boardStyle = { '--ice-size': `${iceSize(radius)}%` } as CSSProperties;
  const penguinSize = radius === 2 ? 60 : radius === 3 ? 48 : 38;
  const hammerTarget = ice.find((tile) => tile.id === hammer);
  const instruction = roulette === 'pass' ? '이번 차례는 통과!'
    : spinning ? '룰렛이 돌아갑니다…'
    : roulette === null ? '먼저 룰렛을 돌리세요'
    : needsRespin ? `${ROULETTE_LABELS[roulette]}이 없습니다`
    : `${ROULETTE_LABELS[roulette]}을 고르세요`;

  return (
    <main className="game-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">QUICK ICE GAME</p>
          <h1>얼음 한 판</h1>
        </div>
        <div className="game-actions">
          <button className="restart-small" disabled={busy || spinning} onClick={onExit}>게임 선택</button>
          <label className="player-select">
            <span>인원</span>
            <select value={players} disabled={busy || spinning} onChange={(event) => restart(Number(event.target.value))}>
              <option value={2}>2명</option>
              <option value={3}>3명</option>
              <option value={4}>4명</option>
              <option value={5}>5명</option>
              <option value={6}>6명</option>
            </select>
          </label>
          <button
            className="sound-toggle"
            disabled={busy || spinning}
            aria-label={muted ? '소리 켜기' : '음소거'}
            aria-pressed={muted}
            onClick={() => setMuted((current) => !current)}
          >{muted ? '🔇' : '🔊'}</button>
          <button className="restart-small" disabled={busy || spinning} onClick={() => restart()}>새 게임</button>
        </div>
      </header>

      <section className="status-card" aria-live="polite">
        <div className={`player-dot player-${player}`} />
        <div>
          <span>{loser === null ? `${PLAYER_NAMES[player]} 차례` : `${PLAYER_NAMES[loser]} 패배`}</span>
          <strong>{loser === null ? (busy ? '충격이 퍼집니다…' : instruction) : '펭귄이 빠졌습니다!'}</strong>
        </div>
        <div className="move-count"><span>타격</span><b>{move}</b></div>
      </section>

      <section className="roulette-panel" aria-label="타격 룰렛">
        <div className="wheel-shell">
          <i className="wheel-pointer" />
          <div className="roulette-wheel" style={{ transform: `rotate(${wheelRotation}deg)` }}>
            <span>파랑</span><span>하양</span><span>자유</span><span>통과</span>
          </div>
        </div>
        <div className="roulette-action">
          <b>{roulette ? ROULETTE_LABELS[roulette] : '오늘의 운명'}</b>
          <button onClick={spinRoulette} disabled={busy || spinning || loser !== null || (roulette !== null && !needsRespin)}>
            {roulette === 'pass' ? '차례 통과' : spinning ? '도는 중…' : needsRespin ? '다시 돌리기' : '룰렛 돌리기'}
          </button>
        </div>
      </section>

      <section className="board-wrap" aria-label={`${players}인용 얼음 게임판`}>
        <div className="cold-meter" aria-label={`한기 단계 ${Math.min(3, Math.floor(completedCycles / 2) + 1)}`}>
          <i style={{ width: `${Math.min(100, 25 + completedCycles * 15)}%` }} />
        </div>
        <div className={`board board-${players} ${shake ? `shake-${shake}` : ''}`} style={boardStyle}>
          <div className="water-ripple" />
          {ice.map((tile) => (
            <button
              key={tile.id}
              className={`ice ${tile.color} ${tile.state} ${roulette && !canHit(tile) ? 'unavailable' : ''} ${pulse.includes(tile.id) ? 'pulse' : ''} ${falling.includes(tile.id) ? 'falling' : ''}`}
              style={{ left: `${tile.x}%`, top: `${tile.y}%` }}
              onClick={() => breakIce(tile.id)}
              disabled={busy || spinning || loser !== null || !canHit(tile)}
              aria-label={`${tile.color === 'blue' ? '파란' : '하얀'} ${tile.id === '0:0' ? '펭귄이 있는 얼음' : '얼음'}`}
            />
          ))}
          {hammerTarget && (
            <span className="hammer" style={{ left: `${hammerTarget.x}%`, top: `${hammerTarget.y}%` }} aria-hidden="true">🔨</span>
          )}
          <div
            className={`penguin ${ice.find((tile) => tile.id === '0:0')?.state === 'gone' ? 'dropped' : penguinMood}`}
            style={{ fontSize: `${penguinSize}px` }}
            aria-label="펭귄"
          >🐧</div>
        </div>
        <p className="rule">룰렛이 정한 색만 깨세요. 균열은 타격 전까지 보이지 않습니다.</p>
      </section>

      <footer>
        <span>남은 얼음 <b>{remaining}</b></span>
        <span>한기 <b>{completedCycles + 1}</b></span>
        <span>라운드 <b>{round}</b></span>
      </footer>

      {loser !== null && (
        <div className="result-backdrop" role="dialog" aria-modal="true" aria-labelledby="result-title">
          <div className="result-card">
            <span className="result-penguin">🐧</span>
            <p>라운드 종료</p>
            <h2 id="result-title">{PLAYER_NAMES[loser]} 패배</h2>
            <span>{move}번의 타격으로 끝났어요.</span>
            <button autoFocus onClick={() => restart()}>한 판 더</button>
          </div>
        </div>
      )}
    </main>
  );
}
