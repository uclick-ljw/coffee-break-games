'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { DODGE_ANIMALS, assignDodgeAnimals, type DodgeAnimal } from './dodge-game';
import { PLAYER_NAMES } from './game';
import {
  PARKING_CAR_LENGTH,
  PARKING_CAR_WIDTH,
  PARKING_HEIGHT,
  PARKING_WIDTH,
  makeParkingCourse,
  makeParkingState,
  parkingOutcome,
  parkingSlotX,
  stepParking,
  type ParkingCourse,
  type ParkingOutcome,
  type ParkingState,
} from './parking-game';

type Phase = 'setup' | 'ready' | 'driving' | 'result' | 'final';
type ParkingResult = ParkingOutcome & { player: number };
type PointerDrive = { id: number; startX: number };

const PLAYER_COLORS = ['#ef654d', '#48a9e8', '#8d71db', '#3cb483', '#df6298', '#d1a52b'];
const PARKED_COLORS = ['#f4b942', '#4a80ad', '#dc765f'];

function AnimalPortrait({ animal }: { animal: DodgeAnimal }) {
  return <span className="dodge-animal" role="img" aria-label={animal.name} style={{ '--animal-x': `${animal.column * 100 / 3}%`, '--animal-y': `${animal.row * 100}%` } as CSSProperties} />;
}

function paintAnimal(context: CanvasRenderingContext2D, image: HTMLImageElement | null, animal: DodgeAnimal) {
  context.save();
  context.beginPath();
  context.arc(0, -4, 12, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = animal.color;
  context.fillRect(-13, -17, 26, 28);
  if (image?.complete) {
    const width = image.naturalWidth / 4;
    const height = image.naturalHeight / 2;
    context.drawImage(image, animal.column * width, animal.row * height, width, height, -15, -22, 30, 38);
  }
  context.restore();
}

function paintCar(context: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, animal?: DodgeAnimal, image?: HTMLImageElement | null) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.shadowColor = '#07120f77';
  context.shadowBlur = 10;
  context.shadowOffsetY = 7;
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(-PARKING_CAR_WIDTH / 2, -PARKING_CAR_LENGTH / 2, PARKING_CAR_WIDTH, PARKING_CAR_LENGTH, 11);
  context.fill();
  context.shadowColor = 'transparent';
  context.fillStyle = '#d9f2f1';
  context.beginPath();
  context.roundRect(-14, -24, 28, 18, 6);
  context.fill();
  context.fillStyle = '#9bc4c7';
  context.beginPath();
  context.roundRect(-14, 6, 28, 15, 5);
  context.fill();
  context.fillStyle = '#fff3b5';
  context.fillRect(-15, -34, 8, 3);
  context.fillRect(7, -34, 8, 3);
  context.fillStyle = '#c63935';
  context.fillRect(-15, 31, 8, 3);
  context.fillRect(7, 31, 8, 3);
  if (animal) paintAnimal(context, image ?? null, animal);
  context.restore();
}

