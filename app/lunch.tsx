'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { PLAYER_NAMES } from './game';
import { LUNCH_FOODS, LUNCH_HEIGHT, LUNCH_TURN_MS, LUNCH_WIDTH, foodRect, isValidLunchPlacement, lunchResult, rankLunchResults, type LunchPlacement, type LunchResult } from './lunch-game';

type Phase = 'setup' | 'ready' | 'play' | 'result' | 'final';
type DragState = { id: string; startX: number; startY: number; clientX: number; clientY: number; moved: boolean };

const COLORS = ['#168ad5', '#ff8f45', '#8b6edb', '#28a77a', '#e84d9b', '#e6b81e'];

export default function LunchGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [player, setPlayer] = useState(0);
  const [placements, setPlacements] = useState<LunchPlacement[]>([]);
  const [trayRotations, setTrayRotations] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [invalidId, setInvalidId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(LUNCH_TURN_MS);
  const [results, setResults] = useState<LunchResult[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const startedAtRef = useRef(0);
  const placementsRef = useRef(placements);
  const finishingRef = useRef(false);

  const ranked = useMemo(() => rankLunchResults(results), [results]);
  const payer = ranked.at(-1);
  const currentResult = results.find((result) => result.player === player);

  const completeTurn = useCallback((forcedElapsed?: number) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const elapsed = forcedElapsed ?? Math.min(LUNCH_TURN_MS, performance.now() - startedAtRef.current);
    setResults((current) => [...current, lunchResult(player, placementsRef.current, elapsed)]);
    setPhase('result');
  }, [player]);

  useEffect(() => { placementsRef.current = placements; }, [placements]);

  useEffect(() => {
    if (phase !== 'play') return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, LUNCH_TURN_MS - (performance.now() - startedAtRef.current));
      setTimeLeft(left);
      if (left === 0) completeTurn(LUNCH_TURN_MS);
    }, 50);
    return () => window.clearInterval(timer);
  }, [phase, completeTurn]);

  function startGame() {
    setPlayer(0);
    setResults([]);
    setPlacements([]);
    setTrayRotations({});
    setPhase('ready');
  }

  function beginTurn() {
    finishingRef.current = false;
    setPlacements([]);
    setTrayRotations({});
    setTimeLeft(LUNCH_TURN_MS);
    startedAtRef.current = performance.now();
    setPhase('play');
  }

  function continueGame() {
    if (player + 1 < players) {
      setPlayer((current) => current + 1);
      setPlacements([]);
      setTrayRotations({});
      setPhase('ready');
    } else setPhase('final');
  }

  function rotateFood(id: string) {
    const placed = placements.find((item) => item.id === id);
    if (!placed) {
      setTrayRotations((current) => ({ ...current, [id]: !current[id] }));
      return;
    }
    const rotated = { ...placed, rotated: !placed.rotated };
    if (isValidLunchPlacement(rotated, placements)) setPlacements((current) => current.map((item) => item.id === id ? rotated : item));
    else rejectDrop(id);
  }

  function rejectDrop(id: string) {
    setInvalidId(id);
    window.setTimeout(() => setInvalidId((current) => current === id ? null : current), 350);
  }

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (phase !== 'play') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = { id, startX: event.clientX, startY: event.clientY, clientX: event.clientX, clientY: event.clientY, moved: false };
    dragRef.current = next;
    setDrag(next);
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement> | ReactMouseEvent<HTMLElement>) {
    const current = dragRef.current;
    if (!current) return;
    const next = { ...current, clientX: event.clientX, clientY: event.clientY, moved: current.moved || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 6 };
    dragRef.current = next;
    setDrag(next);
  }

  function endDrag(event: ReactPointerEvent<HTMLElement> | ReactMouseEvent<HTMLElement>) {
    const active = dragRef.current;
    if (!active) return;
    dragRef.current = null;
    setDrag(null);
    if (!active.moved && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) <= 6) {
      rotateFood(active.id);
      return;
    }
    const board = boardRef.current?.getBoundingClientRect();
    if (!board || event.clientX < board.left || event.clientX > board.right || event.clientY < board.top || event.clientY > board.bottom) {
      rejectDrop(active.id);
      return;
    }
    const old = placements.find((item) => item.id === active.id);
    const rotated = old?.rotated ?? Boolean(trayRotations[active.id]);
    const food = LUNCH_FOODS.find((item) => item.id === active.id)!;
    const width = rotated ? food.height : food.width;
    const height = rotated ? food.width : food.height;
    const candidate = {
      id: active.id,
      x: (event.clientX - board.left) / board.width * LUNCH_WIDTH - width / 2,
      y: (event.clientY - board.top) / board.height * LUNCH_HEIGHT - height / 2,
      rotated,
    };
    if (!isValidLunchPlacement(candidate, placements)) {
      rejectDrop(active.id);
      return;
    }
    setPlacements((current) => [...current.filter((item) => item.id !== active.id), candidate]);
  }

  function foodButton(food: (typeof LUNCH_FOODS)[number], placement?: LunchPlacement) {
    const rotated = placement?.rotated ?? Boolean(trayRotations[food.id]);
    const rect = placement ? foodRect(placement) : null;
    const style = placement && rect ? {
      left: `${rect.x / LUNCH_WIDTH * 100}%`, top: `${rect.y / LUNCH_HEIGHT * 100}%`,
      width: `${rect.width / LUNCH_WIDTH * 100}%`, height: `${rect.height / LUNCH_HEIGHT * 100}%`,
      '--food-color': food.color,
    } as CSSProperties : { '--food-color': food.color, '--food-ratio': `${(rotated ? food.height : food.width) / (rotated ? food.width : food.height)}` } as CSSProperties;
    return <button key={food.id} className={`lunch-food ${placement ? 'placed' : ''} ${invalidId === food.id ? 'invalid' : ''} ${drag?.id === food.id ? 'dragging' : ''}`} style={style} onPointerDown={(event) => startDrag(event, food.id)} aria-label={`${food.name} · ${placement ? '도시락 안' : '대기 중'} · 누르면 회전`}><span>{food.emoji}</span><small>{food.name}</small></button>;
  }

  const ghostFood = drag ? LUNCH_FOODS.find((food) => food.id === drag.id) : null;

  return <main className="lunch-shell">
    <header className="lunch-topbar"><div><p>PACK · ROTATE · FIT</p><h1>도시락 빈틈없이</h1></div><button onClick={onExit}>게임 선택</button></header>

    {phase === 'setup' && <section className="lunch-setup">
      <div className="lunch-hero" aria-hidden="true"><span>🍱</span><i>🍙</i><i>🥟</i><i>🍅</i></div>
      <p className="lunch-kicker">25초 도시락 포장 대결</p>
      <h2>빈틈은 줄이고,<br />맛있는 건 더 많이!</h2>
      <p>음식을 끌어 담고 짧게 눌러 회전하세요.<br />채운 면적이 넓을수록 높은 순위입니다.</p>
      <label>참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
      <button className="lunch-primary" onClick={startGame}>도시락 싸기 시작</button>
      <div className="lunch-rules"><span>☝️ 드래그 배치</span><span>↻ 눌러서 회전</span><span>🏆 면적 우선</span></div>
    </section>}

    {phase === 'ready' && <section className="lunch-ready"><div className="lunch-ready-card" style={{ '--lunch-player': COLORS[player] } as CSSProperties}><span>🍱</span><small>{player + 1}/{players}번째 포장</small><h2>{PLAYER_NAMES[player]} 준비</h2><p>다른 사람은 화면을 보지 마세요.<br />시작하면 25초가 흐릅니다.</p><button className="lunch-primary" onClick={beginTurn}>25초 시작</button></div></section>}

    {phase === 'play' && <section className="lunch-play" style={{ '--lunch-player': COLORS[player] } as CSSProperties} onPointerMove={moveDrag} onPointerUp={endDrag} onMouseMove={moveDrag} onMouseUp={endDrag} onPointerCancel={() => { dragRef.current = null; setDrag(null); }}>
      <div className="lunch-status"><i /><div><small>{PLAYER_NAMES[player]} · {player + 1}/{players}</small><strong>{placements.length}/11개 담았습니다</strong></div><b>{(timeLeft / 1000).toFixed(1)}<small>초</small></b></div>
      <div className="lunch-board" ref={boardRef} aria-label="세 칸 도시락"><div className="lunch-rice" /><div className="lunch-divider vertical" /><div className="lunch-divider horizontal" />{placements.map((placement) => foodButton(LUNCH_FOODS.find((food) => food.id === placement.id)!, placement))}</div>
      <p className="lunch-tip">음식을 끌어 담기 · 짧게 눌러 회전</p>
      <div className="lunch-tray">{LUNCH_FOODS.filter((food) => !placements.some((placement) => placement.id === food.id)).map((food) => foodButton(food))}</div>
      <button className="lunch-submit" onClick={() => completeTurn()}>이대로 도시락 제출</button>
      {drag?.moved && ghostFood && <div className="lunch-ghost" style={{ left: drag.clientX, top: drag.clientY, background: ghostFood.color }}><span>{ghostFood.emoji}</span></div>}
    </section>}

    {phase === 'result' && currentResult && <section className="lunch-result"><div className="lunch-result-box"><span>🍱</span><small>{PLAYER_NAMES[player]}의 도시락</small><h2>{currentResult.placed}<b>/11개</b></h2><p>채운 면적 {Math.round(currentResult.area / (LUNCH_WIDTH * LUNCH_HEIGHT) * 100)}% · {currentResult.score}점</p><button className="lunch-primary" onClick={continueGame}>{player + 1 < players ? '화면 가리고 넘기기' : '최종 순위 보기'}</button></div></section>}

    {phase === 'final' && payer && <section className="lunch-final"><div className="lunch-payer"><span>☕</span><p>오늘의 커피 담당</p><h2>{PLAYER_NAMES[payer.player]}</h2><strong>{payer.placed}/11개 · {payer.score}점</strong></div><ol>{ranked.map((result, index) => <li key={result.player}><span>{index + 1}</span><i style={{ background: COLORS[result.player] }} /><div><strong>{PLAYER_NAMES[result.player]}</strong><small>{result.placed}/11개 · {(result.elapsedMs / 1000).toFixed(1)}초</small></div><b>{result.score}점</b></li>)}</ol><button className="lunch-primary" onClick={startGame}>새 도시락 한 판 더</button><button className="lunch-secondary" onClick={onExit}>게임 선택으로</button></section>}
  </main>;
}
