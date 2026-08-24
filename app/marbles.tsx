'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { PLAYER_NAMES } from './game';
import {
  BALL_RADIUS_PX,
  createTower,
  FACE_LABELS,
  losingPlayer,
  PIN_WIDTH_PX,
  PIXELS_PER_UNIT,
  projectPoint,
  TOWER_BOTTOM,
  TOWER_HEIGHT,
  TOWER_RADIUS,
  TOWER_TOP,
  TOWER_WIDTH,
  type Ball,
  type Face,
  type Pin,
  type TowerEngine,
  visibleSegment,
  VIEW_DEPTH_TILT,
  WALL_LEFT,
  WALL_RIGHT,
} from './tower';

type DrawItem =
  | { kind: 'ball'; depth: number; ball: Ball; x: number; y: number }
  | { kind: 'pin'; depth: number; pin: Pin; x1: number; y1: number; x2: number; y2: number };

function drawTower(canvas: HTMLCanvasElement, tower: TowerEngine, face: Face) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== TOWER_WIDTH * ratio || canvas.height !== TOWER_HEIGHT * ratio) {
    canvas.width = TOWER_WIDTH * ratio;
    canvas.height = TOWER_HEIGHT * ratio;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, TOWER_WIDTH, TOWER_HEIGHT);

  const glass = context.createLinearGradient(WALL_LEFT, 0, WALL_RIGHT, 0);
  glass.addColorStop(0, '#ffffff88');
  glass.addColorStop(0.45, '#bce9f025');
  glass.addColorStop(1, '#ffffff78');
  context.fillStyle = glass;
  context.fillRect(WALL_LEFT, 12, WALL_RIGHT - WALL_LEFT, TOWER_HEIGHT - 12);
  const topY = projectPoint({ x: 0, y: TOWER_TOP, z: 0 }, face).y;
  const bottomY = projectPoint({ x: 0, y: TOWER_BOTTOM, z: 0 }, face).y;
  context.fillStyle = '#dff7fa45';
  context.beginPath();
  context.ellipse(TOWER_WIDTH / 2, topY, TOWER_RADIUS * PIXELS_PER_UNIT, TOWER_RADIUS * VIEW_DEPTH_TILT, 0, 0, Math.PI * 2);
  context.fill();

  const items: DrawItem[] = [];
  for (const pin of tower.pins) {
    if (pin.gone) continue;
    const segment = visibleSegment(pin, face);
    items.push({ kind: 'pin', pin, ...segment });
  }
  for (const ball of tower.balls) {
    if (ball.fallen) continue;
    const point = projectPoint(ball, face);
    items.push({ kind: 'ball', ball, ...point });
  }
  items.sort((a, b) => b.depth - a.depth);

  context.lineCap = 'round';
  for (const item of items) {
    const nearness = Math.max(0, Math.min(1, (TOWER_RADIUS - item.depth) / (TOWER_RADIUS * 2)));
    if (item.kind === 'pin') {
      context.globalAlpha = item.pin.face === face
        ? (0.68 + nearness * 0.32) * (1 - item.pin.progress * 0.72)
        : 0.18 + nearness * 0.12;
      context.strokeStyle = '#17384f55';
      context.lineWidth = PIN_WIDTH_PX + 3;
      context.beginPath();
      context.moveTo(item.x1, item.y1 + 3);
      context.lineTo(item.x2, item.y2 + 3);
      context.stroke();
      context.strokeStyle = item.pin.color;
      context.lineWidth = PIN_WIDTH_PX;
      context.beginPath();
      context.moveTo(item.x1, item.y1);
      context.lineTo(item.x2, item.y2);
      context.stroke();
      continue;
    }

    context.globalAlpha = 0.72 + nearness * 0.28;
    context.shadowColor = '#10263a66';
    context.shadowBlur = 2 + nearness * 4;
    context.shadowOffsetY = 2;
    const shine = context.createRadialGradient(
      item.x - BALL_RADIUS_PX * 0.35,
      item.y - BALL_RADIUS_PX * 0.42,
      1,
      item.x,
      item.y,
      BALL_RADIUS_PX,
    );
    shine.addColorStop(0, '#fff');
    shine.addColorStop(0.2, item.ball.color);
    shine.addColorStop(1, '#17384f');
    context.fillStyle = shine;
    context.beginPath();
    context.arc(item.x, item.y, BALL_RADIUS_PX, 0, Math.PI * 2);
    context.fill();
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
  }

  context.globalAlpha = 1;
  context.strokeStyle = '#87c4d67a';
  context.lineWidth = 8;
  context.beginPath();
  context.moveTo(WALL_LEFT, 8);
  context.lineTo(WALL_LEFT, TOWER_HEIGHT);
  context.moveTo(WALL_RIGHT, 8);
  context.lineTo(WALL_RIGHT, TOWER_HEIGHT);
  context.stroke();
  context.strokeStyle = '#ffffff66';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(WALL_LEFT + 5, 12);
  context.lineTo(WALL_LEFT + 5, TOWER_HEIGHT - 8);
  context.moveTo(WALL_RIGHT - 5, 12);
  context.lineTo(WALL_RIGHT - 5, TOWER_HEIGHT - 8);
  context.stroke();
  context.strokeStyle = '#87c4d680';
  context.lineWidth = 3;
  for (const y of [topY, bottomY]) {
    context.beginPath();
    context.ellipse(TOWER_WIDTH / 2, y, TOWER_RADIUS * PIXELS_PER_UNIT, TOWER_RADIUS * VIEW_DEPTH_TILT, 0, 0, Math.PI * 2);
    context.stroke();
  }
}

