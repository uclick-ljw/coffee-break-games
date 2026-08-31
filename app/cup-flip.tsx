'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { DODGE_ANIMALS, assignDodgeAnimals, type DodgeAnimal } from './dodge-game';
import { PLAYER_NAMES } from './game';
import {
  CUP_BOTTOM_WIDTH,
  CUP_HEIGHT,
  CUP_TOP_WIDTH,
  FLIP_HEIGHT,
  FLIP_TABLE_Y,
  FLIP_WIDTH,
  cupFlipOutcome,
  launchCupFromGesture,
  makeCupFlipState,
  stepCupFlip,
  type CupFlipOutcome,
  type CupFlipState,
} from './cup-flip-game';

type Phase = 'setup' | 'ready' | 'flying' | 'result' | 'final';
type FlipResult = CupFlipOutcome & { player: number; attempt: number };
type Gesture = { pointerId: number; startX: number; startY: number; currentX: number; currentY: number; startedAt: number };

const PLAYER_COLORS = ['#f26f62', '#55aee8', '#9a77df', '#48b88e', '#e86ea6', '#d7a92e'];

function AnimalPortrait({ animal }: { animal: DodgeAnimal }) {
  return <span className="dodge-animal" role="img" aria-label={animal.name} style={{ '--animal-x': `${animal.column * 100 / 3}%`, '--animal-y': `${animal.row * 100}%` } as CSSProperties} />;
}

function paintAnimal(context: CanvasRenderingContext2D, image: HTMLImageElement | null, animal: DodgeAnimal) {
  context.save();
  context.beginPath();
  context.arc(0, -2, 14, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = animal.color;
  context.fillRect(-15, -17, 30, 31);
  if (image?.complete) {
    const width = image.naturalWidth / 4;
    const height = image.naturalHeight / 2;
    context.drawImage(image, animal.column * width, animal.row * height, width, height, -17, -23, 34, 43);
  }
  context.restore();
  context.strokeStyle = '#fff8e9';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, -2, 15, 0, Math.PI * 2);
  context.stroke();
}

