'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { DODGE_ANIMALS, assignDodgeAnimals, type DodgeAnimal } from './dodge-game';
import { PLAYER_NAMES } from './game';
import {
  LANDER_GROUND_Y,
  LANDER_HEIGHT,
  LANDER_PAD_WIDTH,
  LANDER_START_FUEL,
  LANDER_WIDTH,
  landerOutcome,
  landerWind,
  makeLanderState,
  makeLandingPad,
  stepLander,
  type LanderOutcome,
  type LanderState,
} from './lander-game';

type Phase = 'setup' | 'ready' | 'flying' | 'between' | 'final';
type FlightResult = LanderOutcome & { player: number; fuel: number; seconds: number };

const PLAYER_COLORS = ['#ff946c', '#62c5ef', '#aa88f2', '#55c59a', '#f27bad', '#e9bd45'];

function AnimalPortrait({ animal }: { animal: DodgeAnimal }) {
  return <span className="dodge-animal" role="img" aria-label={animal.name} style={{ '--animal-x': `${animal.column * 100 / 3}%`, '--animal-y': `${animal.row * 100}%` } as CSSProperties} />;
}

function paintAnimal(context: CanvasRenderingContext2D, image: HTMLImageElement | null, animal: DodgeAnimal) {
  context.save();
  context.beginPath();
  context.arc(0, -8, 14, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = animal.color;
  context.fillRect(-15, -23, 30, 30);
  if (image?.complete) {
    const cellWidth = image.naturalWidth / 4;
    const cellHeight = image.naturalHeight / 2;
    context.drawImage(image, animal.column * cellWidth, animal.row * cellHeight, cellWidth, cellHeight, -17, -28, 34, 43);
  }
  context.restore();
  context.strokeStyle = '#b8ecff';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, -8, 15, 0, Math.PI * 2);
  context.stroke();
}

