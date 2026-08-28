'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  CURVES,
  CURVE_SHAPES,
  curveTemplate,
  pathIsLongEnough,
  rankCurves,
  scoreCurve,
  type CurvePoint,
  type CurveResult,
  type CurveShape,
} from './circle-game';

type Phase = 'setup' | 'ready' | 'drawing' | 'handoff' | 'result';

const PLAYER_COLORS = ['#8ffcff', '#ff8bca', '#ffd86f', '#a9ff72', '#b7a1ff', '#ff936b'];

function drawPath(canvas: HTMLCanvasElement, points: CurvePoint[], color: string, clear = true) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (clear) context.clearRect(0, 0, rect.width, rect.height);
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0].x * rect.width, points[0].y * rect.height);
  for (const point of points.slice(1)) context.lineTo(point.x * rect.width, point.y * rect.height);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = Math.max(3, rect.width * 0.014);
  context.strokeStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 16;
  context.stroke();
}

function CurveIcon({ shape, className = '' }: { shape: CurveShape; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawPath(ref.current, curveTemplate(shape), '#dffeff', true);
  }, [shape]);
  return <canvas ref={ref} className={`curve-icon ${className}`} aria-label={`${CURVES[shape].label} 모양`} />;
}

function CurvePreview({ result, large = false }: { result: CurveResult; large?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    drawPath(ref.current, curveTemplate(result.shape), '#ffffff24', true);
    drawPath(ref.current, result.points, PLAYER_COLORS[result.player], false);
  }, [result]);
  return <canvas ref={ref} className={large ? 'circle-preview large' : 'circle-preview'} aria-label={`참가자 ${result.player + 1}의 ${CURVES[result.shape].label}`} />;
}

function CurveGuide({ shape }: { shape: CurveShape }) {
  const template = curveTemplate(shape, 13);
  const anchors = (shape === 'spiral' ? [0, 4, 8, 12] : [1, 4, 7, 10]).map((index) => template[index]);
  return (
    <div className="orbit-guide" aria-hidden="true">
      {anchors.map((point, index) => <i key={index} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />)}
      <span />
    </div>
  );
}

