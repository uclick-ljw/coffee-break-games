'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { pathIsLongEnough, rankCircles, scoreCircle, type CirclePoint, type CircleResult } from './circle-game';

type Phase = 'setup' | 'ready' | 'drawing' | 'handoff' | 'result';

const PLAYER_COLORS = ['#8ffcff', '#ff8bca', '#ffd86f', '#a9ff72', '#b7a1ff', '#ff936b'];

function drawPath(canvas: HTMLCanvasElement, points: CirclePoint[], color: string, clear = true) {
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
  context.lineWidth = Math.max(4, rect.width * 0.014);
  context.strokeStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 16;
  context.stroke();
}

function CirclePreview({ result, large = false }: { result: CircleResult; large?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawPath(ref.current, result.points, PLAYER_COLORS[result.player], true);
  }, [result]);
  return <canvas ref={ref} className={large ? 'circle-preview large' : 'circle-preview'} aria-label={`참가자 ${result.player + 1}의 원`} />;
}

export default function PerfectCircleGame({ onExit }: { onExit: () => void }) {
  const [players, setPlayers] = useState(4);
  const [phase, setPhase] = useState<Phase>('setup');
  const [turn, setTurn] = useState(0);
  const [results, setResults] = useState<CircleResult[]>([]);
  const [drawingStarted, setDrawingStarted] = useState(false);
  const [drawingError, setDrawingError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<CirclePoint[]>([]);
  const drawingRef = useRef(false);

  const ranked = useMemo(() => rankCircles(results), [results]);
  const buyer = ranked.at(-1);

  function startGame() {
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
      setDrawingError('원이 너무 짧아요. 한 바퀴를 이어서 그려주세요.');
      return;
    }
    const result = scoreCircle(turn, pointsRef.current);
    setResults((current) => [...current, result]);
    setPhase(turn + 1 >= players ? 'result' : 'handoff');
  }

  function nextPlayer() {
    setTurn((current) => current + 1);
    setPhase('ready');
  }

  function replay() {
    setTurn(0);
    setResults([]);
    setPhase('ready');
  }

  return (
    <main className="circle-shell">
      <div className="circle-stars" aria-hidden="true" />
      <header className="circle-topbar">
        <div>
          <p>ONE STROKE · ONE CHANCE</p>
          <h1>완벽한 원</h1>
        </div>
        <button onClick={onExit}>게임 선택</button>
      </header>

      {phase === 'setup' && (
        <section className="circle-setup">
          <div className="circle-orbit-art" aria-hidden="true"><i /><i /><span>○</span></div>
          <p className="circle-kicker">손끝으로 그리는 단 한 번의 궤도</p>
          <h2>누가 가장 완벽한 원을<br />그릴 수 있을까요?</h2>
          <p className="circle-intro">가운데 별을 감싸듯 한 번에 그리세요.<br />가장 찌그러진 원의 주인이 오늘 커피를 삽니다.</p>
          <label className="circle-player-select">
            <span>함께 그릴 사람</span>
            <select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>
              {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}
            </select>
          </label>
          <button className="circle-primary" onClick={startGame}>그리기 시작</button>
          <div className="circle-rules"><span>① 한 번에</span><span>② 손 떼면 끝</span><span>③ 점수는 마지막에</span></div>
        </section>
      )}

      {phase === 'ready' && (
        <section className="circle-center circle-ready">
          <p className="circle-turn">참가자 {turn + 1} / {players}</p>
          <div className="circle-ready-ring" style={{ '--player-color': PLAYER_COLORS[turn] } as React.CSSProperties}><span>{turn + 1}</span></div>
          <p>다른 사람은 잠시 눈을 돌려주세요</p>
          <h2>한 번에 둥글게,<br />손을 떼면 끝!</h2>
          <button className="circle-primary" onClick={startDrawing}>준비됐어요</button>
          <small>휴대폰을 참가자 {turn + 1}에게 건넨 뒤 눌러주세요.</small>
        </section>
      )}

      {phase === 'drawing' && (
        <section className="circle-drawing">
          <div className="circle-drawing-status">
            <span>참가자 {turn + 1}</span>
            <b>{drawingStarted ? '선을 끊지 마세요' : '원을 그려주세요'}</b>
            <small>손을 떼는 순간 제출됩니다</small>
          </div>
          <div className={`circle-canvas-wrap ${drawingStarted ? 'drawing' : ''}`} style={{ '--player-color': PLAYER_COLORS[turn] } as React.CSSProperties}>
            <div className="orbit-guide" aria-hidden="true"><i /><i /><i /><i /><span /></div>
            <canvas
              ref={canvasRef}
              className="circle-canvas"
              aria-label="가운데 별을 감싸는 원을 한 번에 그리는 영역"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={finishDrawing}
              onPointerCancel={finishDrawing}
              onContextMenu={(event) => event.preventDefault()}
            />
          </div>
          <p className="circle-draw-help">{drawingError || '네 개의 작은 별을 지나도록 크게 그려보세요.'}</p>
        </section>
      )}

      {phase === 'handoff' && (
        <section className="circle-center circle-handoff">
          <div className="sealed-orbit" aria-hidden="true"><span>✦</span></div>
          <p>참가자 {turn + 1}의 궤도 저장 완료</p>
          <h2>아직 점수는 비밀</h2>
          <span>마지막에 모든 원을 한꺼번에 공개합니다.</span>
          <button className="circle-primary" onClick={nextPlayer}>참가자 {turn + 2}에게 전달했어요</button>
        </section>
      )}

      {phase === 'result' && buyer && (
        <section className="circle-result">
          <p className="circle-result-label">모든 궤도가 열렸습니다</p>
          <div className="circle-buyer-card" style={{ '--player-color': PLAYER_COLORS[buyer.player] } as React.CSSProperties}>
            <CirclePreview result={buyer} large />
            <div><span>☕ 오늘 커피 살 사람</span><h2>참가자 {buyer.player + 1}</h2><strong>{buyer.score}<small>점</small></strong></div>
          </div>
          <ol className="circle-ranking">
            {ranked.map((result, index) => (
              <li key={result.player} className={result.player === buyer.player ? 'buyer' : ''}>
                <CirclePreview result={result} />
                <b>{index + 1}</b>
                <span>참가자 {result.player + 1}<small>원형도 {result.roundness} · 닫힘 {result.closure}</small></span>
                <strong>{result.score}</strong>
              </li>
            ))}
          </ol>
          <div className="circle-result-actions">
            <button className="circle-primary" onClick={replay}>한 판 더 그리기</button>
            <button className="circle-secondary" onClick={() => setPhase('setup')}>인원 바꾸기</button>
          </div>
        </section>
      )}
    </main>
  );
}