function paintCupBoard(
  canvas: HTMLCanvasElement,
  state: CupFlipState,
  animal: DodgeAnimal,
  image: HTMLImageElement | null,
  color: string,
  gesture: Gesture | null,
) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== FLIP_WIDTH * ratio || canvas.height !== FLIP_HEIGHT * ratio) {
    canvas.width = FLIP_WIDTH * ratio;
    canvas.height = FLIP_HEIGHT * ratio;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const wall = context.createLinearGradient(0, 0, 0, FLIP_HEIGHT);
  wall.addColorStop(0, '#fff8e8');
  wall.addColorStop(0.72, '#f5d8bd');
  wall.addColorStop(1, '#d59a72');
  context.fillStyle = wall;
  context.fillRect(0, 0, FLIP_WIDTH, FLIP_HEIGHT);

  context.globalAlpha = 0.16;
  context.strokeStyle = '#b96f59';
  context.lineWidth = 1;
  for (let x = -FLIP_HEIGHT; x < FLIP_WIDTH + FLIP_HEIGHT; x += 42) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + FLIP_HEIGHT, FLIP_HEIGHT);
    context.stroke();
  }
  context.globalAlpha = 1;

  const altitude = Math.max(0, FLIP_TABLE_Y - CUP_HEIGHT / 2 - state.y);
  const shadowScale = Math.max(0.35, 1 - altitude / 500);
  context.save();
  context.translate(state.x, FLIP_TABLE_Y + 6);
  context.scale(shadowScale, 1);
  context.fillStyle = '#48291f33';
  context.beginPath();
  context.ellipse(0, 0, 38, 8, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.fillStyle = '#8a513c';
  context.fillRect(0, FLIP_TABLE_Y, FLIP_WIDTH, FLIP_HEIGHT - FLIP_TABLE_Y);
  context.fillStyle = '#c88963';
  context.fillRect(0, FLIP_TABLE_Y, FLIP_WIDTH, 12);
  context.fillStyle = '#fff1c9';
  context.fillRect(111, FLIP_TABLE_Y + 2, 168, 5);
  context.fillStyle = '#8a513c';
  context.font = '900 8px Arial';
  context.textAlign = 'center';
  context.fillText('LAND HERE', FLIP_WIDTH / 2, FLIP_TABLE_Y + 9);

  context.save();
  context.translate(state.x, state.y);
  context.rotate(state.angle);
  context.shadowColor = '#5b2b2450';
  context.shadowBlur = 12;
  context.shadowOffsetY = 7;
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(-CUP_TOP_WIDTH / 2, -CUP_HEIGHT / 2);
  context.lineTo(CUP_TOP_WIDTH / 2, -CUP_HEIGHT / 2);
  context.lineTo(CUP_BOTTOM_WIDTH / 2, CUP_HEIGHT / 2);
  context.lineTo(-CUP_BOTTOM_WIDTH / 2, CUP_HEIGHT / 2);
  context.closePath();
  context.fill();
  context.shadowColor = 'transparent';
  context.strokeStyle = '#6e3b38';
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = '#fff8ea';
  context.beginPath();
  context.ellipse(0, -CUP_HEIGHT / 2, CUP_TOP_WIDTH / 2, 6, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = '#713d39';
  context.beginPath();
  context.ellipse(0, -CUP_HEIGHT / 2, CUP_TOP_WIDTH / 2 - 5, 3.2, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#fff4db99';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-CUP_BOTTOM_WIDTH / 2 + 3, CUP_HEIGHT / 2 - 3);
  context.lineTo(CUP_BOTTOM_WIDTH / 2 - 3, CUP_HEIGHT / 2 - 3);
  context.stroke();
  paintAnimal(context, image, animal);
  context.restore();

  if (gesture) {
    const dx = gesture.currentX - gesture.startX;
    const dy = gesture.currentY - gesture.startY;
    const length = Math.hypot(dx, dy);
    if (length > 8) {
      const angle = Math.atan2(dy, dx);
      context.strokeStyle = '#2f356d';
      context.fillStyle = '#2f356d';
      context.lineWidth = 8;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(gesture.startX, gesture.startY);
      context.lineTo(gesture.currentX, gesture.currentY);
      context.stroke();
      context.beginPath();
      context.moveTo(gesture.currentX, gesture.currentY);
      context.lineTo(gesture.currentX - Math.cos(angle - 0.7) * 18, gesture.currentY - Math.sin(angle - 0.7) * 18);
      context.lineTo(gesture.currentX - Math.cos(angle + 0.7) * 18, gesture.currentY - Math.sin(angle + 0.7) * 18);
      context.closePath();
      context.fill();
    }
  }
}

export default function CupFlipGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(0);
  const [player, setPlayer] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [animals, setAnimals] = useState(() => assignDodgeAnimals(2, 5129));
  const [results, setResults] = useState<FlipResult[]>([]);
  const [lastResult, setLastResult] = useState<FlipResult | null>(null);
  const [hint, setHint] = useState('컵을 잡고 위로 빠르게 밀어주세요');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const stateRef = useRef(makeCupFlipState());
  const gestureRef = useRef<Gesture | null>(null);
  const phaseRef = useRef<Phase>('setup');
  const currentAnimal = animals[player] ?? DODGE_ANIMALS[0];

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const paint = useCallback(() => {
    if (!canvasRef.current) return;
    paintCupBoard(canvasRef.current, stateRef.current, currentAnimal, imageRef.current, PLAYER_COLORS[player], gestureRef.current);
  }, [currentAnimal, player]);

  useEffect(() => {
    const image = new Image();
    image.src = '/dodge-animals.jpg';
    image.onload = () => {
      imageRef.current = image;
      paint();
    };
  }, [paint]);

  useEffect(() => {
    if (phase === 'ready') paint();
  }, [paint, phase]);

  const finishFlip = useCallback((outcome: CupFlipOutcome) => {
    if (phaseRef.current !== 'flying') return;
    const result = { ...outcome, player, attempt };
    setLastResult(result);
    setResults((current) => [...current, result]);
    changePhase('result');
  }, [attempt, changePhase, player]);

  useEffect(() => {
    if (phase !== 'flying') return;
    let frameId = 0;
    let previous = performance.now();
    let accumulator = 0;
    const frame = (now: number) => {
      accumulator += Math.min(0.05, (now - previous) / 1000);
      previous = now;
      while (accumulator >= 1 / 180) {
        stepCupFlip(stateRef.current, 1 / 180);
        accumulator -= 1 / 180;
      }
      paint();
      const outcome = cupFlipOutcome(stateRef.current);
      if (outcome) {
        finishFlip(outcome);
        return;
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [finishFlip, paint, phase]);

  function resetCup() {
    stateRef.current = makeCupFlipState();
    gestureRef.current = null;
    setHint('컵을 잡고 위로 빠르게 밀어주세요');
  }

  function startGame() {
    const nextRound = round + 1;
    setRound(nextRound);
    setAnimals(assignDodgeAnimals(players, Date.now() + nextRound * 53));
    setPlayer(0);
    setAttempt(0);
    setResults([]);
    setLastResult(null);
    resetCup();
    changePhase('ready');
  }

  function boardPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * FLIP_WIDTH / bounds.width,
      y: (event.clientY - bounds.top) * FLIP_HEIGHT / bounds.height,
    };
  }

  function grabCup(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (phaseRef.current !== 'ready') return;
    const point = boardPoint(event);
    if (Math.abs(point.x - stateRef.current.x) > 72 || Math.abs(point.y - stateRef.current.y) > 82) {
      setHint('화면 아래의 컵부터 잡아주세요');
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = { pointerId: event.pointerId, startX: point.x, startY: point.y, currentX: point.x, currentY: point.y, startedAt: performance.now() };
    setHint('그대로 위로 밀고 손을 떼세요');
    paint();
  }

  function aimCup(event: ReactPointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = boardPoint(event);
    gesture.currentX = point.x;
    gesture.currentY = point.y;
    paint();
  }

  function releaseCup(event: ReactPointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = boardPoint(event);
    const launched = launchCupFromGesture(
      stateRef.current,
      point.x - gesture.startX,
      point.y - gesture.startY,
      (performance.now() - gesture.startedAt) / 1000,
      (gesture.startX - stateRef.current.x) / (CUP_TOP_WIDTH / 2),
    );
    gestureRef.current = null;
    if (!launched) {
      setHint('조금 더 길게 위로 밀어주세요');
      paint();
      return;
    }
    changePhase('flying');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    if (phaseRef.current !== 'ready' || ![' ', 'ArrowUp', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    launchCupFromGesture(stateRef.current, 0, -125, 0.22);
    changePhase('flying');
  }

  function continueGame() {
    if (attempt === 0) {
      setAttempt(1);
      resetCup();
      changePhase('ready');
      return;
    }
    if (player + 1 < players) {
      setPlayer((current) => current + 1);
      setAttempt(0);
      resetCup();
      changePhase('ready');
      return;
    }
    changePhase('final');
  }

  const totals = Array.from({ length: players }, (_, index) => {
    const playerResults = results.filter((result) => result.player === index);
    return {
      player: index,
      score: playerResults.reduce((sum, result) => sum + result.score, 0),
      upright: playerResults.filter((result) => result.upright).length,
    };
  });
  const ranking = [...totals].sort((a, b) => b.score - a.score || a.player - b.player);
  const payer = ranking[ranking.length - 1];
  const attemptScores = results.filter((result) => result.player === player);

  return (
    <main className="cup-shell">
      <header className="cup-topbar">
        <div><p>ONE SWIPE CUP FLIP</p><h1>뒤집어! 컵</h1></div>
        <button onClick={onExit}>게임 선택</button>
      </header>

      {phase === 'setup' && (
        <section className="cup-setup">
          <div className="cup-hero" aria-hidden="true"><span>🥤</span><AnimalPortrait animal={DODGE_ANIMALS[6]} /></div>
          <p className="cup-kicker">한 번의 스와이프, 한 바퀴의 승부</p>
          <h2>튕기고, 돌리고,<br />바닥으로 세워라</h2>
          <p className="cup-intro">컵을 잡아 위로 빠르게 밀어주세요.<br />두 번의 점수를 합쳐 가장 낮은 사람이 커피 담당!</p>
          <label className="cup-player-select">참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
          <button className="cup-primary" onClick={startGame}>컵 뽑고 시작</button>
          <div className="cup-rules"><span>☝️ 위로 밀기</span><span>🌀 회전 맞추기</span><span>🏆 2회 합산</span></div>
        </section>
      )}

      {(phase === 'ready' || phase === 'flying') && (
        <section className="cup-play">
          <div className="cup-status" style={{ '--cup-color': PLAYER_COLORS[player] } as CSSProperties}>
            <AnimalPortrait animal={currentAnimal} />
            <div><small>{PLAYER_NAMES[player]} 차례</small><strong>{currentAnimal.name} 컵</strong></div>
            <b>{attempt + 1}<small>/ 2회</small></b>
          </div>
          <div className="cup-attempts"><span className={attempt === 0 ? 'active' : ''}>1차 {attemptScores[0] ? `${attemptScores[0].score}점` : ''}</span><span className={attempt === 1 ? 'active' : ''}>2차 {attemptScores[1] ? `${attemptScores[1].score}점` : ''}</span></div>
          <div className={`cup-board ${phase}`}>
            <canvas
              ref={canvasRef}
              tabIndex={0}
              aria-label="컵을 누른 채 위로 빠르게 밀어 뒤집습니다"
              onPointerDown={grabCup}
              onPointerMove={aimCup}
              onPointerUp={releaseCup}
              onPointerCancel={releaseCup}
              onKeyDown={handleKeyDown}
            />
            {phase === 'ready' && <div className="cup-ready-hint"><strong>{hint}</strong><span>시작 위치와 미는 속도가<br />컵의 회전을 바꿉니다</span></div>}
            {phase === 'flying' && <div className="cup-flying-label">착지까지 손 떼기!</div>}
          </div>
          <p className="cup-help">컵 그림을 잡고 위로 밀어 손을 떼세요 · 길고 빠를수록 높이 뜹니다</p>
        </section>
      )}

      {phase === 'result' && lastResult && (
        <section className={`cup-result ${lastResult.upright ? 'upright' : 'fallen'}`}>
          <AnimalPortrait animal={animals[lastResult.player]} />
          <p>{lastResult.upright ? '컵 플립 성공' : '컵 플립 실패'}</p>
          <h2>{lastResult.score}점</h2>
          <strong>{lastResult.reason}</strong>
          <div><span>회전 수 <b>{lastResult.rotations.toFixed(1)}바퀴</b></span><span>중앙 거리 <b>{Math.round(lastResult.centerDistance)}</b></span><span>착지 각도 <b>{Math.round(lastResult.angleError * 180 / Math.PI)}°</b></span></div>
          <button className="cup-primary" onClick={continueGame}>{attempt === 0 ? '두 번째 플립' : player + 1 >= players ? '최종 결과 보기' : '다음 플레이어'}</button>
        </section>
      )}

      {phase === 'final' && payer && (
        <section className="cup-final">
          <div className="cup-payer"><AnimalPortrait animal={animals[payer.player]} /><p>오늘의 커피 담당</p><h2>{PLAYER_NAMES[payer.player]}</h2><strong>{payer.score}점 · 성공 {payer.upright}회</strong></div>
          <ol className="cup-ranking">
            {ranking.map((row, index) => <li key={row.player}><span>{index + 1}</span><AnimalPortrait animal={animals[row.player]} /><div><strong>{PLAYER_NAMES[row.player]}</strong><small>바로 세우기 {row.upright}/2</small></div><b>{row.score}점</b></li>)}
          </ol>
          <button className="cup-primary" onClick={startGame}>다시 뒤집기</button>
          <button className="cup-secondary" onClick={onExit}>게임 선택으로</button>
        </section>
      )}
    </main>
  );
}
