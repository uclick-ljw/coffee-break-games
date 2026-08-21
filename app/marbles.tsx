'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PLAYER_NAMES } from './game';
import {
  BALL_RADIUS,
  createTower,
  losingPlayer,
  removePin,
  stepTower,
  TOWER_HEIGHT,
  TOWER_WIDTH,
  towerSettled,
  type Tower,
  visibleSegment,
  WALL_LEFT,
  WALL_RIGHT,
} from './tower';

function drawTower(canvas: HTMLCanvasElement, tower: Tower) {
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
  glass.addColorStop(0, '#ffffffb8');
  glass.addColorStop(0.45, '#bce9f044');
  glass.addColorStop(1, '#ffffffa8');
  context.fillStyle = glass;
  context.fillRect(WALL_LEFT, 12, WALL_RIGHT - WALL_LEFT, TOWER_HEIGHT - 12);

  context.lineCap = 'round';
  for (const pin of tower.pins) {
    if (pin.gone) continue;
    const segment = visibleSegment(pin);
    context.strokeStyle = '#17384f24';
    context.lineWidth = 13;
    context.beginPath();
    context.moveTo(segment.x1, segment.y1 + 4);
    context.lineTo(segment.x2, segment.y2 + 4);
    context.stroke();
    context.strokeStyle = pin.color;
    context.lineWidth = 9;
    context.beginPath();
    context.moveTo(segment.x1, segment.y1);
    context.lineTo(segment.x2, segment.y2);
    context.stroke();
  }

  for (const ball of tower.balls) {
    if (ball.fallen) continue;
    const shine = context.createRadialGradient(ball.x - 4, ball.y - 5, 1, ball.x, ball.y, BALL_RADIUS);
    shine.addColorStop(0, '#fff');
    shine.addColorStop(0.18, ball.color);
    shine.addColorStop(1, '#17384f');
    context.fillStyle = shine;
    context.beginPath();
    context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = '#87c4d6aa';
  context.lineWidth = 11;
  context.beginPath();
  context.moveTo(WALL_LEFT, 8);
  context.lineTo(WALL_LEFT, TOWER_HEIGHT);
  context.moveTo(WALL_RIGHT, 8);
  context.lineTo(WALL_RIGHT, TOWER_HEIGHT);
  context.stroke();
  context.strokeStyle = '#fff9';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(WALL_LEFT + 5, 12);
  context.lineTo(WALL_LEFT + 5, TOWER_HEIGHT - 8);
  context.moveTo(WALL_RIGHT - 5, 12);
  context.lineTo(WALL_RIGHT - 5, TOWER_HEIGHT - 8);
  context.stroke();
}

export default function MarbleGame({ onExit }: { onExit: () => void }) {
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(1);
  const [starter, setStarter] = useState(0);
  const [player, setPlayer] = useState(0);
  const [scores, setScores] = useState([0, 0]);
  const [turn, setTurn] = useState(1);
  const [busy, setBusy] = useState(false);
  const [lastFall, setLastFall] = useState<number | null>(null);
  const [loser, setLoser] = useState<number | null>(null);
  const [, setVersion] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const towerRef = useRef(createTower(2, 31021));
  const busyRef = useRef(false);
  const playerRef = useRef(0);
  const playersRef = useRef(2);
  const scoresRef = useRef([0, 0]);
  const lastDropRef = useRef([-1, -1]);
  const turnRef = useRef(1);
  const pendingRef = useRef(0);
  const stableFramesRef = useRef(0);
  const motionFramesRef = useRef(0);

  useEffect(() => {
    let frameId = 0;
    let previous = performance.now();
    const frame = (now: number) => {
      const elapsed = Math.min(0.034, (now - previous) / 1000);
      previous = now;
      const tower = towerRef.current;
      if (busyRef.current) {
        let fallen = 0;
        for (let step = 0; step < 3; step += 1) fallen += stepTower(tower, elapsed / 3).length;
        if (fallen) {
          pendingRef.current += fallen;
          const nextScores = [...scoresRef.current];
          nextScores[playerRef.current] += fallen;
          scoresRef.current = nextScores;
          lastDropRef.current[playerRef.current] = turnRef.current;
          setScores(nextScores);
        }
        stableFramesRef.current = towerSettled(tower) ? stableFramesRef.current + 1 : 0;
        motionFramesRef.current += 1;
        // ponytail: hard stop only prevents a pathological physics jitter from locking a turn.
        if (stableFramesRef.current > 22 || motionFramesRef.current > 540) {
          for (const ball of tower.balls) {
            if (!ball.fallen && motionFramesRef.current > 540) {
              ball.vx = 0;
              ball.vy = 0;
            }
          }
          busyRef.current = false;
          setBusy(false);
          setLastFall(pendingRef.current);
          setVersion((value) => value + 1);
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
      if (canvasRef.current) drawTower(canvasRef.current, tower);
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, []);

  function pullPin(id: number) {
    if (busyRef.current || loser !== null || !removePin(towerRef.current, id)) return;
    pendingRef.current = 0;
    stableFramesRef.current = 0;
    motionFramesRef.current = 0;
    busyRef.current = true;
    setBusy(true);
    setLastFall(null);
  }

  function restart(nextPlayers = players) {
    if (busyRef.current) return;
    const nextRound = round + 1;
    const nextStarter = nextPlayers === players ? (starter + 1) % nextPlayers : 0;
    const nextScores = Array(nextPlayers).fill(0) as number[];
    towerRef.current = createTower(nextPlayers, 31021 + nextRound * 101 + nextPlayers * 17);
    playersRef.current = nextPlayers;
    playerRef.current = nextStarter;
    scoresRef.current = nextScores;
    lastDropRef.current = Array(nextPlayers).fill(-1);
    turnRef.current = 1;
    setPlayers(nextPlayers);
    setRound(nextRound);
    setStarter(nextStarter);
    setPlayer(nextStarter);
    setScores(nextScores);
    setTurn(1);
    setBusy(false);
    setLastFall(null);
    setLoser(null);
    setVersion((value) => value + 1);
  }

  const remaining = towerRef.current.balls.filter((ball) => !ball.fallen).length;

  return (
    <main className="game-shell marble-shell">
      <header className="topbar">
        <div><p className="eyebrow">QUICK MARBLE GAME</p><h1>구슬 타워</h1></div>
        <div className="game-actions">
          <button className="restart-small" disabled={busy} onClick={onExit}>게임 선택</button>
          <label className="player-select">
            <span>인원</span>
            <select value={players} disabled={busy} onChange={(event) => restart(Number(event.target.value))}>
              {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}
            </select>
          </label>
          <button className="restart-small" disabled={busy} onClick={() => restart()}>새 게임</button>
        </div>
      </header>

      <section className="status-card" aria-live="polite">
        <div className={`player-dot player-${player}`} />
        <div>
          <span>{loser === null ? `${PLAYER_NAMES[player]} 차례` : `${PLAYER_NAMES[loser]} 패배`}</span>
          <strong>{loser !== null ? '구슬을 가장 많이 모았습니다' : busy ? '구슬이 멈출 때까지 기다리세요' : '막대 하나를 빼세요'}</strong>
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
        <div className={`tower-stage ${busy ? 'moving' : ''}`}>
          <canvas ref={canvasRef} width={TOWER_WIDTH} height={TOWER_HEIGHT} role="img" aria-label={`구슬 ${remaining}개가 남은 투명 타워`} />
          {towerRef.current.pins.filter((pin) => !pin.gone && !pin.removing).map((pin) => (
            <button
              key={pin.id}
              className={`pin-handle ${pin.side}`}
              style={{ '--pin-y': `${((pin.y1 + pin.y2) / 2 / TOWER_HEIGHT) * 100}%`, '--pin-color': pin.color } as CSSProperties}
              disabled={busy || loser !== null}
              onClick={() => pullPin(pin.id)}
              aria-label={`${pin.id + 1}번 막대 빼기`}
            />
          ))}
        </div>
        <p className="rule">떨어진 구슬은 현재 플레이어의 벌점입니다. 위험한 막대는 표시되지 않습니다.</p>
      </section>

      <footer>
        <span>남은 구슬 <b>{remaining}</b></span>
        <span>남은 막대 <b>{towerRef.current.pins.filter((pin) => !pin.gone).length}</b></span>
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
