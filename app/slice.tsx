'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { DODGE_ANIMALS, assignDodgeAnimals, type DodgeAnimal } from './dodge-game';
import { PLAYER_NAMES } from './game';
import { makeSliceChallenges, projectSlicePoint, rankSlices, scoreSlice, splitPolygon, transformSlicePoint, unprojectSlicePoint, type SliceChallenge, type SliceOutcome, type SlicePoint } from './slice-game';

type Phase = 'setup' | 'ready' | 'cutting' | 'result' | 'final';
type CutLine = { start: SlicePoint; end: SlicePoint };

const BOARD_WIDTH = 390;
const BOARD_HEIGHT = 460;
const SHAPE_SIZE = 325;
const SHAPE_CENTER_X = BOARD_WIDTH / 2;
const SHAPE_CENTER_Y = 190;
const PLAYER_COLORS = ['#ef654d', '#48a9e8', '#8d71db', '#3cb483', '#df6298', '#d1a52b'];

function AnimalPortrait({ animal }: { animal: DodgeAnimal }) {
  return <span className="dodge-animal" role="img" aria-label={animal.name} style={{ '--animal-x': `${animal.column * 100 / 3}%`, '--animal-y': `${animal.row * 100}%` } as CSSProperties} />;
}

function canvasPoint(point: SlicePoint, challenge: SliceChallenge, offset: SlicePoint = { x: 0, y: 0 }) {
  const projected = projectSlicePoint(point, challenge);
  return {
    x: SHAPE_CENTER_X + (projected.x - .5) * SHAPE_SIZE + offset.x,
    y: SHAPE_CENTER_Y + (projected.y - .5) * SHAPE_SIZE + offset.y,
  };
}

function polygonPath(context: CanvasRenderingContext2D, challenge: SliceChallenge, points: SlicePoint[], offset: SlicePoint = { x: 0, y: 0 }) {
  if (!points.length) return;
  const first = canvasPoint(points[0], challenge, offset);
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const point of points.slice(1)) {
    const next = canvasPoint(point, challenge, offset);
    context.lineTo(next.x, next.y);
  }
  context.closePath();
}