export default function PerfectCurveGame({ onExit }: { onExit: () => void }) {
  const [players, setPlayers] = useState(4);
  const [shape, setShape] = useState<CurveShape>('circle');
  const [phase, setPhase] = useState<Phase>('setup');
  const [turn, setTurn] = useState(0);
  const [results, setResults] = useState<CurveResult[]>([]);
  const [drawingStarted, setDrawingStarted] = useState(false);
  const [drawingError, setDrawingError] = useState('');
  const pointsRef = useRef<CurvePoint[]>([]);
  const drawingRef = useRef(false);

  const ranked = useMemo(() => rankCurves(results), [results]);
  const buyer = ranked.at(-1);

  function startGame() {
    setShape(CURVE_SHAPES[Math.floor(Math.random() * CURVE_SHAPES.length)]);
    setTurn(0);
    setResults([]);
    setPhase('ready');
  }

  function startDrawing() {
    setDrawingStarted(false);
    setDrawingError('');
    pointsRef.current = [];
    setPhase('drawing');
  }

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (drawingRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    setDrawingStarted(true);
    setDrawingError('');
    pointsRef.current = [pointFromEvent(event)];
    drawPath(event.currentTarget, pointsRef.current, PLAYER_COLORS[turn], true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const point = pointFromEvent(event);
    const previous = pointsRef.current.at(-1)!;
    if (Math.hypot(point.x - previous.x, point.y - previous.y) < 0.004) return;
    pointsRef.current.push(point);
    drawPath(event.currentTarget, pointsRef.current, PLAYER_COLORS[turn], true);
  }

  function finishDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!pathIsLongEnough(pointsRef.current)) {
      pointsRef.current = [];
      drawPath(event.currentTarget, [], PLAYER_COLORS[turn], true);
      setDrawingStarted(false);
      setDrawingError('선이 너무 짧아요. 모양 전체를 한 번에 그려주세요.');
      return;
    }
    setResults((current) => [...current, scoreCurve(turn, shape, pointsRef.current)]);
    setPhase(turn + 1 >= players ? 'result' : 'handoff');
  }

  function nextPlayer() {
    setTurn((current) => current + 1);
    setPhase('ready');
  }

  return (
    <main className="circle-shell">
      <div className="circle-stars" aria-hidden="true" />
      <header className="circle-topbar">
        <div>
          <p>ONE STROKE · ONE CHANCE</p>
          <h1>완벽한 곡선</h1>
        </div>
        <button onClick={onExit}>게임 선택</button>
      </header>

      {phase === 'setup' && (
        <section className="circle-setup">
          <div className="circle-orbit-art" aria-hidden="true">
            <CurveIcon shape="heart" />
            <div className="curve-satellites"><b>○</b><b>◠</b><b>∞</b><b>⌁</b></div>
          </div>
          <p className="circle-kicker">오늘의 곡선은 시작할 때 공개</p>
          <h2>한 붓으로 어디까지<br />완벽해질 수 있을까요?</h2>
          <p className="circle-intro">원·물방울·하트·무한대·나선 중 하나가 나옵니다.<br />가장 닮지 않은 곡선의 주인이 오늘 커피를 삽니다.</p>
          <label className="circle-player-select">
            <span>함께 그릴 사람</span>
            <select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>
              {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}
            </select>
          </label>
          <button className="circle-primary" onClick={startGame}>오늘의 곡선 뽑기</button>
          <div className="circle-rules"><span>① 모두 같은 모양</span><span>② 한 번에</span><span>③ 점수는 마지막에</span></div>
        </section>
      )}

      {phase === 'ready' && (
        <section className="circle-center circle-ready">
          <p className="circle-turn">참가자 {turn + 1} / {players} · 오늘의 곡선</p>
          <div className="curve-challenge" style={{ '--player-color': PLAYER_COLORS[turn] } as React.CSSProperties}>
            <CurveIcon shape={shape} />
          </div>
          <p>{CURVES[shape].hint}</p>
          <h2>{CURVES[shape].label}을 기억하고<br />한 번에 그려주세요</h2>
          <button className="circle-primary" onClick={startDrawing}>모양을 기억했어요</button>
          <small>그리기 화면에서는 기준점만 보입니다.</small>
        </section>
      )}

      {phase === 'drawing' && (
        <section className="circle-drawing">
          <div className="circle-drawing-status">
            <span>참가자 {turn + 1} · {CURVES[shape].label}</span>
            <b>{drawingStarted ? '선을 끊지 마세요' : `${CURVES[shape].label}을 그려주세요`}</b>
            <small>손을 떼는 순간 제출됩니다</small>
          </div>
          <div className={`circle-canvas-wrap ${drawingStarted ? 'drawing' : ''}`} style={{ '--player-color': PLAYER_COLORS[turn] } as React.CSSProperties}>
            <CurveGuide shape={shape} />
            <canvas
              className="circle-canvas"
              data-shape={shape}
              aria-label={`${CURVES[shape].label}을 한 번에 그리는 영역`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={finishDrawing}
              onPointerCancel={finishDrawing}
              onContextMenu={(event) => event.preventDefault()}
            />
          </div>
          <p className="circle-draw-help">{drawingError || CURVES[shape].hint}</p>
        </section>
      )}

      {phase === 'handoff' && (
        <section className="circle-center circle-handoff">
          <div className="sealed-orbit" aria-hidden="true"><span>✦</span></div>
          <p>참가자 {turn + 1}의 곡선 저장 완료</p>
          <h2>아직 점수는 비밀</h2>
          <span>마지막에 모든 곡선을 한꺼번에 공개합니다.</span>
          <button className="circle-primary" onClick={nextPlayer}>참가자 {turn + 2}에게 전달했어요</button>
        </section>
      )}

      {phase === 'result' && buyer && (
        <section className="circle-result">
          <p className="circle-result-label">오늘의 곡선 · {CURVES[shape].label}</p>
          <div className="circle-buyer-card" style={{ '--player-color': PLAYER_COLORS[buyer.player] } as React.CSSProperties}>
            <CurvePreview result={buyer} large />
            <div><span>☕ 오늘 커피 살 사람</span><h2>참가자 {buyer.player + 1}</h2><strong>{buyer.score}<small>점</small></strong></div>
          </div>
          <ol className="circle-ranking">
            {ranked.map((result, index) => (
              <li key={result.player} className={result.player === buyer.player ? 'buyer' : ''}>
                <CurvePreview result={result} />
                <b>{index + 1}</b>
                <span>참가자 {result.player + 1}<small>형태 정확도 {result.accuracy}</small></span>
                <strong>{result.score}</strong>
              </li>
            ))}
          </ol>
          <div className="circle-result-actions">
            <button className="circle-primary" onClick={startGame}>다른 곡선으로 한 판 더</button>
            <button className="circle-secondary" onClick={() => setPhase('setup')}>인원 바꾸기</button>
          </div>
        </section>
      )}
    </main>
  );
}
