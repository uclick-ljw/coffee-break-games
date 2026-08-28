'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PLAYER_NAMES } from './game';
import {
  clampTrayX,
  createTrayEngine,
  makeTrayQueue,
  TRAY_BASE_Y,
  TRAY_DROP_DRAG,
  TRAY_DROP_Y,
  TRAY_HALF_WIDTH,
  TRAY_HEIGHT,
  TRAY_ITEMS,
  TRAY_ROTATION_STEP,
  TRAY_SCALE,
  TRAY_WIDTH,
  trayNextPlayer,
  trayGestureAction,
  trayTurnReady,
  type TrayEngine,
  type TrayItemDefinition,
  type TrayItemKind,
  type TrayPart,
  type TrayPiece,
} from './tray-game';

const PLAYER_COLORS = ['#41a5df', '#ff8a52', '#9a76e8', '#42b98b', '#ee659f', '#e5bd35'];
const VIEW_Y = 223;

function worldX(value: number) {
  return TRAY_WIDTH / 2 + value * TRAY_SCALE;
}

function worldY(value: number) {
  return VIEW_Y - value * TRAY_SCALE;
}

function roundedBox(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawPart(context: CanvasRenderingContext2D, part: TrayPart) {
  context.fillStyle = part.color;
  context.strokeStyle = '#17304266';
  context.lineWidth = 0.045;
  if (part.kind === 'ball') {
    context.beginPath();
    context.arc(part.x, -part.y, part.radius, 0, Math.PI * 2);
  } else {
    roundedBox(context, part.x - part.halfWidth, -part.y - part.halfHeight, part.halfWidth * 2, part.halfHeight * 2, part.radius ?? 0.03);
  }
  context.fill();
  context.stroke();
}

function drawItem(context: CanvasRenderingContext2D, definition: TrayItemDefinition, x: number, y: number, angle: number, alpha = 1) {
  context.save();
  context.translate(worldX(x), worldY(y));
  context.rotate(-angle);
  context.scale(TRAY_SCALE, TRAY_SCALE);
  context.globalAlpha = alpha;
  context.shadowColor = '#10263a45';
  context.shadowBlur = 0.14;
  context.shadowOffsetY = 0.08;
  for (const part of definition.parts) drawPart(context, part);
  context.shadowColor = 'transparent';

  if (definition.kind === 'macaron') {
    context.strokeStyle = '#fff7';
    context.lineWidth = 0.09;
    context.beginPath();
    context.moveTo(-0.3, 0);
    context.lineTo(0.3, 0);
    context.stroke();
  }
  if (definition.kind === 'cake') {
    context.strokeStyle = '#fff9';
    context.lineWidth = 0.045;
    context.beginPath();
    context.moveTo(-0.68, -0.12);
    context.lineTo(0.68, -0.12);
    context.stroke();
  }
  context.restore();
}

function drawTray(canvas: HTMLCanvasElement, pieces: TrayPiece[], ghost: { kind: TrayItemKind; x: number; y: number; angle: number; held: boolean } | null) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== TRAY_WIDTH * ratio || canvas.height !== TRAY_HEIGHT * ratio) {
    canvas.width = TRAY_WIDTH * ratio;
    canvas.height = TRAY_HEIGHT * ratio;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, TRAY_WIDTH, TRAY_HEIGHT);

  const glow = context.createRadialGradient(TRAY_WIDTH / 2, 260, 20, TRAY_WIDTH / 2, 260, 220);
  glow.addColorStop(0, '#fff5d9');
  glow.addColorStop(1, '#f2e0bc00');
  context.fillStyle = glow;
  context.fillRect(0, 15, TRAY_WIDTH, 410);

  context.save();
  context.translate(worldX(0), worldY(TRAY_BASE_Y));
  const trayWidth = TRAY_HALF_WIDTH * 2 * TRAY_SCALE;
  context.fillStyle = '#6f472f2b';
  roundedBox(context, -trayWidth / 2 + 5, 12, trayWidth - 10, 13, 7);
  context.fill();
  const trayGradient = context.createLinearGradient(0, -9, 0, 15);
  trayGradient.addColorStop(0, '#f7d89f');
  trayGradient.addColorStop(1, '#a96f40');
  context.fillStyle = trayGradient;
  roundedBox(context, -trayWidth / 2, -7, trayWidth, 20, 7);
  context.fill();
  context.strokeStyle = '#6f472f';
  context.lineWidth = 2;
  context.stroke();
  context.restore();

  for (const piece of pieces) drawItem(context, TRAY_ITEMS[piece.kind], piece.x, piece.y, piece.angle);
  if (ghost) {
    drawItem(context, TRAY_ITEMS[ghost.kind], ghost.x, ghost.y, ghost.angle, ghost.held ? 1 : 0.86);
  }
}

type ActiveGesture = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  latestX: number;
};

