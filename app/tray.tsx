'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PLAYER_NAMES } from './game';
import {
  clampTrayX,
  createTrayEngine,
  makeTrayQueue,
  TRAY_CENTER_Y,
  TRAY_DROP_Y,
  TRAY_HALF_WIDTH,
  TRAY_HEIGHT,
  TRAY_ITEMS,
  TRAY_ROTATION_STEP,
  TRAY_SCALE,
  TRAY_WIDTH,
  trayNextPlayer,
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

function drawTray(canvas: HTMLCanvasElement, engine: TrayEngine, pieces: TrayPiece[], ghost: { kind: TrayItemKind; x: number; angle: number } | null) {
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
  context.translate(worldX(0), worldY(TRAY_CENTER_Y));
  context.fillStyle = '#755642';
  context.beginPath();
  context.moveTo(-32, 58);
  context.lineTo(32, 58);
  context.lineTo(8, 7);
  context.lineTo(-8, 7);
  context.closePath();
  context.fill();
  context.fillStyle = '#36281f';
  context.beginPath();
  context.arc(0, 0, 8, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.translate(worldX(0), worldY(TRAY_CENTER_Y));
  context.rotate(-engine.trayAngle);
  const trayWidth = TRAY_HALF_WIDTH * 2 * TRAY_SCALE;
  const trayGradient = context.createLinearGradient(0, -9, 0, 13);
  trayGradient.addColorStop(0, '#f7d89f');
  trayGradient.addColorStop(1, '#a96f40');
  context.fillStyle = trayGradient;
  roundedBox(context, -trayWidth / 2, -7, trayWidth, 15, 7);
  context.fill();
  context.strokeStyle = '#6f472f';
  context.lineWidth = 2;
  context.stroke();
  context.restore();

  for (const piece of pieces) drawItem(context, TRAY_ITEMS[piece.kind], piece.x, piece.y, piece.angle);
  if (ghost) {
    context.save();
    context.setLineDash([5, 5]);
    drawItem(context, TRAY_ITEMS[ghost.kind], ghost.x, TRAY_DROP_Y, ghost.angle, 0.68);
    context.restore();
  }
}

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
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<TrayEngine | null>(null);
  const generationRef = useRef(0);
  const playerRef = useRef(0);
  const playersRef = useRef(2);
  const queueIndexRef = useRef(0);
  const busyRef = useRef(false);
  const stableFramesRef = useRef(0);
  const motionFramesRef = useRef(0);
  const draggingRef = useRef(false);

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
        engine.step(elapsed * (motionFramesRef.current > 34 ? 1.8 : 1));
        motionFramesRef.current += 1;
        stableFramesRef.current = engine.settled() ? stableFramesRef.current + 1 : 0;
        if (engine.failed()) {
          busyRef.current = false;
          setBusy(false);
          setPhase('lost');
        } else if (stableFramesRef.current >= 8 || motionFramesRef.current >= 150) {
          if (motionFramesRef.current >= 150) engine.forceSleep();
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
        const ghost = busyRef.current || phase === 'lost' ? null : { kind: currentKind, x, angle };
        drawTray(canvasRef.current, engine, engine.pieces, ghost);
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [angle, currentKind, phase, x]);

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

  function drop() {
    const engine = engineRef.current;
    if (!engine || busyRef.current || loading || phase !== 'playing') return;
    engine.drop(currentKind, x, angle);
    stableFramesRef.current = 0;
    motionFramesRef.current = 0;
    busyRef.current = true;
    setBusy(true);
  }

  function setXFromPointer(clientX: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || busyRef.current) return;
    const logicalX = ((clientX - rect.left) / rect.width) * TRAY_WIDTH;
    setX(clampTrayX((logicalX - TRAY_WIDTH / 2) / TRAY_SCALE));
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
          <p className="tray-kicker">떨어뜨리면 바로 결제!</p>
          <h2>카페 물건을 올리고<br />균형을 버티세요</h2>
          <p className="tray-intro">좌우 위치와 각도를 정해 떨어뜨립니다.<br />물건 하나라도 떨어뜨린 사람이 집니다.</p>
          <label className="tray-player-select"><span>참여 인원</span><select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
          <button className="tray-primary" onClick={startGame}>게임 시작</button>
          <div className="tray-rules"><span>↔ 위치 조절</span><span>↻ 30° 회전</span><span>↓ 물리 낙하</span></div>
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
            aria-label="중앙 축 위의 균형 쟁반. 화면을 좌우로 끌어 물건 위치를 정할 수 있습니다."
            onPointerDown={(event) => {
              draggingRef.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              setXFromPointer(event.clientX);
            }}
            onPointerMove={(event) => {
              if (draggingRef.current) setXFromPointer(event.clientX);
            }}
            onPointerUp={(event) => {
              draggingRef.current = false;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
          />
          {!busy && <div className="tray-drag-guide">손가락으로 좌우 이동</div>}
        </div>
      </section>

      <section className="tray-controller" aria-label="물체 조작">
        <div className="tray-item-label"><span>이번 물건</span><strong>{TRAY_ITEMS[currentKind].name}</strong><small>{TRAY_ITEMS[currentKind].hint}</small></div>
        <div className="tray-buttons">
          <button aria-label="왼쪽으로 이동" disabled={busy || loading} onClick={() => setX((value) => clampTrayX(value - 0.35))}>←</button>
          <button aria-label="30도 회전" disabled={busy || loading} onClick={() => setAngle((value) => value + TRAY_ROTATION_STEP)}>↻<small>30°</small></button>
          <button aria-label="오른쪽으로 이동" disabled={busy || loading} onClick={() => setX((value) => clampTrayX(value + 0.35))}>→</button>
          <button className="tray-drop" disabled={busy || loading} onClick={drop}>{busy ? '균형 확인 중…' : '떨어뜨리기'}</button>
        </div>
      </section>

      {phase === 'lost' && (
        <div className="tray-result-backdrop">
          <section className="tray-result-card">
            <span aria-hidden="true">💥</span>
            <p>균형이 무너졌습니다</p>
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