function paintParkingBoard(canvas: HTMLCanvasElement, state: ParkingState, course: ParkingCourse, animal: DodgeAnimal, image: HTMLImageElement | null, color: string, steering: number) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== PARKING_WIDTH * ratio || canvas.height !== PARKING_HEIGHT * ratio) {
    canvas.width = PARKING_WIDTH * ratio;
    canvas.height = PARKING_HEIGHT * ratio;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const asphalt = context.createLinearGradient(0, 0, PARKING_WIDTH, PARKING_HEIGHT);
  asphalt.addColorStop(0, '#34413f');
  asphalt.addColorStop(0.55, '#202b2a');
  asphalt.addColorStop(1, '#17211f');
  context.fillStyle = asphalt;
  context.fillRect(0, 0, PARKING_WIDTH, PARKING_HEIGHT);

  context.fillStyle = '#d9d2bd';
  context.fillRect(0, 0, PARKING_WIDTH, 23);
  context.fillRect(0, 0, 26, PARKING_HEIGHT);
  context.fillRect(PARKING_WIDTH - 26, 0, 26, PARKING_HEIGHT);
  context.fillStyle = '#f0c34f';
  context.fillRect(24, 0, 4, PARKING_HEIGHT);
  context.fillRect(PARKING_WIDTH - 28, 0, 4, PARKING_HEIGHT);

  context.lineWidth = 3;
  context.font = '900 12px Arial';
  context.textAlign = 'center';
  for (let index = 0; index < 3; index += 1) {
    const x = parkingSlotX(index);
    const target = index === course.targetIndex;
    context.fillStyle = target ? '#5de2a723' : '#ffffff08';
    context.fillRect(x - 45, 30, 90, 162);
    context.strokeStyle = target ? '#74f0b9' : '#e9eee5';
    context.setLineDash(target ? [9, 6] : []);
    context.strokeRect(x - 45, 31, 90, 161);
    context.setLineDash([]);
    context.fillStyle = target ? '#8affc8' : '#cfd7d2';
    context.fillText(target ? 'PARK' : `${index + 1}`, x, 181);
    if (!target) paintCar(context, x, 111, 0, PARKED_COLORS[index]);
  }

  context.globalAlpha = 0.24;
  context.strokeStyle = '#eef7f0';
  context.lineWidth = 2;
  context.setLineDash([12, 13]);
  context.beginPath();
  context.moveTo(PARKING_WIDTH / 2, 221);
  context.lineTo(PARKING_WIDTH / 2, PARKING_HEIGHT);
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = 1;

  context.fillStyle = '#f4d35e';
  context.beginPath();
  context.moveTo(course.targetX, 214);
  context.lineTo(course.targetX - 10, 230);
  context.lineTo(course.targetX + 10, 230);
  context.closePath();
  context.fill();

  if (state.speed > 8 && !state.released) {
    const guideLength = 42 + state.speed * 0.22;
    context.save();
    context.translate(state.x, state.y);
    context.rotate(state.angle + steering * 0.16);
    context.strokeStyle = '#83f0bd7d';
    context.lineWidth = 3;
    context.setLineDash([7, 6]);
    context.beginPath();
    context.moveTo(0, -42);
    context.lineTo(0, -guideLength);
    context.stroke();
    context.restore();
  }

  paintCar(context, state.x, state.y, state.angle, color, animal, image);
}

