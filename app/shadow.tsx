'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { PLAYER_NAMES } from './game';
import { buildShadowFaces, makeShadowChallenges, rankShadowResults, shadowSimilarity, type ShadowChallenge, type ShadowResult } from './shadow-game';

type Phase = 'setup' | 'ready' | 'play' | 'result' | 'final';
type Angles = { yaw: number; pitch: number };

const WIDTH = 390;
const HEIGHT = 430;
const SCALE = 105;
const ROUND_SECONDS = 8;
const PLAYER_COLORS = ['#7e6df2', '#f07675', '#4fc3ad', '#e3ae42', '#db70bd', '#5ca9ef'];

function facePath(context: CanvasRenderingContext2D, points: { x: number; y: number }[]) {
  context.beginPath();
  context.moveTo(WIDTH / 2 + points[0].x * SCALE, HEIGHT / 2 - points[0].y * SCALE);
  for (const point of points.slice(1)) context.lineTo(WIDTH / 2 + point.x * SCALE, HEIGHT / 2 - point.y * SCALE);
  context.closePath();
}

function drawModel(context: CanvasRenderingContext2D, challenge: ShadowChallenge, yaw: number, pitch: number, ghost: boolean) {
  const faces = buildShadowFaces(challenge.model, yaw, pitch);
  context.save();
  if (ghost) {
    context.globalAlpha = .58;
    context.fillStyle = '#090610';
    context.shadowColor = '#bd9cffaa';
    context.shadowBlur = 15;
    for (const face of faces) {
      facePath(context, face.points);
      context.fill();
    }
  } else {
    context.globalAlpha = .94;
    context.lineJoin = 'round';
    for (const face of faces) {
      facePath(context, face.points);
      context.fillStyle = `hsl(${challenge.model.hue} 72% ${27 + face.light * 37}%)`;
      context.fill();
      context.strokeStyle = `hsla(${challenge.model.hue} 90% 92% / .24)`;
      context.lineWidth = 1.2;
      context.stroke();
    }
  }
  context.restore();
}

function paintStage(canvas: HTMLCanvasElement, challenge: ShadowChallenge, angles: Angles, score: number | null) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== WIDTH * ratio || canvas.height !== HEIGHT * ratio) {
    canvas.width = WIDTH * ratio;
    canvas.height = HEIGHT * ratio;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const background = context.createRadialGradient(WIDTH * .48, HEIGHT * .42, 8, WIDTH / 2, HEIGHT / 2, 300);
  background.addColorStop(0, '#32285a');
  background.addColorStop(.55, '#15152e');
  background.addColorStop(1, '#080914');
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.strokeStyle = '#b9a8ff12';
  context.lineWidth = 1;
  for (let y = 40; y < HEIGHT; y += 42) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WIDTH, y + 18);
    context.stroke();
  }
  context.beginPath();
  context.ellipse(WIDTH / 2, HEIGHT * .78, 116, 27, 0, 0, Math.PI * 2);
  context.fillStyle = '#05060ca0';
  context.shadowColor = '#000';
  context.shadowBlur = 24;
  context.fill();
  context.shadowColor = 'transparent';

  drawModel(context, challenge, challenge.targetYaw, challenge.targetPitch, true);
  drawModel(context, challenge, angles.yaw, angles.pitch, false);

  context.textAlign = 'center';
  context.font = '800 10px Arial';
  context.fillStyle = '#d6caff';
  context.fillText(score === null ? '검은 그림자가 목표 각도입니다' : `그림자 일치율 ${(score / 10).toFixed(1)}%`, WIDTH / 2, HEIGHT - 18);
}

