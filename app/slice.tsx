'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { DODGE_ANIMALS, assignDodgeAnimals, type DodgeAnimal } from './dodge-game';
import { PLAYER_NAMES } from './game';
import { makeSliceChallenges, rankSlices, scoreSlice, splitPolygon, type SliceChallenge, type SliceOutcome, type SlicePoint } from './slice-game';

type Phase = 'setup' | 'ready' | 'cutting' | 'result' | 'final';
type CutLine = { start: SlicePoint; end: SlicePoint };

const BOARD_WIDTH = 390;
const BOARD_HEIGHT = 460;
const SHAPE_SIZE = 350;
const SHAPE_LEFT = 20;
const SHAPE_TOP = 55;
const PLAYER_COLORS = ['#ef654d', '#48a9e8', '#8d71db', '#3cb483', '#df6298', '#d1a52b'];

function AnimalPortrait({ animal }: { animal: DodgeAnimal }) {
  return <span className="dodge-animal" role="img" aria-label={animal.name} style={{ '--animal-x': `${animal.column * 100 / 3}%`, '--animal-y': `${animal.row * 100}%` } as CSSProperties} />;
}

function canvasPoint(point: SlicePoint, offset: SlicePoint = { x: 0, y: 0 }) {
  return { x: SHAPE_LEFT + point.x * SHAPE_SIZE + offset.x, y: SHAPE_TOP + point.y * SHAPE_SIZE + offset.y };
}

function polygonPath(context: CanvasRenderingContext2D, points: SlicePoint[], offset: SlicePoint = { x: 0, y: 0 }) {
  if (!points.length) return;
  const first = canvasPoint(points[0], offset);
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const point of points.slice(1)) {
    const next = canvasPoint(point, offset);
    context.lineTo(next.x, next.y);
  }
  context.closePath();
}

function drawPiece(context: CanvasRenderingContext2D, challenge: SliceChallenge, points: SlicePoint[], offset: SlicePoint) {
  context.save();
  context.shadowColor = '#51341f4f';
  context.shadowBlur = 18;
  context.shadowOffsetY = 12;
  polygonPath(context, points, offset);
  context.fillStyle = challenge.color;
  context.fill();
  context.shadowColor = 'transparent';
  context.lineWidth = 5;
  context.lineJoin = 'round';
  context.strokeStyle = challenge.accent;
  context.stroke();
  polygonPath(context, points, offset);
  context.clip();
  context.globalAlpha = .19;
  context.fillStyle = '#fff8de';
  for (let index = 0; index < 9; index += 1) {
    const x = SHAPE_LEFT + (0.2 + (index * 37 % 67) / 100) * SHAPE_SIZE + offset.x;
    const y = SHAPE_TOP + (0.2 + (index * 29 % 61) / 100) * SHAPE_SIZE + offset.y;
    context.beginPath();
    context.arc(x, y, 5 + index % 3 * 2, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = .7;
  context.fillStyle = challenge.accent;
  context.font = '900 16px Arial';
  context.textAlign = 'center';
  context.fillText(challenge.name, BOARD_WIDTH / 2 + offset.x, BOARD_HEIGHT / 2 + offset.y);
  context.restore();
}

function paintSlice(canvas: HTMLCanvasElement, challenge: SliceChallenge, line: CutLine | null, outcome: SliceOutcome | null) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== BOARD_WIDTH * ratio || canvas.height !== BOARD_HEIGHT * ratio) {
    canvas.width = BOARD_WIDTH * ratio;
    canvas.height = BOARD_HEIGHT * ratio;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const table = context.createLinearGradient(0, 0, 0, BOARD_HEIGHT);
  table.addColorStop(0, '#fff9df');
  table.addColorStop(1, '#ebc992');
  context.fillStyle = table;
  context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  context.globalAlpha = .12;
  context.strokeStyle = '#8c5d35';
  context.lineWidth = 1;
  for (let y = 28; y < BOARD_HEIGHT; y += 46) {
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(90, y - 8, 270, y + 9, BOARD_WIDTH, y - 2);
    context.stroke();
  }
  context.globalAlpha = 1;

  const activeLine = outcome ? { start: outcome.start, end: outcome.end } : line;
  if (outcome) {
    const pieces = splitPolygon(challenge.transformed, outcome.start, outcome.end);
    const dx = outcome.end.x - outcome.start.x;
    const dy = outcome.end.y - outcome.start.y;
    const length = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / length * 9, y: dx / length * 9 };
    drawPiece(context, challenge, pieces.first, normal);
    drawPiece(context, challenge, pieces.second, { x: -normal.x, y: -normal.y });
  } else {
    drawPiece(context, challenge, challenge.transformed, { x: 0, y: 0 });
  }

  if (activeLine) {
    const start = canvasPoint(activeLine.start);
    const end = canvasPoint(activeLine.end);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const extend = 520;
    context.beginPath();
    context.moveTo(start.x - dx / length * extend, start.y - dy / length * extend);
    context.lineTo(end.x + dx / length * extend, end.y + dy / length * extend);
    context.strokeStyle = outcome ? '#fffdf4' : '#44342c';
    context.lineWidth = outcome ? 5 : 4;
    context.setLineDash(outcome ? [] : [10, 7]);
    context.shadowColor = outcome ? '#6d3b2688' : 'transparent';
    context.shadowBlur = 8;
    context.stroke();
    context.setLineDash([]);
    context.shadowColor = 'transparent';
  }
}

