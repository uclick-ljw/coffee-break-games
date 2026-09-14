'use client';
import { ResultVerdict } from './result-verdict';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { PLAYER_NAMES } from './game';
import { MEASURE_ROUNDS, makeMeasureResult, makeMeasureTargets, makeWaterDrop, pourRate, pourStep, rankMeasureResults, settleFlow, stepWaterDrop, waterDropLanded, waterImpact, waterLevel, waterSurfaceY, type MeasureResult, type WaterDrop } from './measure-game';

type Phase = 'setup' | 'handoff' | 'reveal' | 'pour' | 'settling' | 'result' | 'final';

const PLAYER_COLORS = ['#55e9ff', '#ff728e', '#aa8cff', '#ffd15c', '#67e39a', '#ff9d5c'];
const clock = () => performance.now();
type Splash = { x: number; y: number; life: number; power: number };

function paintWater(canvas: HTMLCanvasElement | null, drops: WaterDrop[], splashes: Splash[]) {
  if (!canvas) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = Math.min(2, devicePixelRatio || 1);
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#9aeeff';
  context.shadowColor = '#4fcfff';
  context.shadowBlur = 9;
  for (const drop of drops) {
    context.beginPath();
    context.ellipse(drop.x * width, drop.y * height, 3.2, 7.5, Math.atan2(drop.vy, drop.vx) - Math.PI / 2, 0, Math.PI * 2);
    context.fill();
  }
  context.lineWidth = 2;
  for (const splash of splashes) {
    const progress = 1 - splash.life / .28;
    context.globalAlpha = Math.max(0, splash.life / .28);
    context.beginPath();
    context.ellipse(splash.x * width, splash.y * height, 4 + progress * (10 + splash.power * 15), 2 + progress * (2 + splash.power * 5), 0, Math.PI, Math.PI * 2);
    context.strokeStyle = '#bff8ff';
    context.stroke();
  }
  context.globalAlpha = 1;
}