export default function MarbleGame({ onExit }: { onExit: () => void }) {
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(1);
  const [starter, setStarter] = useState(0);
  const [player, setPlayer] = useState(0);
  const [scores, setScores] = useState([0, 0]);
  const [turn, setTurn] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastFall, setLastFall] = useState<number | null>(null);
  const [loser, setLoser] = useState<number | null>(null);
  const [face, setFace] = useState<Face>(0);
  const [view, setView] = useState<{ balls: Ball[]; pins: Pin[] }>({ balls: [], pins: [] });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const towerRef = useRef<TowerEngine | null>(null);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const loadingRef = useRef(true);
  const playerRef = useRef(0);
  const playersRef = useRef(2);
  const scoresRef = useRef([0, 0]);
  const lastDropRef = useRef([-1, -1]);
  const turnRef = useRef(1);
  const faceRef = useRef<Face>(0);
  const pendingRef = useRef(0);
  const stableFramesRef = useRef(0);
  const motionFramesRef = useRef(0);

  const installTower = useCallback(async (nextPlayers: number, nextRound: number, nextStarter: number) => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    loadingRef.current = true;
    const tower = await createTower(nextPlayers, 31021 + nextRound * 101 + nextPlayers * 17);
    if (generation !== generationRef.current) {
      tower.dispose();
      return;
    }
    towerRef.current?.dispose();
    towerRef.current = tower;
    const nextScores = Array(nextPlayers).fill(0) as number[];
    playersRef.current = nextPlayers;
    playerRef.current = nextStarter;
    scoresRef.current = nextScores;
    lastDropRef.current = Array(nextPlayers).fill(-1);
    turnRef.current = 1;
    faceRef.current = 0;
    busyRef.current = false;
    loadingRef.current = false;
    setPlayers(nextPlayers);
    setRound(nextRound);
    setStarter(nextStarter);
    setPlayer(nextStarter);
    setScores(nextScores);
    setTurn(1);
    setFace(0);
    setBusy(false);
    setLoading(false);
    setLastFall(null);
    setLoser(null);
    setView({ balls: tower.balls, pins: tower.pins });
  }, []);

  useEffect(() => {
    void installTower(2, 1, 0);
    return () => {
      generationRef.current += 1;
      towerRef.current?.dispose();
      towerRef.current = null;
    };
  }, [installTower]);

  useEffect(() => {
    let frameId = 0;
    let previous = performance.now();
    const frame = (now: number) => {
      const elapsed = Math.min(0.034, (now - previous) / 1000);
      previous = now;
      const tower = towerRef.current;
      if (tower && busyRef.current) {
        const dropped = tower.step(elapsed * (motionFramesRef.current > 45 ? 2 : 1));
        if (dropped.length) {
          pendingRef.current += dropped.length;
          const nextScores = [...scoresRef.current];
          nextScores[playerRef.current] += dropped.length;
          scoresRef.current = nextScores;
          lastDropRef.current[playerRef.current] = turnRef.current;
          setScores(nextScores);
        }
        stableFramesRef.current = tower.settled() ? stableFramesRef.current + 1 : 0;
        motionFramesRef.current += 1;
        if (stableFramesRef.current > 10 || motionFramesRef.current > 180) {
          if (motionFramesRef.current > 180) tower.forceSleep();
          busyRef.current = false;
          setBusy(false);
          setLastFall(pendingRef.current);
          setView({ balls: tower.balls, pins: tower.pins });
          const finished = tower.balls.every((ball) => ball.fallen) || tower.pins.every((pin) => pin.gone);
          if (finished) {
            setLoser(losingPlayer(scoresRef.current, lastDropRef.current));
          } else {
            const nextPlayer = (playerRef.current + 1) % playersRef.current;
            playerRef.current = nextPlayer;
            setPlayer(nextPlayer);
            turnRef.current += 1;
            setTurn(turnRef.current);
          }
        }
      }
      if (canvasRef.current && tower) drawTower(canvasRef.current, tower, faceRef.current);
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, []);

  function pullPin(id: number) {
    const tower = towerRef.current;
    if (!tower || busyRef.current || loadingRef.current || loser !== null || !tower.removePin(id)) return;
    pendingRef.current = 0;
    stableFramesRef.current = 0;
    motionFramesRef.current = 0;
    busyRef.current = true;
    setBusy(true);
    setLastFall(null);
    setView({ balls: tower.balls, pins: tower.pins });
  }

  function rotateTower(direction: -1 | 1) {
    if (busyRef.current || loadingRef.current || loser !== null) return;
    const nextFace = ((faceRef.current + direction + 4) % 4) as Face;
    faceRef.current = nextFace;
    setFace(nextFace);
  }

  function restart(nextPlayers = players) {
    if (busyRef.current || loadingRef.current) return;
    const nextRound = round + 1;
    const nextStarter = nextPlayers === players ? (starter + 1) % nextPlayers : 0;
    loadingRef.current = true;
    setLoading(true);
    void installTower(nextPlayers, nextRound, nextStarter);
  }

  const { balls, pins } = view;
  const remaining = balls.filter((ball) => !ball.fallen).length;
  const facePins = pins.filter((pin) => !pin.gone && !pin.removing && pin.face === face);
  const controlsDisabled = busy || loading;

  return (
    <main className="game-shell marble-shell">
      <header className="topbar">
        <div><p className="eyebrow">QUICK MARBLE GAME</p><h1>구슬 타워</h1></div>
        <div className="game-actions">
          <button className="restart-small" disabled={controlsDisabled} onClick={onExit}>게임 선택</button>
          <label className="player-select">
            <span>인원</span>
            <select value={players} disabled={controlsDisabled} onChange={(event) => restart(Number(event.target.value))}>
              {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}
            </select>
          </label>
          <button className="restart-small" disabled={controlsDisabled} onClick={() => restart()}>새 게임</button>
        </div>
      </header>

      <section className="status-card" aria-live="polite">
        <div className={`player-dot player-${player}`} />
        <div>
          <span>{loser === null ? `${PLAYER_NAMES[player]} 차례` : `${PLAYER_NAMES[loser]} 패배`}</span>
          <strong>{loading ? '3D 타워를 조립하고 있습니다' : loser !== null ? '구슬을 가장 많이 모았습니다' : busy ? '구슬이 멈출 때까지 기다리세요' : '타워를 돌려 막대 하나를 빼세요'}</strong>
        </div>
        <div className="move-count"><span>{lastFall === null ? '차례' : '낙하'}</span><b>{lastFall ?? turn}</b></div>
      </section>

      <section className="score-grid" aria-label="플레이어별 떨어진 구슬 수">
        {scores.map((score, index) => (
          <div key={index} className={`score-chip player-border-${index} ${player === index && loser === null ? 'current' : ''}`}>
            <span>{PLAYER_NAMES[index]}</span><b>{score}</b>
          </div>
        ))}
      </section>

      <section className="tower-wrap" aria-label="구슬 낙하 타워">
        <div className="tower-direction" role="group" aria-label="타워 방향 선택">
          <button disabled={controlsDisabled || loser !== null} onClick={() => rotateTower(-1)} aria-label="타워를 왼쪽으로 돌리기">↶</button>
          <div aria-live="polite">
            <span>보고 있는 방향</span>
            <strong>{FACE_LABELS[face]}</strong>
            <small>{loading ? '조립 중' : `${facePins.length}개 선택 가능`}</small>
          </div>
          <button disabled={controlsDisabled || loser !== null} onClick={() => rotateTower(1)} aria-label="타워를 오른쪽으로 돌리기">↷</button>
        </div>
        <div key={face} className={`tower-stage turning ${busy ? 'moving' : ''}`}>
          <canvas ref={canvasRef} width={TOWER_WIDTH} height={TOWER_HEIGHT} role="img" aria-label={`구슬 ${remaining}개가 남은 투명 타워`} />
          {facePins.map((pin) => {
            const point = projectPoint(pin.entry, face);
            return (
              <button
                key={pin.id}
                className="pin-handle"
                style={{
                  '--pin-x': `${(point.x / TOWER_WIDTH) * 100}%`,
                  '--pin-y': `${(point.y / TOWER_HEIGHT) * 100}%`,
                  '--pin-color': pin.color,
                } as CSSProperties}
                disabled={controlsDisabled || loser !== null}
                onClick={() => pullPin(pin.id)}
                aria-label={`${FACE_LABELS[face]} ${pin.id + 1}번 막대 빼기`}
              />
            );
          })}
        </div>
        <p className="rule">타워를 돌려 네 면의 막대를 고르세요. 떨어진 구슬은 현재 플레이어의 벌점입니다.</p>
      </section>

      <footer>
        <span>남은 구슬 <b>{remaining}</b></span>
        <span>남은 막대 <b>{pins.filter((pin) => !pin.gone).length}</b></span>
        <span>라운드 <b>{round}</b></span>
      </footer>

      {loser !== null && (
        <div className="result-backdrop" role="dialog" aria-modal="true" aria-labelledby="marble-result-title">
          <div className="result-card marble-result">
            <span className="result-penguin">🔴</span>
            <p>라운드 종료</p>
            <h2 id="marble-result-title">{PLAYER_NAMES[loser]} 패배</h2>
            <span>{scores.map((score, index) => `${PLAYER_NAMES[index]} ${score}개`).join(' · ')}</span>
            <button autoFocus onClick={() => restart()}>한 판 더</button>
          </div>
        </div>
      )}
    </main>
  );
}