function drawTexture(context: CanvasRenderingContext2D, challenge: SliceChallenge, offset: SlicePoint) {
  const at = (x: number, y: number) => canvasPoint(transformSlicePoint({ x, y }, challenge), challenge, offset);
  const stroke = (from: SlicePoint, to: SlicePoint, width = 2) => {
    const a = at(from.x, from.y);
    const b = at(to.x, to.y);
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.lineWidth = width;
    context.stroke();
  };
  context.save();
  context.globalAlpha = .34;
  context.strokeStyle = challenge.accent;
  context.fillStyle = challenge.accent;

  if (challenge.id === 'watermelon') {
    for (let index = 0; index < 5; index += 1) {
      const top = at(.25 + index * .12, .17);
      const middle = at(.2 + index * .15, .5);
      const bottom = at(.28 + index * .11, .83);
      context.beginPath();
      context.moveTo(top.x, top.y);
      context.quadraticCurveTo(middle.x, middle.y, bottom.x, bottom.y);
      context.lineWidth = 7 - Math.abs(index - 2);
      context.stroke();
    }
  } else if (challenge.id === 'leaf') {
    stroke({ x: .18, y: .67 }, { x: .76, y: .26 }, 4);
    [[.31, .57, .27, .4], [.42, .5, .48, .3], [.53, .42, .66, .34], [.61, .36, .68, .52]].forEach(([x1, y1, x2, y2]) => stroke({ x: x1, y: y1 }, { x: x2, y: y2 }));
  } else if (challenge.id === 'dumpling') {
    for (let index = 0; index < 7; index += 1) stroke({ x: .5, y: .24 }, { x: .23 + index * .09, y: .59 }, 3);
  } else {
    const marks = challenge.id === 'cheese'
        ? [[.3, .42], [.57, .31], [.67, .62], [.4, .69]]
        : [[.28, .42], [.42, .28], [.58, .55], [.7, .38], [.4, .67], [.62, .72]];
    for (const [x, y] of marks) {
      const point = at(x, y);
      context.beginPath();
      context.ellipse(point.x, point.y, challenge.id === 'cheese' ? 8 : 3, challenge.id === 'cheese' ? 5 : 2, -.2, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function drawPiece(context: CanvasRenderingContext2D, challenge: SliceChallenge, points: SlicePoint[], offset: SlicePoint) {
  context.save();
  context.shadowColor = '#2d18156f';
  context.shadowBlur = 28;
  context.shadowOffsetX = Math.sign(challenge.viewSkew) * 12;
  context.shadowOffsetY = 20;
  polygonPath(context, challenge, points, offset);
  context.fillStyle = '#38221945';
  context.fill();
  context.shadowColor = 'transparent';
  polygonPath(context, challenge, points, offset);
  context.fillStyle = challenge.color;
  context.fill();
  polygonPath(context, challenge, points, offset);
  context.clip();
  const center = canvasPoint(transformSlicePoint({ x: .5, y: .52 }, challenge), challenge, offset);
  const highlight = canvasPoint(transformSlicePoint({ x: .34, y: .29 }, challenge), challenge, offset);
  const sheen = context.createRadialGradient(highlight.x, highlight.y, 4, center.x, center.y, SHAPE_SIZE * .46);
  sheen.addColorStop(0, '#fffbeaa8');
  sheen.addColorStop(.28, '#ffffff31');
  sheen.addColorStop(.68, '#3a16200c');
  sheen.addColorStop(1, '#1e0b234f');
  context.fillStyle = sheen;
  context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  const reflected = context.createRadialGradient(center.x + 35, center.y + 40, 5, center.x + 35, center.y + 40, SHAPE_SIZE * .32);
  reflected.addColorStop(0, '#ffffff1f');
  reflected.addColorStop(1, '#13090e24');
  context.fillStyle = reflected;
  context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  drawTexture(context, challenge, offset);
  context.restore();

  context.save();
  polygonPath(context, challenge, points, offset);
  context.lineWidth = 2.5;
  context.lineJoin = 'round';
  context.strokeStyle = `${challenge.accent}c7`;
  context.stroke();
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
    const screenStart = canvasPoint(outcome.start, challenge);
    const screenEnd = canvasPoint(outcome.end, challenge);
    const dx = screenEnd.x - screenStart.x;
    const dy = screenEnd.y - screenStart.y;
    const length = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / length * 10, y: dx / length * 10 };
    drawPiece(context, challenge, pieces.first, normal);
    drawPiece(context, challenge, pieces.second, { x: -normal.x, y: -normal.y });
  } else {
    drawPiece(context, challenge, challenge.transformed, { x: 0, y: 0 });
  }

  if (activeLine) {
    const start = canvasPoint(activeLine.start, challenge);
    const end = canvasPoint(activeLine.end, challenge);
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
    const point = unprojectSlicePoint({
      x: .5 + (x - SHAPE_CENTER_X) / SHAPE_SIZE,
      y: .5 + (y - SHAPE_CENTER_Y) / SHAPE_SIZE,
    }, currentChallenge);
    return {
      x: Math.max(-.08, Math.min(1.08, point.x)),
      y: Math.max(-.08, Math.min(1.08, point.y)),
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
          <p className="slice-intro">둥근 수박, 찌그러진 고구마, 부푼 만두까지!<br />겉넓이가 아닌 물체의 실제 부피를 50:50으로 나눠보세요.</p>
          <label className="slice-player-select">참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
          <button className="slice-primary" onClick={startGame}>자를 물체 섞기</button>
          <div className="slice-rules"><span>👀 부피 가늠</span><span>☝️ 한 번 긋기</span><span>⚖️ 50:50 승리</span></div>
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
              aria-label={`${currentChallenge.name} 한 줄 자르기 영역`}
              onPointerDown={startCut}
              onPointerMove={moveCut}
              onPointerUp={finishCut}
              onPointerCancel={finishCut}
              onContextMenu={(event) => event.preventDefault()}
            />
            {phase === 'ready' && <div className="slice-ready"><AnimalPortrait animal={currentAnimal} /><strong>{PLAYER_NAMES[turn]} 준비</strong><span>{currentChallenge.hint}<br />겉모양 속 실제 부피를 가늠하세요</span><button onClick={beginCutting}>내 차례 시작</button></div>}
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