function SlicePreview({ challenge, outcome }: { challenge: SliceChallenge; outcome: SliceOutcome }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintSlice(ref.current, challenge, null, outcome);
  }, [challenge, outcome]);
  return <canvas ref={ref} className="slice-preview" aria-label={`${challenge.name} 자르기 결과, ${outcome.left.toFixed(1)} 대 ${outcome.right.toFixed(1)}`} />;
}

export default function SliceGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(0);
  const [turn, setTurn] = useState(0);
  const [animals, setAnimals] = useState(() => assignDodgeAnimals(2, 3221));
  const [challenges, setChallenges] = useState(() => makeSliceChallenges(2, 3221));
  const [results, setResults] = useState<SliceOutcome[]>([]);
  const [lastResult, setLastResult] = useState<SliceOutcome | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<number | null>(null);
  const lineRef = useRef<CutLine | null>(null);
  const currentChallenge = challenges[turn] ?? challenges[0];
  const currentAnimal = animals[turn] ?? DODGE_ANIMALS[0];
  const ranked = useMemo(() => rankSlices(results), [results]);
  const payer = ranked.at(-1);

  const paint = useCallback(() => {
    if (canvasRef.current && currentChallenge) paintSlice(canvasRef.current, currentChallenge, lineRef.current, phase === 'result' ? lastResult : null);
  }, [currentChallenge, lastResult, phase]);

  useEffect(() => {
    if (phase === 'ready' || phase === 'cutting') paint();
  }, [paint, phase]);

  function startGame() {
    const nextRound = round + 1;
    const seed = Date.now() + nextRound * 97;
    setRound(nextRound);
    setTurn(0);
    setAnimals(assignDodgeAnimals(players, seed));
    setChallenges(makeSliceChallenges(players, seed));
    setResults([]);
    setLastResult(null);
    setDrawing(false);
    setError('');
    lineRef.current = null;
    setPhase('ready');
  }

  function beginCutting() {
    lineRef.current = null;
    setDrawing(false);
    setError('');
    setPhase('cutting');
  }

  function eventPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * BOARD_WIDTH / bounds.width;
    const y = (event.clientY - bounds.top) * BOARD_HEIGHT / bounds.height;
    return {
      x: Math.max(-.08, Math.min(1.08, (x - SHAPE_LEFT) / SHAPE_SIZE)),
      y: Math.max(-.08, Math.min(1.08, (y - SHAPE_TOP) / SHAPE_SIZE)),
    };
  }

  function startCut(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (phase !== 'cutting' || pointerRef.current !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = eventPoint(event);
    pointerRef.current = event.pointerId;
    lineRef.current = { start: point, end: point };
    setDrawing(true);
    setError('');
    paintSlice(event.currentTarget, currentChallenge, lineRef.current, null);
  }

  function moveCut(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerRef.current !== event.pointerId || !lineRef.current) return;
    event.preventDefault();
    lineRef.current.end = eventPoint(event);
    paintSlice(event.currentTarget, currentChallenge, lineRef.current, null);
  }

  function finishCut(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerRef.current !== event.pointerId || !lineRef.current) return;
    event.preventDefault();
    lineRef.current.end = eventPoint(event);
    const outcome = scoreSlice(turn, currentChallenge, lineRef.current.start, lineRef.current.end);
    pointerRef.current = null;
    setDrawing(false);
    if (!outcome) {
      lineRef.current = null;
      setError('물체를 가로질러 조금 더 길게 그어주세요');
      paintSlice(event.currentTarget, currentChallenge, null, null);
      return;
    }
    setLastResult(outcome);
    setResults((current) => [...current, outcome]);
    setPhase('result');
  }

  function nextPlayer() {
    if (turn + 1 >= players) {
      setPhase('final');
      return;
    }
    setTurn((current) => current + 1);
    setLastResult(null);
    lineRef.current = null;
    setError('');
    setPhase('ready');
  }

  return (
    <main className="slice-shell">
      <header className="slice-topbar">
        <div><p>ONE LINE · HALF & HALF</p><h1>반으로 쓱</h1></div>
        <button onClick={onExit}>게임 선택</button>
      </header>

      {phase === 'setup' && (
        <section className="slice-setup">
          <div className="slice-hero" aria-hidden="true"><span>🍠</span><span>🍉</span><span>🧀</span><i /></div>
          <p className="slice-kicker">비율은 손을 뗀 뒤에만 공개</p>
          <h2>한 줄로 정확히<br />반을 만들어라</h2>
          <p className="slice-intro">호떡부터 고구마·나뭇잎까지 8가지 비대칭 물체!<br />50:50에 가장 멀리 자른 사람이 오늘 커피 담당입니다.</p>
          <label className="slice-player-select">참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
          <button className="slice-primary" onClick={startGame}>자를 물체 섞기</button>
          <div className="slice-rules"><span>👀 넓이 가늠</span><span>☝️ 한 번 긋기</span><span>⚖️ 50:50 승리</span></div>
        </section>
      )}

      {(phase === 'ready' || phase === 'cutting') && (
        <section className="slice-play">
          <div className="slice-status" style={{ '--slice-player': PLAYER_COLORS[turn] } as CSSProperties}>
            <AnimalPortrait animal={currentAnimal} />
            <div><small>{PLAYER_NAMES[turn]} 차례 · {turn + 1}/{players}</small><strong>{currentChallenge.name}</strong></div>
            <b>50<small>: 50</small></b>
          </div>
          <div className={`slice-board ${phase} ${drawing ? 'drawing' : ''}`} style={{ '--slice-player': PLAYER_COLORS[turn] } as CSSProperties}>
            <canvas
              ref={canvasRef}
              aria-label={`${currentChallenge.name}을 한 줄로 반으로 자르는 영역`}
              onPointerDown={startCut}
              onPointerMove={moveCut}
              onPointerUp={finishCut}
              onPointerCancel={finishCut}
              onContextMenu={(event) => event.preventDefault()}
            />
            {phase === 'ready' && <div className="slice-ready"><AnimalPortrait animal={currentAnimal} /><strong>{PLAYER_NAMES[turn]} 준비</strong><span>{currentChallenge.hint}</span><button onClick={beginCutting}>내 차례 시작</button></div>}
            {phase === 'cutting' && <div className="slice-cut-label">{drawing ? '손을 떼면 바로 공개!' : '물체를 가로질러 한 번에 쓱'}</div>}
          </div>
          <p className={`slice-help ${error ? 'error' : ''}`}>{error || '긋는 동안에는 비율이 보이지 않습니다'}</p>
        </section>
      )}

      {phase === 'result' && lastResult && (
        <section className="slice-result">
          <SlicePreview challenge={currentChallenge} outcome={lastResult} />
          <p>{lastResult.error <= 1 ? '거의 완벽해요!' : lastResult.error <= 4 ? '제법 반듯하게 나눴어요' : '한쪽이 더 묵직하네요'}</p>
          <h2><span>{lastResult.left.toFixed(1)}</span><i>:</i><span>{lastResult.right.toFixed(1)}</span></h2>
          <strong>{lastResult.score}점 · 오차 {lastResult.error.toFixed(1)}%</strong>
          <button className="slice-primary" onClick={nextPlayer}>{turn + 1 >= players ? '최종 결과 보기' : '다음 사람에게 넘기기'}</button>
        </section>
      )}

      {phase === 'final' && payer && (
        <section className="slice-final">
          <div className="slice-payer"><AnimalPortrait animal={animals[payer.player]} /><p>오늘의 커피 담당</p><h2>{PLAYER_NAMES[payer.player]}</h2><strong>{payer.shapeName} · 오차 {payer.error.toFixed(1)}%</strong></div>
          <ol className="slice-ranking">
            {ranked.map((result, index) => <li key={result.player}><span>{index + 1}</span><AnimalPortrait animal={animals[result.player]} /><div><strong>{PLAYER_NAMES[result.player]}</strong><small>{result.shapeName} · {result.left.toFixed(1)}:{result.right.toFixed(1)}</small></div><b>{result.score}점</b></li>)}
          </ol>
          <button className="slice-primary" onClick={startGame}>다른 물체로 한 판 더</button>
          <button className="slice-secondary" onClick={onExit}>게임 선택으로</button>
        </section>
      )}
    </main>
  );
}