function paintLander(
  canvas: HTMLCanvasElement,
  state: LanderState,
  animal: DodgeAnimal,
  image: HTMLImageElement | null,
  padX: number,
  windSeed: number,
  thrusting: boolean,
) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== LANDER_WIDTH * ratio || canvas.height !== LANDER_HEIGHT * ratio) {
    canvas.width = LANDER_WIDTH * ratio;
    canvas.height = LANDER_HEIGHT * ratio;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const sky = context.createLinearGradient(0, 0, 0, LANDER_HEIGHT);
  sky.addColorStop(0, '#111845');
  sky.addColorStop(0.62, '#263674');
  sky.addColorStop(1, '#765272');
  context.fillStyle = sky;
  context.fillRect(0, 0, LANDER_WIDTH, LANDER_HEIGHT);

  for (let index = 0; index < 52; index += 1) {
    const x = (index * 83 + 29) % LANDER_WIDTH;
    const y = (index * 47 + 21) % 390;
    context.globalAlpha = 0.35 + (index % 4) * 0.15;
    context.fillStyle = index % 7 === 0 ? '#9beaff' : '#ffffff';
    context.beginPath();
    context.arc(x, y, index % 6 === 0 ? 1.7 : 0.9, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  const wind = landerWind(state.elapsed, windSeed);
  context.strokeStyle = '#b7ecff50';
  context.fillStyle = '#b7ecff90';
  context.lineWidth = 2;
  const windY = 64;
  context.beginPath();
  context.moveTo(24, windY);
  context.lineTo(24 + wind * 3, windY);
  context.stroke();
  context.beginPath();
  context.moveTo(24 + wind * 3, windY);
  context.lineTo(24 + wind * 3 - Math.sign(wind || 1) * 6, windY - 4);
  context.lineTo(24 + wind * 3 - Math.sign(wind || 1) * 6, windY + 4);
  context.closePath();
  context.fill();

  context.fillStyle = '#171733';
  context.fillRect(0, LANDER_GROUND_Y, LANDER_WIDTH, LANDER_HEIGHT - LANDER_GROUND_Y);
  context.fillStyle = '#252550';
  context.beginPath();
  context.moveTo(0, LANDER_GROUND_Y);
  for (let x = 0; x <= LANDER_WIDTH; x += 26) context.lineTo(x, LANDER_GROUND_Y - ((x * 17) % 31));
  context.lineTo(LANDER_WIDTH, LANDER_GROUND_Y);
  context.closePath();
  context.fill();

  const padGradient = context.createLinearGradient(0, LANDER_GROUND_Y - 10, 0, LANDER_GROUND_Y + 6);
  padGradient.addColorStop(0, '#a7fff1');
  padGradient.addColorStop(1, '#3bb7c7');
  context.fillStyle = padGradient;
  context.beginPath();
  context.roundRect(padX - LANDER_PAD_WIDTH / 2, LANDER_GROUND_Y - 9, LANDER_PAD_WIDTH, 14, 5);
  context.fill();
  context.strokeStyle = '#d6fff8';
  context.lineWidth = 2;
  context.setLineDash([5, 5]);
  context.beginPath();
  context.moveTo(padX, LANDER_GROUND_Y - 9);
  context.lineTo(padX, LANDER_GROUND_Y + 4);
  context.stroke();
  context.setLineDash([]);

  context.save();
  context.translate(state.x, state.y);
  context.rotate(state.angle);
  context.shadowColor = '#63e6ff55';
  context.shadowBlur = 16;
  context.fillStyle = '#e8f7ff';
  context.beginPath();
  context.roundRect(-18, -30, 36, 59, 17);
  context.fill();
  context.shadowColor = 'transparent';
  context.fillStyle = '#6ca4cf';
  context.beginPath();
  context.moveTo(-16, 13);
  context.lineTo(-28, 27);
  context.lineTo(-14, 24);
  context.closePath();
  context.moveTo(16, 13);
  context.lineTo(28, 27);
  context.lineTo(14, 24);
  context.closePath();
  context.fill();
  context.fillStyle = '#233965';
  context.fillRect(-11, 21, 22, 9);
  paintAnimal(context, image, animal);
  if (thrusting && state.fuel > 0) {
    const flame = context.createLinearGradient(0, 29, 0, 60);
    flame.addColorStop(0, '#fff4a8');
    flame.addColorStop(0.45, '#ff9c55');
    flame.addColorStop(1, '#f04b9000');
    context.fillStyle = flame;
    context.beginPath();
    context.moveTo(-9, 28);
    context.lineTo(0, 55 + Math.sin(state.elapsed * 38) * 5);
    context.lineTo(9, 28);
    context.closePath();
    context.fill();
  }
  context.restore();
}

export default function LanderGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(1);
  const [player, setPlayer] = useState(0);
  const [animals, setAnimals] = useState(() => assignDodgeAnimals(2, 9327));
  const [results, setResults] = useState<FlightResult[]>([]);
  const [lastResult, setLastResult] = useState<FlightResult | null>(null);
  const [flightInfo, setFlightInfo] = useState({ fuel: LANDER_START_FUEL, speed: 6, altitude: 381 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const phaseRef = useRef<Phase>('setup');
  const stateRef = useRef(makeLanderState());
  const inputRef = useRef({ thrusting: false, direction: 0 });
  const pointerRef = useRef<number | null>(null);
  const uiUpdatedRef = useRef(0);
  const seed = 1409 + round * 67;
  const padX = makeLandingPad(seed);

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    const image = new Image();
    image.src = '/dodge-animals.jpg';
    image.onload = () => {
      imageRef.current = image;
      if (canvasRef.current && phaseRef.current === 'ready') paintLander(canvasRef.current, stateRef.current, animals[player] ?? DODGE_ANIMALS[0], image, padX, seed, false);
    };
  }, [animals, padX, player, seed]);

  const finishFlight = useCallback((outcome: LanderOutcome) => {
    if (phaseRef.current !== 'flying') return;
    inputRef.current = { thrusting: false, direction: 0 };
    pointerRef.current = null;
    const result = { ...outcome, player, fuel: stateRef.current.fuel, seconds: stateRef.current.elapsed };
    setLastResult(result);
    setResults((current) => [...current, result]);
    changePhase('between');
  }, [changePhase, player]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || phase !== 'flying') return;
    let frameId = 0;
    let previous = performance.now();
    let accumulator = 0;
    const frame = (now: number) => {
      accumulator += Math.min(0.05, (now - previous) / 1000);
      previous = now;
      while (accumulator >= 1 / 120) {
        stepLander(stateRef.current, inputRef.current, 1 / 120, seed);
        accumulator -= 1 / 120;
      }
      paintLander(canvas, stateRef.current, animals[player], imageRef.current, padX, seed, inputRef.current.thrusting);
      if (now - uiUpdatedRef.current > 60) {
        setFlightInfo({
          fuel: stateRef.current.fuel,
          speed: Math.hypot(stateRef.current.vx, stateRef.current.vy),
          altitude: Math.max(0, LANDER_GROUND_Y - 29 - stateRef.current.y),
        });
        uiUpdatedRef.current = now;
      }
      const outcome = landerOutcome(stateRef.current, padX);
      if (outcome) {
        finishFlight(outcome);
        return;
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [animals, finishFlight, padX, phase, player, seed]);

  useEffect(() => {
    if (phase !== 'ready' || !canvasRef.current) return;
    paintLander(canvasRef.current, stateRef.current, animals[player], imageRef.current, padX, seed, false);
  }, [animals, padX, phase, player, seed]);

  function resetFlight() {
    stateRef.current = makeLanderState();
    inputRef.current = { thrusting: false, direction: 0 };
    pointerRef.current = null;
    setFlightInfo({ fuel: LANDER_START_FUEL, speed: 6, altitude: 381 });
  }

  function startGame() {
    const nextRound = round + 1;
    setRound(nextRound);
    setAnimals(assignDodgeAnimals(players, Date.now() + nextRound * 43));
    setPlayer(0);
    setResults([]);
    setLastResult(null);
    resetFlight();
    changePhase('ready');
  }

  function pointerDirection(event: ReactPointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = (event.clientX - bounds.left) * LANDER_WIDTH / bounds.width;
    return Math.max(-1, Math.min(1, (pointerX - stateRef.current.x) / 70));
  }

  function ignite(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (phaseRef.current !== 'ready' && phaseRef.current !== 'flying') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = event.pointerId;
    inputRef.current = { thrusting: true, direction: pointerDirection(event) };
    if (phaseRef.current === 'ready') changePhase('flying');
  }

  function steer(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (phaseRef.current !== 'flying' || pointerRef.current !== event.pointerId) return;
    event.preventDefault();
    inputRef.current.direction = pointerDirection(event);
  }

  function coast(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerRef.current !== event.pointerId) return;
    event.preventDefault();
    pointerRef.current = null;
    inputRef.current = { thrusting: false, direction: 0 };
  }

  function handleKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    if (![' ', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    if (phaseRef.current === 'ready') changePhase('flying');
    inputRef.current.thrusting = true;
    inputRef.current.direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : inputRef.current.direction;
  }

  function handleKeyUp(event: KeyboardEvent<HTMLCanvasElement>) {
    if (![' ', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    inputRef.current = { thrusting: false, direction: 0 };
  }

  function nextPlayer() {
    if (player + 1 >= players) {
      changePhase('final');
      return;
    }
    setPlayer((current) => current + 1);
    resetFlight();
    changePhase('ready');
  }

  const currentAnimal = animals[player] ?? DODGE_ANIMALS[0];
  const ranking = [...results].sort((a, b) => b.score - a.score);
  const payer = ranking[ranking.length - 1];

  return (
    <main className="lander-shell">
      <header className="lander-topbar">
        <div><p>ONE TOUCH LANDING</p><h1>아슬아슬 착륙</h1></div>
        <button onClick={onExit}>게임 선택</button>
      </header>

      {phase === 'setup' && (
        <section className="lander-setup">
          <div className="lander-hero" aria-hidden="true"><span>🚀</span><AnimalPortrait animal={DODGE_ANIMALS[2]} /></div>
          <p className="lander-kicker">연료는 짧고, 착륙장은 작다</p>
          <h2>누르면 점화<br />놓으면 자유낙하</h2>
          <p className="lander-intro">누른 채 좌우로 움직여 방향을 바꾸세요.<br />가장 부드럽고 정확하게 착륙한 사람이 승리합니다.</p>
          <label className="lander-player-select">참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
          <button className="lander-primary" onClick={startGame}>조종사 뽑고 출발</button>
          <div className="lander-rules"><span>🔥 누르면 상승</span><span>↔️ 밀어서 조종</span><span>🎯 낮은 속도로 착륙</span></div>
        </section>
      )}

      {(phase === 'ready' || phase === 'flying') && (
        <section className="lander-play">
          <div className="lander-status" style={{ '--pilot-color': PLAYER_COLORS[player] } as CSSProperties}>
            <AnimalPortrait animal={currentAnimal} />
            <div><small>{PLAYER_NAMES[player]} 조종사</small><strong>{currentAnimal.name} 우주선</strong></div>
            <b>{Math.round(flightInfo.speed)}<small>속도</small></b>
          </div>
          <div className="lander-fuel"><span style={{ width: `${flightInfo.fuel / LANDER_START_FUEL * 100}%` }} /><b>FUEL {Math.round(flightInfo.fuel / LANDER_START_FUEL * 100)}%</b></div>
          <div className={`lander-board ${phase}`}>
            <canvas
              ref={canvasRef}
              tabIndex={0}
              aria-label="누르고 있으면 엔진이 켜지고 좌우로 움직이면 우주선 방향이 바뀝니다"
              onPointerDown={ignite}
              onPointerMove={steer}
              onPointerUp={coast}
              onPointerCancel={coast}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
            />
            {phase === 'ready' && <div className="lander-ready" aria-hidden="true"><AnimalPortrait animal={currentAnimal} /><strong>{PLAYER_NAMES[player]} 준비</strong><span>게임판을 누르면<br />엔진이 점화됩니다</span><i>누르고 좌우로 밀기</i></div>}
            {phase === 'flying' && <div className="lander-altitude">고도 {Math.round(flightInfo.altitude)}m</div>}
          </div>
          <p className="lander-help">여러 번 눌렀다 놓아도 됩니다 · 연료가 떨어지기 전에 천천히 착륙하세요</p>
        </section>
      )}

      {phase === 'between' && lastResult && (
        <section className={`lander-result ${lastResult.success ? 'success' : 'crash'}`}>
          <AnimalPortrait animal={animals[lastResult.player]} />
          <p>{lastResult.success ? '착륙 성공' : '착륙 실패'}</p>
          <h2>{lastResult.score}점</h2>
          <strong>{lastResult.reason}</strong>
          <div><span>충돌 속도 <b>{Math.round(lastResult.impactSpeed)}</b></span><span>중앙 오차 <b>{Math.round(lastResult.centerDistance)}m</b></span><span>남은 연료 <b>{Math.round(lastResult.fuel / LANDER_START_FUEL * 100)}%</b></span></div>
          <button className="lander-primary" onClick={nextPlayer}>{player + 1 >= players ? '최종 결과 보기' : '다음 조종사에게 넘기기'}</button>
        </section>
      )}

      {phase === 'final' && payer && (
        <section className="lander-final">
          <div className="lander-payer"><AnimalPortrait animal={animals[payer.player]} /><p>오늘의 커피 담당</p><h2>{PLAYER_NAMES[payer.player]}</h2><strong>{payer.score}점</strong></div>
          <ol className="lander-ranking">
            {ranking.map((result, index) => <li key={result.player}><span>{index + 1}</span><AnimalPortrait animal={animals[result.player]} /><div><strong>{PLAYER_NAMES[result.player]}</strong><small>{result.success ? '착륙 성공' : result.reason}</small></div><b>{result.score}점</b></li>)}
          </ol>
          <button className="lander-primary" onClick={startGame}>다시 비행하기</button>
          <button className="lander-secondary" onClick={onExit}>게임 선택으로</button>
        </section>
      )}
    </main>
  );
}