export default function ParkingGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(0);
  const [player, setPlayer] = useState(0);
  const [animals, setAnimals] = useState(() => assignDodgeAnimals(2, 8401));
  const [course, setCourse] = useState(() => makeParkingCourse(0));
  const [results, setResults] = useState<ParkingResult[]>([]);
  const [lastResult, setLastResult] = useState<ParkingResult | null>(null);
  const [speed, setSpeed] = useState(0);
  const [braking, setBraking] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const stateRef = useRef(makeParkingState());
  const inputRef = useRef({ driving: false, steering: 0 });
  const pointerRef = useRef<PointerDrive | null>(null);
  const phaseRef = useRef<Phase>('setup');
  const uiUpdateRef = useRef(0);
  const currentAnimal = animals[player] ?? DODGE_ANIMALS[0];

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const paint = useCallback(() => {
    if (!canvasRef.current) return;
    paintParkingBoard(canvasRef.current, stateRef.current, course, currentAnimal, imageRef.current, PLAYER_COLORS[player], inputRef.current.steering);
  }, [course, currentAnimal, player]);

  useEffect(() => {
    const image = new Image();
    image.src = '/dodge-animals.jpg';
    image.onload = () => { imageRef.current = image; paint(); };
  }, [paint]);

  useEffect(() => {
    if (phase === 'ready') paint();
  }, [paint, phase]);

  const finishParking = useCallback((outcome: ParkingOutcome) => {
    if (phaseRef.current !== 'driving') return;
    inputRef.current = { driving: false, steering: 0 };
    pointerRef.current = null;
    const result = { ...outcome, player };
    setLastResult(result);
    setResults((current) => [...current, result]);
    changePhase('result');
  }, [changePhase, player]);

  useEffect(() => {
    if (phase !== 'driving') return;
    let frameId = 0;
    let previous = performance.now();
    let accumulator = 0;
    const frame = (now: number) => {
      accumulator += Math.min(0.05, (now - previous) / 1000);
      previous = now;
      while (accumulator >= 1 / 120) {
        stepParking(stateRef.current, inputRef.current, 1 / 120, course);
        accumulator -= 1 / 120;
      }
      paint();
      if (now - uiUpdateRef.current > 70) {
        setSpeed(Math.round(stateRef.current.speed));
        uiUpdateRef.current = now;
      }
      const outcome = parkingOutcome(stateRef.current, course);
      if (outcome) {
        finishParking(outcome);
        return;
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [course, finishParking, paint, phase]);

  function resetCar() {
    stateRef.current = makeParkingState();
    inputRef.current = { driving: false, steering: 0 };
    pointerRef.current = null;
    setSpeed(0);
    setBraking(false);
  }

  function startGame() {
    const nextRound = round + 1;
    setRound(nextRound);
    setAnimals(assignDodgeAnimals(players, Date.now() + nextRound * 79));
    setCourse(makeParkingCourse(nextRound));
    setPlayer(0);
    setResults([]);
    setLastResult(null);
    resetCar();
    changePhase('ready');
  }

  function boardPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * PARKING_WIDTH / bounds.width,
      y: (event.clientY - bounds.top) * PARKING_HEIGHT / bounds.height,
    };
  }

  function startDrive(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (phaseRef.current !== 'ready') return;
    const point = boardPoint(event);
    if (Math.hypot(point.x - stateRef.current.x, point.y - stateRef.current.y) > 82) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = { id: event.pointerId, startX: point.x };
    inputRef.current = { driving: true, steering: 0 };
    changePhase('driving');
  }

  function steer(event: ReactPointerEvent<HTMLCanvasElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId || phaseRef.current !== 'driving') return;
    event.preventDefault();
    const point = boardPoint(event);
    inputRef.current.steering = Math.max(-1, Math.min(1, (point.x - pointer.startX) / 72));
  }

  function brake(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerRef.current?.id !== event.pointerId) return;
    event.preventDefault();
    pointerRef.current = null;
    inputRef.current = { driving: false, steering: 0 };
    stateRef.current.released = true;
    setBraking(true);
  }

  function keyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    if (![' ', 'Enter', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    if (phaseRef.current === 'ready') {
      inputRef.current.driving = true;
      changePhase('driving');
    }
    if (phaseRef.current === 'driving') {
      if (event.key === 'ArrowLeft') inputRef.current.steering = -1;
      if (event.key === 'ArrowRight') inputRef.current.steering = 1;
    }
  }

  function keyUp(event: KeyboardEvent<HTMLCanvasElement>) {
    if (![' ', 'Enter', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') inputRef.current.steering = 0;
    else if (phaseRef.current === 'driving') {
      inputRef.current.driving = false;
      stateRef.current.released = true;
      setBraking(true);
    }
  }

  function nextPlayer() {
    if (player + 1 >= players) {
      changePhase('final');
      return;
    }
    setPlayer((current) => current + 1);
    resetCar();
    changePhase('ready');
  }

  const ranking = [...results].sort((a, b) => b.score - a.score || a.player - b.player);
  const payer = ranking[ranking.length - 1];

  return (
    <main className="parking-shell">
      <header className="parking-topbar">
        <div><p>ONE TOUCH PARKING</p><h1>한 번에 주차</h1></div>
        <button onClick={onExit}>게임 선택</button>
      </header>

      {phase === 'setup' && (
        <section className="parking-setup">
          <div className="parking-hero" aria-hidden="true"><span>🚙</span><i>P</i></div>
          <p className="parking-kicker">출발은 한 번, 브레이크도 한 번</p>
          <h2>꺾고, 맞추고,<br />딱 멈춰라</h2>
          <p className="parking-intro">차를 누른 채 좌우로 조향하고 손을 떼면 급정거!<br />같은 주차칸에 한 번씩 도전해 최고 점수를 겨룹니다.</p>
          <label className="parking-player-select">참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
          <button className="parking-primary" onClick={startGame}>차 뽑고 주차 시작</button>
          <div className="parking-rules"><span>👆 누르면 출발</span><span>↔️ 좌우 조향</span><span>✋ 놓으면 정지</span></div>
        </section>
      )}

      {(phase === 'ready' || phase === 'driving') && (
        <section className="parking-play">
          <div className="parking-status" style={{ '--driver-color': PLAYER_COLORS[player] } as CSSProperties}>
            <AnimalPortrait animal={currentAnimal} />
            <div><small>{PLAYER_NAMES[player]} 차례</small><strong>{currentAnimal.name} 드라이버</strong></div>
            <b>{speed}<small>km/h</small></b>
          </div>
          <div className={`parking-board ${phase}`}>
            <canvas
              ref={canvasRef}
              tabIndex={0}
              aria-label="차를 누른 채 좌우로 움직여 조향하고 손을 떼면 브레이크가 작동합니다"
              onPointerDown={startDrive}
              onPointerMove={steer}
              onPointerUp={brake}
              onPointerCancel={brake}
              onKeyDown={keyDown}
              onKeyUp={keyUp}
            />
            {phase === 'ready' && <div className="parking-ready" aria-hidden="true"><AnimalPortrait animal={currentAnimal} /><strong>{PLAYER_NAMES[player]} 준비</strong><span>아래의 차를 누른 채<br />빈 주차칸으로 조향하세요</span><i>손을 놓는 순간 급정거</i></div>}
            {phase === 'driving' && <div className={`parking-drive-label ${braking ? 'braking' : ''}`}>{braking ? '급정거 중!' : '손을 떼면 브레이크!'}</div>}
          </div>
          <p className="parking-help">한 번 출발하면 다시 가속할 수 없습니다 · 초록색 PARK 칸에 반듯하게 멈추세요</p>
        </section>
      )}

      {phase === 'result' && lastResult && (
        <section className={`parking-result ${lastResult.parked ? 'success' : 'failed'}`}>
          <AnimalPortrait animal={animals[lastResult.player]} />
          <p>{lastResult.parked ? '주차 성공' : '주차 실패'}</p>
          <h2>{lastResult.score}점</h2>
          <strong>{lastResult.reason}</strong>
          <div><span>중앙 오차 <b>{Math.round(lastResult.centerDistance)}cm</b></span><span>각도 오차 <b>{Math.round(lastResult.angleError * 180 / Math.PI)}°</b></span><span>주행 시간 <b>{lastResult.seconds.toFixed(1)}초</b></span></div>
          <button className="parking-primary" onClick={nextPlayer}>{player + 1 >= players ? '최종 결과 보기' : '다음 운전자에게 넘기기'}</button>
        </section>
      )}

      {phase === 'final' && payer && (
        <section className="parking-final">
          <div className="parking-payer"><AnimalPortrait animal={animals[payer.player]} /><p>오늘의 커피 담당</p><h2>{PLAYER_NAMES[payer.player]}</h2><strong>{payer.score}점 · {payer.parked ? '주차 성공' : payer.reason}</strong></div>
          <ol className="parking-ranking">
            {ranking.map((result, index) => <li key={result.player}><span>{index + 1}</span><AnimalPortrait animal={animals[result.player]} /><div><strong>{PLAYER_NAMES[result.player]}</strong><small>{result.parked ? '주차 성공' : result.reason}</small></div><b>{result.score}점</b></li>)}
          </ol>
          <button className="parking-primary" onClick={startGame}>다시 주차하기</button>
          <button className="parking-secondary" onClick={onExit}>게임 선택으로</button>
        </section>
      )}
    </main>
  );
}
