'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { PLAYER_NAMES } from './game';
import {
  DODGE_ANIMALS,
  DODGE_FINGER_OFFSET,
  DODGE_FIRST_SPAWN,
  DODGE_HEIGHT,
  DODGE_MAX_SECONDS,
  DODGE_PLAYER_RADIUS,
  DODGE_WIDTH,
  advanceDodgeObstacle,
  assignDodgeAnimals,
  clampDodgePosition,
  dodgeDifficulty,
  dodgeObstacleGone,
  dodgeObstacleHits,
  makeDodgeObstacle,
  type DodgeAnimal,
  type DodgeObstacle,
} from './dodge-game';

type Phase = 'setup' | 'ready' | 'playing' | 'between' | 'final';
type RunResult = { player: number; milliseconds: number; reason: string };

const PLAYER_COLORS = ['#ff8f6b', '#55b9ee', '#9c7ae6', '#49b88a', '#ef73a6', '#e4b52f'];

function AnimalPortrait({ animal, className = '' }: { animal: DodgeAnimal; className?: string }) {
  return (
    <span
      className={`dodge-animal ${className}`}
      role="img"
      aria-label={animal.name}
      style={{ '--animal-x': `${animal.column * 100 / 3}%`, '--animal-y': `${animal.row * 100}%` } as CSSProperties}
    />
  );
}