export default function TrayGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<'setup' | 'playing' | 'lost'>('setup');
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(1);
  const [starter, setStarter] = useState(0);
  const [player, setPlayer] = useState(0);
  const [turn, setTurn] = useState(1);
  const [queue, setQueue] = useState<TrayItemKind[]>(() => makeTrayQueue(49117));
  const [queueIndex, setQueueIndex] = useState(0);
  const [x, setX] = useState(0);
  const [angle, setAngle] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [holding, setHolding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<TrayEngine | null>(null);
  const generationRef = useRef(0);
  const playerRef = useRef(0);
  const playersRef = useRef(2);
  const queueIndexRef = useRef(0);
  const busyRef = useRef(false);
  const stableSecondsRef = useRef(0);
  const motionSecondsRef = useRef(0);
  const gestureRef = useRef<ActiveGesture | null>(null);

  const currentKind = queue[queueIndex] ?? 'cake';
  const nextKind = queue[queueIndex + 1] ?? 'cup';

  const installEngine = useCallback(async (nextPlayers: number, nextRound: number, nextStarter: number) => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setLoading(true);
    const engine = await createTrayEngine();
    if (generation !== generationRef.current) {
      engine.dispose();
      return;
    }
    engineRef.current?.dispose();
    engineRef.current = engine;
    const nextQueue = makeTrayQueue(49117 + nextRound * 127 + nextPlayers * 19);
    playersRef.current = nextPlayers;
    playerRef.current = nextStarter;
    queueIndexRef.current = 0;
    busyRef.current = false;
    setPlayers(nextPlayers);
    setPlayer(nextStarter);
    setQueue(nextQueue);
    setQueueIndex(0);
    setTurn(1);
    setX(0);
    setAngle(0);
    setDragY(0);
    setHolding(false);
    gestureRef.current = null;
    setBusy(false);
    setLoading(false);
    setPhase('playing');
  }, []);

  useEffect(() => () => {
    generationRef.current += 1;
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);

  useEffect(() => {
    let frameId = 0;
    let previous = performance.now();
    const frame = (now: number) => {
      const elapsed = Math.min(0.04, (now - previous) / 1000);
      previous = now;
      const engine = engineRef.current;
      if (engine && busyRef.current) {
        engine.step(elapsed);
        motionSecondsRef.current += elapsed;
        stableSecondsRef.current = engine.settled() ? stableSecondsRef.current + elapsed : 0;
        if (engine.failed()) {
          busyRef.current = false;
          setBusy(false);
          setPhase('lost');
        } else if (trayTurnReady(motionSecondsRef.current, stableSecondsRef.current)) {
          busyRef.current = false;
          setBusy(false);
          const nextPlayer = trayNextPlayer(playerRef.current, playersRef.current);
          playerRef.current = nextPlayer;
          queueIndexRef.current += 1;
          setPlayer(nextPlayer);
          setQueueIndex(queueIndexRef.current);
          setTurn((current) => current + 1);
          setX(0);
          setAngle(0);
        }
      }
      if (engine && canvasRef.current) {
        const ghost = busyRef.current || phase === 'lost' ? null : {
          kind: currentKind,
          x,
          y: TRAY_DROP_Y - Math.min(dragY, 76) / TRAY_SCALE,
          angle,
          held: holding,
        };
        drawTray(canvasRef.current, engine.pieces, ghost);
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [angle, currentKind, dragY, holding, phase, x]);

  function startGame() {
    void installEngine(players, round, starter);
  }

  function restart() {
    const nextRound = round + 1;
    const nextStarter = (starter + 1) % players;
    setRound(nextRound);
    setStarter(nextStarter);
    void installEngine(players, nextRound, nextStarter);
  }

  function drop(dropX = x) {
    const engine = engineRef.current;
    if (!engine || busyRef.current || loading || phase !== 'playing') return;
    engine.drop(currentKind, dropX, angle);
    stableSecondsRef.current = 0;
    motionSecondsRef.current = 0;
    busyRef.current = true;
    setBusy(true);
  }

  function pointerDelta(clientX: number, clientY: number, gesture: ActiveGesture) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - gesture.startClientX) * TRAY_WIDTH / rect.width,
      y: (clientY - gesture.startClientY) * TRAY_HEIGHT / rect.height,
    };
  }

  function beginsOnItem(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const logicalX = (clientX - rect.left) * TRAY_WIDTH / rect.width;
    const logicalY = (clientY - rect.top) * TRAY_HEIGHT / rect.height;
    const item = TRAY_ITEMS[currentKind];
    const hitWidth = Math.max(44, item.width * TRAY_SCALE / 2 + 17);
    const hitHeight = Math.max(44, item.height * TRAY_SCALE / 2 + 17);
    return Math.abs(logicalX - worldX(x)) <= hitWidth
      && Math.abs(logicalY - worldY(TRAY_DROP_Y)) <= hitHeight;
  }

  function finishGesture(pointerId: number, clientX: number, clientY: number) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== pointerId) return;
    const delta = pointerDelta(clientX, clientY, gesture);
    const action = trayGestureAction(delta.x, delta.y);
    gestureRef.current = null;
    setHolding(false);
    setDragY(0);
    if (action === 'rotate') setAngle((value) => value + TRAY_ROTATION_STEP);
    else if (action === 'drop') drop(gesture.latestX);
  }

  if (phase === 'setup') {
    return (
      <main className="tray-shell">
        <header className="tray-topbar">
          <div><p>ONE DEVICE BALANCE GAME</p><h1>아슬아슬 트레이</h1></div>
          <button onClick={onExit}>게임 선택</button>
        </header>
        <section className="tray-setup">
          <div className="tray-hero-art" aria-hidden="true"><span>☕</span><i>🍰</i><b>🥐</b></div>
          <p className="tray-kicker">무너지면 바로 결제!</p>
          <h2>카페 물건을 올리고<br />균형을 버티세요</h2>
          <p className="tray-intro">고정된 바닥 위에 위치와 각도를 정해 쌓습니다.<br />무게중심을 잃고 무너뜨린 사람이 집니다.</p>
          <label className="tray-player-select"><span>참여 인원</span><select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
          <button className="tray-primary" onClick={startGame}>게임 시작</button>
          <div className="tray-rules"><span>↔ 잡고 이동</span><span>↻ 탭해서 회전</span><span>↓ 아래로 놓기</span></div>
        </section>
      </main>
    );
  }

  return (
    <main className="tray-shell tray-playing">
      <header className="tray-topbar">
        <div><p>BALANCE IN PROGRESS</p><h1>아슬아슬 트레이</h1></div>
        <button disabled={busy || loading} onClick={onExit}>게임 선택</button>
      </header>

      <section className="tray-status" style={{ '--tray-player': PLAYER_COLORS[player] } as React.CSSProperties}>
        <i />
        <div><span>{busy ? '흔들리는 중…' : `${turn}번째 물건`}</span><strong>{PLAYER_NAMES[player]} 차례</strong></div>
        <div className="tray-next"><small>다음</small><b>{TRAY_ITEMS[nextKind].name}</b></div>
      </section>

      <section className="tray-board-wrap">
        <div className={`tray-canvas-wrap ${busy ? 'settling' : ''}`}>
          <canvas
            ref={canvasRef}
            role="application"
            tabIndex={0}
            aria-label={`${TRAY_ITEMS[currentKind].name} 조작. 짧게 누르면 30도 회전하고, 잡고 좌우로 움직이면 위치가 바뀌며, 아래로 끌어 놓으면 떨어집니다.`}
            onKeyDown={(event) => {
              if (busy || loading) return;
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                setX((value) => clampTrayX(value + (event.key === 'ArrowLeft' ? -0.3 : 0.3)));
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setAngle((value) => value + TRAY_ROTATION_STEP);
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                drop();
              }
            }}
            onPointerDown={(event) => {
              if (busyRef.current || !beginsOnItem(event.clientX, event.clientY)) return;
              gestureRef.current = {
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startX: x,
                latestX: x,
              };
              setHolding(true);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const gesture = gestureRef.current;
              if (!gesture || gesture.pointerId !== event.pointerId) return;
              const delta = pointerDelta(event.clientX, event.clientY, gesture);
              gesture.latestX = clampTrayX(gesture.startX + delta.x / TRAY_SCALE);
              setX(gesture.latestX);
              setDragY(Math.max(0, delta.y));
            }}
            onPointerUp={(event) => {
              finishGesture(event.pointerId, event.clientX, event.clientY);
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={(event) => {
              gestureRef.current = null;
              setHolding(false);
              setDragY(0);
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
          />
          {holding && <div className={`tray-drop-cue ${dragY >= TRAY_DROP_DRAG ? 'armed' : ''}`}>{dragY >= TRAY_DROP_DRAG ? '손을 떼면 낙하' : '아래로 더 끌어주세요'}</div>}
        </div>
      </section>

      <section className="tray-gesture-panel" aria-label="물체 조작 안내">
        <div className="tray-item-label"><span>이번 물건</span><strong>{TRAY_ITEMS[currentKind].name}</strong><small>{TRAY_ITEMS[currentKind].hint} · {Math.round(angle * 180 / Math.PI) % 360}°</small></div>
        <div className="tray-gesture-help">
          <span><b>톡</b> 회전</span><span><b>↔</b> 위치</span><span><b>↓</b> 낙하</span>
        </div>
      </section>

      {phase === 'lost' && (
        <div className="tray-result-backdrop">
          <section className="tray-result-card">
            <span aria-hidden="true">💥</span>
            <p>쌓기가 무너졌습니다</p>
            <h2>{PLAYER_NAMES[player]} 패배!</h2>
            <small>오늘 커피는 이 사람이 삽니다.</small>
            <button onClick={restart}>한 판 더</button>
            <button className="tray-result-exit" onClick={onExit}>게임 선택</button>
          </section>
        </div>
      )}
    </main>
  );
}