export default function ShadowGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(0);
  const [turn, setTurn] = useState(0);
  const [challenges, setChallenges] = useState(() => makeShadowChallenges(2, 6421));
  const [results, setResults] = useState<ShadowResult[]>([]);
  const [lastResult, setLastResult] = useState<ShadowResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const anglesRef = useRef<Angles>({ yaw: challenges[0].startYaw, pitch: challenges[0].startPitch });
  const dragRef = useRef<{ pointer: number; x: number; y: number } | null>(null);
  const startedAtRef = useRef(0);
  const lockedRef = useRef(false);
  const currentChallenge = challenges[turn] ?? challenges[0];
  const ranked = useMemo(() => rankShadowResults(results), [results]);
  const payer = ranked.at(-1);

  useEffect(() => {
    if (canvasRef.current && currentChallenge) paintStage(canvasRef.current, currentChallenge, anglesRef.current, phase === 'result' ? lastResult?.score ?? null : null);
  }, [currentChallenge, lastResult, phase]);

  const finishTurn = useCallback(() => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    const score = shadowSimilarity(currentChallenge.model, currentChallenge.targetYaw, currentChallenge.targetPitch, anglesRef.current.yaw, anglesRef.current.pitch);
    const result: ShadowResult = {
      player: turn,
      modelName: currentChallenge.model.name,
      score,
      elapsed: Math.min(ROUND_SECONDS, (performance.now() - startedAtRef.current) / 1000),
      yaw: anglesRef.current.yaw,
      pitch: anglesRef.current.pitch,
    };
    setLastResult(result);
    setResults((current) => [...current, result]);
    setPhase('result');
  }, [currentChallenge, turn]);

  useEffect(() => {
    if (phase !== 'play') return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, ROUND_SECONDS - (performance.now() - startedAtRef.current) / 1000);
      setTimeLeft(remaining);
      if (remaining === 0) finishTurn();
    }, 50);
    return () => window.clearInterval(timer);
  }, [finishTurn, phase]);

  function startGame() {
    const nextRound = round + 1;
    const seed = Date.now() + nextRound * 131;
    const nextChallenges = makeShadowChallenges(players, seed);
    setRound(nextRound);
    setTurn(0);
    setChallenges(nextChallenges);
    setResults([]);
    setLastResult(null);
    setTimeLeft(ROUND_SECONDS);
    anglesRef.current = { yaw: nextChallenges[0].startYaw, pitch: nextChallenges[0].startPitch };
    lockedRef.current = false;
    setPhase('ready');
  }

  function beginTurn() {
    anglesRef.current = { yaw: currentChallenge.startYaw, pitch: currentChallenge.startPitch };
    startedAtRef.current = performance.now();
    lockedRef.current = false;
    setTimeLeft(ROUND_SECONDS);
    setPhase('play');
    window.requestAnimationFrame(() => paintStage(canvasRef.current!, currentChallenge, anglesRef.current, null));
  }

  function startDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (phase !== 'play' || dragRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY };
    setDragging(true);
  }

  function moveDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointer !== event.pointerId || phase !== 'play') return;
    event.preventDefault();
    anglesRef.current.yaw += (event.clientX - drag.x) * .015;
    anglesRef.current.pitch = Math.max(-1.2, Math.min(1.2, anglesRef.current.pitch + (event.clientY - drag.y) * .012));
    drag.x = event.clientX;
    drag.y = event.clientY;
    paintStage(event.currentTarget, currentChallenge, anglesRef.current, null);
  }

  function endDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointer !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }

  function nextPlayer() {
    if (turn + 1 >= players) {
      setPhase('final');
      return;
    }
    const nextTurn = turn + 1;
    const nextChallenge = challenges[nextTurn];
    setTurn(nextTurn);
    setLastResult(null);
    setTimeLeft(ROUND_SECONDS);
    anglesRef.current = { yaw: nextChallenge.startYaw, pitch: nextChallenge.startPitch };
    lockedRef.current = false;
    setPhase('ready');
  }

  return (
    <main className="shadow-shell">
      <header className="shadow-topbar">
        <div><p>ROTATE · STEAL THE SHADOW</p><h1>그림자 도둑</h1></div>
        <button onClick={onExit}>게임 선택</button>
      </header>

      {phase === 'setup' && (
        <section className="shadow-setup">
          <div className="shadow-emblem" aria-hidden="true"><i>◆</i><span>◆</span></div>
          <p className="shadow-kicker">검은 실루엣이 정답</p>
          <h2>돌리고, 겹치고,<br />그림자를 훔쳐라</h2>
          <p>입체 조형물을 손가락으로 돌려 목표 그림자와 맞추세요.<br />가장 닮지 못한 사람이 오늘 커피 담당입니다.</p>
          <label className="shadow-player-select">참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
          <button className="shadow-primary" onClick={startGame}>오늘의 조형물 열기</button>
          <div className="shadow-rules"><span>☝️ 드래그 회전</span><span>👤 그림자 겹치기</span><span>⏱️ 8초 승부</span></div>
        </section>
      )}

      {(phase === 'ready' || phase === 'play' || phase === 'result') && (
        <section className="shadow-play" style={{ '--shadow-player': PLAYER_COLORS[turn] } as CSSProperties}>
          <div className="shadow-status"><i /><div><small>{PLAYER_NAMES[turn]} 차례 · {turn + 1}/{players}</small><strong>{currentChallenge.model.name}</strong></div><b>{phase === 'play' ? timeLeft.toFixed(1) : phase === 'result' ? lastResult?.elapsed.toFixed(1) : '8.0'}<small>초</small></b></div>
          <div className={`shadow-stage ${dragging ? 'dragging' : ''}`}>
            <canvas
              ref={canvasRef}
              aria-label={`${currentChallenge.model.name} 그림자 맞추기 영역`}
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onContextMenu={(event) => event.preventDefault()}
            />
            {phase === 'ready' && <div className="shadow-ready"><span>◆</span><strong>{PLAYER_NAMES[turn]} 준비</strong><p>목표 각도는 시작과 동시에 공개됩니다</p><button onClick={beginTurn}>8초 시작</button></div>}
          </div>
          {phase === 'play' && <div className="shadow-controls"><div className="shadow-timer"><i style={{ width: `${timeLeft / ROUND_SECONDS * 100}%` }} /></div><p>물체를 직접 밀어 검은 그림자에 겹치세요</p><button onClick={finishTurn}>이 각도로 잠금</button></div>}
          {phase === 'result' && lastResult && <div className="shadow-result"><p>{lastResult.score >= 900 ? '완벽한 위장!' : lastResult.score >= 760 ? '거의 훔쳤어요' : '그림자가 아직 보여요'}</p><h2>{(lastResult.score / 10).toFixed(1)}<small>%</small></h2><strong>{lastResult.elapsed.toFixed(1)}초 만에 잠금</strong><button className="shadow-primary" onClick={nextPlayer}>{turn + 1 >= players ? '최종 결과 보기' : '다음 사람에게 넘기기'}</button></div>}
        </section>
      )}

      {phase === 'final' && payer && (
        <section className="shadow-final">
          <div className="shadow-payer"><span>☕</span><p>오늘의 커피 담당</p><h2>{PLAYER_NAMES[payer.player]}</h2><strong>그림자 일치율 {(payer.score / 10).toFixed(1)}%</strong></div>
          <ol>{ranked.map((result, index) => <li key={result.player}><span>{index + 1}</span><i style={{ background: PLAYER_COLORS[result.player] }} /><div><strong>{PLAYER_NAMES[result.player]}</strong><small>{result.modelName} · {result.elapsed.toFixed(1)}초</small></div><b>{(result.score / 10).toFixed(1)}%</b></li>)}</ol>
          <button className="shadow-primary" onClick={startGame}>새 조형물로 한 판 더</button>
          <button className="shadow-secondary" onClick={onExit}>게임 선택으로</button>
        </section>
      )}
    </main>
  );
}