export default function MeasureGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(0);
  const [player, setPlayer] = useState(0);
  const [targets, setTargets] = useState(() => makeMeasureTargets(2, 1));
  const [volume, setVolume] = useState(0);
  const [flow, setFlow] = useState(0);
  const [pouring, setPouring] = useState(false);
  const [results, setResults] = useState<MeasureResult[]>([]);
  const volumeRef = useRef(0);
  const flowRef = useRef(0);
  const heldAtRef = useRef(0);
  const lastFrameRef = useRef(0);
  const lockedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<WaterDrop[]>([]);
  const splashesRef = useRef<Splash[]>([]);

  const roundInfo = MEASURE_ROUNDS[round] ?? MEASURE_ROUNDS[0];
  const target = targets[round]?.[player] ?? .5;
  const currentResult = results.at(-1);
  const ranked = useMemo(() => rankMeasureResults(results, players), [players, results]);
  const payer = ranked.at(-1);
  const playerStyle = { '--measure-player': PLAYER_COLORS[player] } as CSSProperties;

  useEffect(() => {
    if (phase !== 'reveal') return;
    const timer = window.setTimeout(() => setPhase('pour'), roundInfo.revealMs);
    return () => window.clearTimeout(timer);
  }, [phase, roundInfo.revealMs]);

  useEffect(() => {
    if ((phase !== 'pour' || !pouring) && phase !== 'settling') return;
    lastFrameRef.current = clock();
    const tick = () => {
      const now = clock();
      const seconds = Math.min(.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;
      if (phase === 'pour' && pouring) flowRef.current = pourRate((now - heldAtRef.current) / 1000, round);
      else flowRef.current = settleFlow(flowRef.current, seconds, round);
      if (phase === 'settling' && flowRef.current < .006) flowRef.current = 0;
      const emitted = flowRef.current * seconds;
      if (emitted > 0) {
        const count = Math.max(1, Math.ceil(flowRef.current / .11));
        for (let index = 0; index < count; index += 1) {
          const drift = Math.sin(now * .017 + index * 2.1) * .012;
          dropsRef.current.push(makeWaterDrop(roundInfo.vessel, emitted / count, drift));
        }
      }
      let landed = 0;
      dropsRef.current = dropsRef.current.flatMap((drop) => {
        const next = stepWaterDrop(roundInfo.vessel, drop, seconds);
        const surfaceVolume = pourStep(volumeRef.current, landed, 1);
        if (waterDropLanded(roundInfo.vessel, next, surfaceVolume)) {
          landed += drop.volume;
          splashesRef.current.push({ x: next.x, y: waterSurfaceY(roundInfo.vessel, surfaceVolume), life: .28, power: waterImpact(roundInfo.vessel, surfaceVolume) });
          return [];
        }
        return next.y < 1.15 && next.x < 1.1 ? [next] : [];
      });
      splashesRef.current = splashesRef.current.map((splash) => ({ ...splash, life: splash.life - seconds })).filter((splash) => splash.life > 0);
      volumeRef.current = pourStep(volumeRef.current, landed, 1);
      setFlow(flowRef.current);
      setVolume(volumeRef.current);
      paintWater(canvasRef.current, dropsRef.current, splashesRef.current);
      if (phase === 'settling' && ((flowRef.current < .006 && dropsRef.current.length === 0) || volumeRef.current >= 1.08)) {
        if (!lockedRef.current) {
          lockedRef.current = true;
          const result = makeMeasureResult(player, round, target, volumeRef.current);
          setResults((current) => [...current, result]);
          setPouring(false);
          setFlow(0);
          setPhase('result');
        }
        return;
      }
    };
    const timer = window.setInterval(tick, 35);
    return () => window.clearInterval(timer);
  }, [phase, player, pouring, round, roundInfo.vessel, target]);

  function resetGlass() {
    volumeRef.current = 0;
    flowRef.current = 0;
    dropsRef.current = [];
    splashesRef.current = [];
    paintWater(canvasRef.current, [], []);
    lockedRef.current = false;
    setVolume(0);
    setFlow(0);
    setPouring(false);
  }

  function startGame() {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    setTargets(makeMeasureTargets(players, seed));
    setRound(0);
    setPlayer(0);
    setResults([]);
    resetGlass();
    setPhase('handoff');
  }

  function beginPour() {
    if (phase !== 'pour' || pouring || volumeRef.current > 0) return;
    heldAtRef.current = clock();
    flowRef.current = pourRate(0, round);
    setPouring(true);
  }

  function stopPour() {
    if (phase !== 'pour' || !pouring) return;
    setPouring(false);
    setPhase('settling');
  }

  function onPourDown(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    beginPour();
  }

  function onPourKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault();
      beginPour();
    }
  }

  function onPourKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      stopPour();
    }
  }

  function nextAttempt() {
    if (player + 1 < players) setPlayer((value) => value + 1);
    else if (round + 1 < MEASURE_ROUNDS.length) {
      setRound((value) => value + 1);
      setPlayer(0);
    } else {
      setPhase('final');
      return;
    }
    resetGlass();
    setPhase('handoff');
  }

  const shownVolume = phase === 'reveal' ? target : volume;
  const level = waterLevel(roundInfo.vessel, shownVolume);
  const targetLevel = waterLevel(roundInfo.vessel, target);
  const guessLevel = waterLevel(roundInfo.vessel, volume);
  const glassStyle = { '--water-level': `${level * 100}%` } as CSSProperties;
  const streamStyle = { '--stream-strength': Math.min(1, flow / .34) } as CSSProperties;

  return (
    <main className="measure-shell pour-game">
      <header className="measure-topbar"><div><p>MEMORIZE · POUR · RELEASE</p><h1>눈금 없이 따라라</h1></div><button onClick={onExit}>게임 선택</button></header>

      {phase === 'setup' && (
        <section className="measure-setup">
          <div className="measure-hero pour-hero" aria-hidden="true"><span>🫗</span><div><i /></div></div>
          <p className="measure-kicker">목표는 잠깐, 물 따르기는 한 번</p>
          <h2>기억한 만큼<br />물을 따라 보세요</h2>
          <p>목표 수위가 사라지면 주전자를 누르고 물을 따르세요.<br />손을 떼도 남은 물줄기는 잠깐 더 떨어집니다.</p>
          <label>참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
          <button className="measure-primary" onClick={startGame}>물 따르기 시작</button>
          <div className="measure-rules"><span>👀 수위 기억</span><span>👇 한 번만 따르기</span><span>💧 잔류 물줄기</span><span>3라운드 합산</span></div>
        </section>
      )}

      {phase === 'handoff' && (
        <section className="measure-handoff">
          <div className="measure-handoff-card" style={playerStyle}>
            <span>🥛</span><small>{round + 1}/3 라운드 · {player + 1}/{players}번째</small><h2>{PLAYER_NAMES[player]} 준비</h2>
            <strong>{roundInfo.name}</strong><p>{roundInfo.hint}.<br />화면을 넘긴 뒤 목표 수위를 확인하세요.</p>
            <button className="measure-primary" onClick={() => setPhase('reveal')}>목표 수위 보기</button>
          </div>
        </section>
      )}

      {(phase === 'reveal' || phase === 'pour' || phase === 'settling' || phase === 'result') && (
        <section className="measure-play" style={playerStyle}>
          <div className="measure-status"><i /><div><small>{PLAYER_NAMES[player]} · {round + 1}/3 라운드</small><strong>{phase === 'reveal' ? '이 수위를 기억하세요' : phase === 'pour' ? pouring ? '물을 따르는 중…' : '주전자를 누르고 유지하세요' : phase === 'settling' ? '남은 물방울이 떨어지는 중…' : '목표 수위와 비교합니다'}</strong></div><b>💧</b></div>
          <div className={`pour-stage ${phase} ${pouring ? 'is-pouring' : ''} ${volume > 1 ? 'overflow' : ''}`}>
            <div className="pour-backdrop" aria-hidden="true"><i /><i /><i /><i /></div>
            <button
              className="pour-control"
              disabled={phase !== 'pour' || (volume > 0 && !pouring)}
              aria-label="누르고 있는 동안 물 따르기"
              onPointerDown={onPourDown}
              onPointerUp={stopPour}
              onPointerCancel={stopPour}
              onKeyDown={onPourKeyDown}
              onKeyUp={onPourKeyUp}
            ><span aria-hidden="true">🫗</span><small>{pouring ? '손을 떼면 멈춤' : '누르고 유지'}</small></button>
            <canvas ref={canvasRef} className="pour-physics" aria-hidden="true" />
            <div className="pour-stream" style={streamStyle} aria-hidden="true"><i /><i /><i /></div>
            <div className={`pour-glass ${roundInfo.vessel}`} style={glassStyle} role="img" aria-label={`${roundInfo.name} 물 수위`}>
              <div className="pour-water"><i /><i /><i /></div><div className="pour-glass-shine" />
              {phase === 'result' && <><span className="pour-target-line" style={{ bottom: `${targetLevel * 100}%` }}>목표</span><span className="pour-guess-line" style={{ bottom: `${guessLevel * 100}%` }}>내 수위</span></>}
            </div>
            {phase === 'reveal' && <div className="pour-memory"><strong>목표 수위</strong><span>곧 사라집니다</span></div>}
            {phase === 'settling' && <div className="pour-settling">톡… 톡…</div>}
            {volume > 1 && <div className="pour-overflow">넘쳤어요!</div>}
          </div>
          {phase === 'result' && currentResult && (
            <div className="measure-result pour-result"><small>부피 오차</small><h2>{(currentResult.error * 100).toFixed(1)}<span>%</span></h2><strong>{currentResult.score}점</strong><button className="measure-primary" onClick={nextAttempt}>{round === 2 && player + 1 === players ? '최종 순위 보기' : player + 1 < players ? '화면 가리고 넘기기' : '다음 잔으로'}</button></div>
          )}
          <div className="measure-progress">{MEASURE_ROUNDS.map((item, index) => <i key={item.vessel} className={index < round ? 'done' : index === round ? 'current' : ''} />)}</div>
        </section>
      )}

      {phase === 'final' && payer && (
        <section className="measure-final"><div className="measure-payer"><span>☕</span><ResultVerdict results={ranked} /><strong>평균 부피 오차 {(payer.error / MEASURE_ROUNDS.length * 100).toFixed(1)}%</strong></div><ol>{ranked.map((entry) => <li key={entry.player}><span>{entry.rank}</span><i style={{ background: PLAYER_COLORS[entry.player] }} /><div><strong>{PLAYER_NAMES[entry.player]}</strong><small>평균 오차 {(entry.error / 3 * 100).toFixed(1)}%</small></div><b>{entry.score}점</b></li>)}</ol><button className="measure-primary" onClick={startGame}>새 물잔으로 한 판 더</button><button className="measure-secondary" onClick={onExit}>게임 선택으로</button></section>
      )}
    </main>
  );
}