function paintAnimal(context: CanvasRenderingContext2D, image: HTMLImageElement | null, animal: DodgeAnimal, x: number, y: number) {
  context.save();
  context.beginPath();
  context.arc(x, y, 27, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = animal.color;
  context.fillRect(x - 28, y - 28, 56, 56);
  if (image?.complete) {
    const cellWidth = image.naturalWidth / 4;
    const cellHeight = image.naturalHeight / 2;
    context.drawImage(image, animal.column * cellWidth, animal.row * cellHeight, cellWidth, cellHeight, x - 31, y - 39, 62, 78);
  }
  context.restore();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x, y, 27, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = '#10263ab8';
  context.lineWidth = 1;
  context.beginPath();
  context.arc(x, y, DODGE_PLAYER_RADIUS, 0, Math.PI * 2);
  context.stroke();
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function paintBoard(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | null,
  animal: DodgeAnimal,
  player: { x: number; y: number },
  obstacles: DodgeObstacle[],
  elapsed: number,
  now: number,
) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== DODGE_WIDTH * ratio || canvas.height !== DODGE_HEIGHT * ratio) {
    canvas.width = DODGE_WIDTH * ratio;
    canvas.height = DODGE_HEIGHT * ratio;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, DODGE_WIDTH, DODGE_HEIGHT);

  const sky = context.createLinearGradient(0, 0, 0, DODGE_HEIGHT);
  sky.addColorStop(0, '#fff9df');
  sky.addColorStop(0.55, '#e5f8f5');
  sky.addColorStop(1, '#cce9e4');
  context.fillStyle = sky;
  context.fillRect(0, 0, DODGE_WIDTH, DODGE_HEIGHT);
  context.fillStyle = '#2a766213';
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      context.beginPath();
      context.arc(30 + column * 68 + (row % 2) * 17, 35 + row * 70, 2.2, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.strokeStyle = '#ffffff9c';
  context.lineWidth = 3;
  roundedRect(context, 9, 9, DODGE_WIDTH - 18, DODGE_HEIGHT - 18, 24);
  context.stroke();

  for (const obstacle of obstacles) {
    if (elapsed < obstacle.activeAt) {
      const pulse = 0.55 + Math.sin(now / 90) * 0.25;
      const cueX = Math.max(18, Math.min(DODGE_WIDTH - 18, obstacle.x));
      const cueY = Math.max(18, Math.min(DODGE_HEIGHT - 18, obstacle.y));
      context.globalAlpha = pulse;
      context.fillStyle = obstacle.color;
      context.beginPath();
      context.arc(cueX, cueY, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.font = '900 13px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('!', cueX, cueY + 1);
      context.globalAlpha = 1;
      continue;
    }

    context.save();
    context.shadowColor = '#183f4b45';
    context.shadowBlur = 10;
    context.shadowOffsetY = 5;
    context.fillStyle = obstacle.color;
    if (obstacle.kind === 'ball') {
      context.beginPath();
      context.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff75';
      context.beginPath();
      context.arc(obstacle.x - obstacle.radius * 0.3, obstacle.y - obstacle.radius * 0.35, obstacle.radius * 0.28, 0, Math.PI * 2);
      context.fill();
    } else {
      roundedRect(context, obstacle.x - obstacle.width / 2, obstacle.y - obstacle.height / 2, obstacle.width, obstacle.height, 9);
      context.fill();
      context.strokeStyle = '#ffffff7d';
      context.lineWidth = 4;
      context.beginPath();
      if (obstacle.width > obstacle.height) {
        context.moveTo(obstacle.x - obstacle.width / 2 + 12, obstacle.y);
        context.lineTo(obstacle.x + obstacle.width / 2 - 12, obstacle.y);
      } else {
        context.moveTo(obstacle.x, obstacle.y - obstacle.height / 2 + 12);
        context.lineTo(obstacle.x, obstacle.y + obstacle.height / 2 - 12);
      }
      context.stroke();
    }
    context.restore();
  }

  context.fillStyle = '#193f4830';
  context.beginPath();
  context.ellipse(player.x, player.y + 28, 22, 7, 0, 0, Math.PI * 2);
  context.fill();
  paintAnimal(context, image, animal, player.x, player.y);
}

function formatTime(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(2)}초`;
}

export default function DodgeGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(1);
  const [animals, setAnimals] = useState(() => assignDodgeAnimals(2, 8712));
  const [player, setPlayer] = useState(0);
  const [results, setResults] = useState<RunResult[]>([]);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
  const [displayTime, setDisplayTime] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const phaseRef = useRef<Phase>('setup');
  const pointerRef = useRef<number | null>(null);
  const playerPositionRef = useRef({ x: DODGE_WIDTH / 2, y: DODGE_HEIGHT - 92 });
  const obstaclesRef = useRef<DodgeObstacle[]>([]);
  const startedAtRef = useRef(0);
  const nextSpawnRef = useRef(DODGE_FIRST_SPAWN);
  const obstacleIdRef = useRef(0);
  const lastDisplayRef = useRef(0);

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    const image = new Image();
    image.src = '/dodge-animals.jpg';
    image.onload = () => {
      imageRef.current = image;
      const canvas = canvasRef.current;
      if (canvas) paintBoard(canvas, image, animals[player] ?? DODGE_ANIMALS[0], playerPositionRef.current, [], 0, performance.now());
    };
  }, [animals, player]);

  const finishRun = useCallback((reason: string, seconds: number) => {
    if (phaseRef.current !== 'playing') return;
    const result = { player, milliseconds: Math.max(1, Math.round(seconds * 1000)), reason };
    pointerRef.current = null;
    setLastResult(result);
    setResults((current) => [...current, result]);
    setDisplayTime(result.milliseconds);
    changePhase('between');
  }, [changePhase, player]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || phase !== 'playing') return;
    let frameId = 0;
    let previous = performance.now();
    const frame = (now: number) => {
      const seconds = Math.min(DODGE_MAX_SECONDS, (now - startedAtRef.current) / 1000);
      const delta = Math.min(0.035, Math.max(0, (now - previous) / 1000));
      previous = now;
      while (seconds >= nextSpawnRef.current) {
        const id = obstacleIdRef.current;
        obstacleIdRef.current += 1;
        obstaclesRef.current.push(makeDodgeObstacle(id, seconds, 19873 + round * 131));
        nextSpawnRef.current += dodgeDifficulty(seconds).spawnInterval;
      }
      for (const obstacle of obstaclesRef.current) {
        if (seconds >= obstacle.activeAt) advanceDodgeObstacle(obstacle, delta);
      }
      obstaclesRef.current = obstaclesRef.current.filter((obstacle) => !dodgeObstacleGone(obstacle));
      const hit = obstaclesRef.current.some((obstacle) => seconds >= obstacle.activeAt
        && dodgeObstacleHits(obstacle, playerPositionRef.current.x, playerPositionRef.current.y));
      paintBoard(canvas, imageRef.current, animals[player], playerPositionRef.current, obstaclesRef.current, seconds, now);
      if (now - lastDisplayRef.current > 80) {
        setDisplayTime(Math.round(seconds * 1000));
        lastDisplayRef.current = now;
      }
      if (hit) {
        finishRun('장애물에 닿았어요', seconds);
        return;
      }
      if (seconds >= DODGE_MAX_SECONDS) {
        finishRun('20초를 완주했어요!', seconds);
        return;
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [animals, finishRun, phase, player, round]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && phase === 'ready') {
      paintBoard(canvas, imageRef.current, animals[player], playerPositionRef.current, [], 0, performance.now());
    }
  }, [animals, phase, player]);

  function startGame() {
    const nextRound = round + 1;
    setRound(nextRound);
    setAnimals(assignDodgeAnimals(players, Date.now() + nextRound * 97));
    setPlayer(0);
    setResults([]);
    setLastResult(null);
    setDisplayTime(0);
    playerPositionRef.current = { x: DODGE_WIDTH / 2, y: DODGE_HEIGHT - 92 };
    changePhase('ready');
  }

  function canvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return clampDodgePosition(
      (event.clientX - bounds.left) * DODGE_WIDTH / bounds.width,
      (event.clientY - bounds.top) * DODGE_HEIGHT / bounds.height - DODGE_FINGER_OFFSET,
    );
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (phaseRef.current !== 'ready') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = event.pointerId;
    playerPositionRef.current = canvasPoint(event);
    obstaclesRef.current = [];
    obstacleIdRef.current = 0;
    nextSpawnRef.current = DODGE_FIRST_SPAWN;
    startedAtRef.current = performance.now();
    lastDisplayRef.current = 0;
    setDisplayTime(0);
    changePhase('playing');
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (phaseRef.current !== 'playing' || pointerRef.current !== event.pointerId) return;
    event.preventDefault();
    playerPositionRef.current = canvasPoint(event);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (phaseRef.current !== 'playing' || pointerRef.current !== event.pointerId) return;
    event.preventDefault();
    finishRun('손을 떼었어요', (performance.now() - startedAtRef.current) / 1000);
  }

  function nextPlayer() {
    if (player + 1 >= players) {
      changePhase('final');
      return;
    }
    setPlayer((current) => current + 1);
    setDisplayTime(0);
    playerPositionRef.current = { x: DODGE_WIDTH / 2, y: DODGE_HEIGHT - 92 };
    changePhase('ready');
  }

  const currentAnimal = animals[player] ?? DODGE_ANIMALS[0];
  const ranking = [...results].sort((a, b) => b.milliseconds - a.milliseconds);
  const payer = ranking[ranking.length - 1];

  return (
    <main className="dodge-shell">
      <header className="dodge-topbar">
        <div><p>HOLD · MOVE · SURVIVE</p><h1>말랑말랑 대탈출</h1></div>
        <button onClick={onExit}>게임 선택</button>
      </header>

      {phase === 'setup' && (
        <section className="dodge-setup">
          <div className="dodge-animal-fan" aria-hidden="true">
            <AnimalPortrait animal={DODGE_ANIMALS[3]} />
            <AnimalPortrait animal={DODGE_ANIMALS[0]} />
            <AnimalPortrait animal={DODGE_ANIMALS[2]} />
          </div>
          <p className="dodge-kicker">한 손가락, 단 한 번의 생존</p>
          <h2>누른 채 피하고<br />가장 오래 살아남으세요</h2>
          <p className="dodge-intro">동물 능력은 모두 같아요. 손을 떼거나 장애물에 닿으면 끝!<br />가장 짧게 버틴 사람이 오늘의 커피 담당입니다.</p>
          <label className="dodge-player-select">
            참가 인원
            <select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>
              {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}
            </select>
          </label>
          <button className="dodge-primary" onClick={startGame}>동물 뽑고 시작</button>
          <div className="dodge-rules"><span>☝️ 누른 채 이동</span><span>⚠️ 닿으면 종료</span><span>🔇 소리 없음</span></div>
        </section>
      )}

      {(phase === 'ready' || phase === 'playing') && (
        <section className="dodge-play">
          <div className="dodge-status" style={{ '--player-color': PLAYER_COLORS[player] } as CSSProperties}>
            <AnimalPortrait animal={currentAnimal} />
            <div><small>{player + 1}번째 도전자</small><strong>{PLAYER_NAMES[player]} · {currentAnimal.name}</strong></div>
            <b>{(displayTime / 1000).toFixed(2)}초</b>
          </div>
          <div className={`dodge-board ${phase}`}>
            <canvas
              ref={canvasRef}
              aria-label={phase === 'ready' ? '누르고 있으면 생존 도전 시작' : '손가락으로 동물을 움직여 장애물을 피하는 게임판'}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            {phase === 'ready' && (
              <div className="dodge-ready-overlay" aria-hidden="true">
                <AnimalPortrait animal={currentAnimal} />
                <strong>{PLAYER_NAMES[player]} 차례</strong>
                <span>게임판을 누르고<br />그대로 움직이세요</span>
                <i>누르는 순간 시작!</i>
              </div>
            )}
          </div>
          <p className="dodge-help">동물은 손가락보다 위에 있어요 · 손을 떼면 기록이 멈춥니다</p>
        </section>
      )}

      {phase === 'between' && lastResult && (
        <section className="dodge-result">
          <AnimalPortrait animal={animals[lastResult.player]} />
          <p>{PLAYER_NAMES[lastResult.player]}의 생존 기록</p>
          <h2>{formatTime(lastResult.milliseconds)}</h2>
          <strong>{lastResult.reason}</strong>
          <button className="dodge-primary" onClick={nextPlayer}>{player + 1 >= players ? '최종 결과 보기' : '다음 사람에게 넘기기'}</button>
          <small>다음 사람은 버튼을 누른 뒤 자기 동물을 확인하세요.</small>
        </section>
      )}

      {phase === 'final' && payer && (
        <section className="dodge-final">
          <div className="dodge-payer">
            <AnimalPortrait animal={animals[payer.player]} />
            <p>오늘의 커피 담당</p>
            <h2>{PLAYER_NAMES[payer.player]}</h2>
            <strong>{formatTime(payer.milliseconds)}</strong>
          </div>
          <ol className="dodge-ranking">
            {ranking.map((result, index) => (
              <li key={result.player}>
                <span>{index + 1}</span>
                <AnimalPortrait animal={animals[result.player]} />
                <div><strong>{PLAYER_NAMES[result.player]}</strong><small>{animals[result.player].name}</small></div>
                <b>{formatTime(result.milliseconds)}</b>
              </li>
            ))}
          </ol>
          <button className="dodge-primary" onClick={startGame}>동물 다시 뽑기</button>
          <button className="dodge-secondary" onClick={onExit}>게임 선택으로</button>
        </section>
      )}
    </main>
  );
}
