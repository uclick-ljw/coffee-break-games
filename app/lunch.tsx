'use client';
import { ResultVerdict } from './result-verdict';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { PLAYER_NAMES } from './game';
import { LUNCH_FOODS, LUNCH_HEIGHT, LUNCH_LAYOUTS, LUNCH_PICK_COUNT, LUNCH_TURN_MS, LUNCH_WIDTH, foodRect, isValidLunchPlacement, lunchResult, pickLunchFoods, pickLunchLayout, rankLunchResults, type LunchPlacement, type LunchResult } from './lunch-game';

type Phase = 'setup' | 'ready' | 'play' | 'result' | 'final';
type DragState = { id: string; startX: number; startY: number; clientX: number; clientY: number; moved: boolean; rotated: boolean; boardLeft: number; boardTop: number; boardWidth: number; boardHeight: number };

const COLORS = ['#168ad5', '#ff8f45', '#8b6edb', '#28a77a', '#e84d9b', '#e6b81e'];

export default function LunchGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [player, setPlayer] = useState(0);
  const [foods, setFoods] = useState(LUNCH_FOODS.slice(0, LUNCH_PICK_COUNT));
  const [layout, setLayout] = useState(LUNCH_LAYOUTS[0]);
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
    dragRef.current = null;
    setDrag(null);
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
    setFoods(pickLunchFoods());
    setLayout(pickLunchLayout());
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
    if (phase !== 'play' || finishingRef.current) return;
    const placed = placements.find((item) => item.id === id);
    if (!placed) {
      setTrayRotations((current) => ({ ...current, [id]: !current[id] }));
      return;
    }
    const rotated = { ...placed, rotated: !placed.rotated };
    if (isValidLunchPlacement(rotated, placements, layout.dividers)) setPlacements((current) => current.map((item) => item.id === id ? rotated : item));
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
    const board = boardRef.current;
    if (!board) return;
    const bounds = board.getBoundingClientRect();
    const rotated = placements.find((item) => item.id === id)?.rotated ?? Boolean(trayRotations[id]);
    const next = { id, startX: event.clientX, startY: event.clientY, clientX: event.clientX, clientY: event.clientY, moved: false, rotated, boardLeft: bounds.left + board.clientLeft, boardTop: bounds.top + board.clientTop, boardWidth: board.clientWidth, boardHeight: board.clientHeight };
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
    if (!active || phase !== 'play' || finishingRef.current) return;
    dragRef.current = null;
    setDrag(null);
    if (!active.moved && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) <= 6) {
      rotateFood(active.id);
      return;
    }
    if (!insideBoard(active, event.clientX, event.clientY)) {
      rejectDrop(active.id);
      return;
    }
    const candidate = placementAt(active, event.clientX, event.clientY);
    if (!isValidLunchPlacement(candidate, placements, layout.dividers)) {
      rejectDrop(active.id);
      return;
    }
    setPlacements((current) => [...current.filter((item) => item.id !== active.id), candidate]);
  }

  function insideBoard(active: DragState, clientX = active.clientX, clientY = active.clientY) {
    return clientX >= active.boardLeft && clientX <= active.boardLeft + active.boardWidth && clientY >= active.boardTop && clientY <= active.boardTop + active.boardHeight;
  }

  function placementAt(active: DragState, clientX = active.clientX, clientY = active.clientY): LunchPlacement {
    const food = LUNCH_FOODS.find((item) => item.id === active.id)!;
    const width = active.rotated ? food.height : food.width;
    const height = active.rotated ? food.width : food.height;
    return { id: active.id, x: (clientX - active.boardLeft) / active.boardWidth * LUNCH_WIDTH - width / 2, y: (clientY - active.boardTop) / active.boardHeight * LUNCH_HEIGHT - height / 2, rotated: active.rotated };
  }

  function foodButton(food: (typeof LUNCH_FOODS)[number], placement?: LunchPlacement) {
    const rotated = placement?.rotated ?? Boolean(trayRotations[food.id]);
    const rect = placement ? foodRect(placement) : null;
    const style = placement && rect ? {
      left: `${rect.x / LUNCH_WIDTH * 100}%`, top: `${rect.y / LUNCH_HEIGHT * 100}%`,
      width: `${rect.width / LUNCH_WIDTH * 100}%`, height: `${rect.height / LUNCH_HEIGHT * 100}%`,
      '--food-color': food.color,
    } as CSSProperties : {
      '--food-color': food.color,
      '--food-preview-width': `${Math.max(32, (rotated ? food.height : food.width) * .55)}px`,
      '--food-preview-height': `${Math.max(30, (rotated ? food.width : food.height) * .55)}px`,
    } as CSSProperties;
    return <button key={food.id} className={`lunch-food ${placement ? 'placed' : ''} ${invalidId === food.id ? 'invalid' : ''} ${drag?.id === food.id ? 'dragging' : ''}`} style={style} onPointerDown={(event) => startDrag(event, food.id)} aria-label={`${food.name} · ${placement ? '도시락 안' : '대기 중'} · 누르면 회전`}><span>{food.emoji}</span><small>{food.name}</small></button>;
  }

  const ghostFood = drag ? LUNCH_FOODS.find((food) => food.id === drag.id) : null;
  const ghostRotated = drag?.rotated ?? false;
  const dropPreview = drag ? placementAt(drag) : null;
  const dropPreviewRect = dropPreview ? foodRect(dropPreview) : null;
  const dropPreviewValid = Boolean(drag && dropPreview && insideBoard(drag) && isValidLunchPlacement(dropPreview, placements, layout.dividers));
  const ghostStyle = drag && ghostFood ? {
    left: drag.clientX,
    top: drag.clientY,
    width: `${(ghostRotated ? ghostFood.height : ghostFood.width) / LUNCH_WIDTH * drag.boardWidth}px`,
    height: `${(ghostRotated ? ghostFood.width : ghostFood.height) / LUNCH_HEIGHT * drag.boardHeight}px`,
    '--food-color': ghostFood.color,
  } as CSSProperties : undefined;
  const dropPreviewStyle = dropPreviewRect && ghostFood ? {
    left: `${dropPreviewRect.x / LUNCH_WIDTH * 100}%`, top: `${dropPreviewRect.y / LUNCH_HEIGHT * 100}%`,
    width: `${dropPreviewRect.width / LUNCH_WIDTH * 100}%`, height: `${dropPreviewRect.height / LUNCH_HEIGHT * 100}%`,
    '--food-color': ghostFood.color,
  } as CSSProperties : undefined;

  return <main className="lunch-shell">
    <header className="lunch-topbar"><div><p>PACK · ROTATE · FIT</p><h1>도시락 빈틈없이</h1></div><button onClick={onExit}>게임 선택</button></header>

    {phase === 'setup' && <section className="lunch-setup">
      <div className="lunch-hero" aria-hidden="true"><span>🍱</span><i>🍙</i><i>🥟</i><i>🍅</i></div>
      <p className="lunch-kicker">25초 도시락 포장 대결</p>
      <h2>빈틈은 줄이고,<br />맛있는 건 더 많이!</h2>
      <p>음식을 끌어 담고 짧게 눌러 회전하세요.<br />채운 면적이 넓을수록 높은 순위입니다.</p>
      <p className="ranking-rule">채운 면적 → 빠른 제출 순서 · 같은 기록은 공동 순위</p>
      <label>참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
      <button className="lunch-primary" onClick={startGame}>도시락 싸기 시작</button>
      <div className="lunch-rules"><span>☝️ 드래그 배치</span><span>↻ 눌러서 회전</span><span>🏆 면적 우선</span></div>
    </section>}

    {phase === 'ready' && <section className="lunch-ready"><div className="lunch-ready-card" style={{ '--lunch-player': COLORS[player] } as CSSProperties}><span>🍱</span><small>{player + 1}/{players}번째 포장</small><h2>{PLAYER_NAMES[player]} 준비</h2><p>다른 사람은 화면을 보지 마세요.<br />시작하면 25초가 흐릅니다.</p><button className="lunch-primary" onClick={beginTurn}>25초 시작</button></div></section>}

    {phase === 'play' && <section className="lunch-play" style={{ '--lunch-player': COLORS[player] } as CSSProperties} onPointerMove={moveDrag} onPointerUp={endDrag} onMouseMove={moveDrag} onMouseUp={endDrag} onPointerCancel={() => { dragRef.current = null; setDrag(null); }}>
      <div className="lunch-status"><i /><div><small>{PLAYER_NAMES[player]} · {player + 1}/{players} · {layout.name}</small><strong>채운 면적 {(lunchResult(player, placements, 0).area / (LUNCH_WIDTH * LUNCH_HEIGHT) * 100).toFixed(1)}%</strong></div><b>{(timeLeft / 1000).toFixed(1)}<small>초</small></b></div>
      <div className="lunch-board" ref={boardRef} aria-label={layout.name}><div className="lunch-rice" />{layout.dividers.map((divider, index) => <div key={index} className={`lunch-divider ${divider.width > divider.height ? 'horizontal' : 'vertical'}`} style={{ left: `${divider.x / LUNCH_WIDTH * 100}%`, top: `${divider.y / LUNCH_HEIGHT * 100}%`, width: `${divider.width / LUNCH_WIDTH * 100}%`, height: `${divider.height / LUNCH_HEIGHT * 100}%` }} />)}{placements.map((placement) => foodButton(LUNCH_FOODS.find((food) => food.id === placement.id)!, placement))}{drag?.moved && insideBoard(drag) && dropPreviewRect && ghostFood && <div className={`lunch-drop-preview ${dropPreviewValid ? 'valid' : 'invalid'}`} style={dropPreviewStyle} aria-hidden="true"><span>{ghostFood.emoji}</span></div>}</div>
      <p className="lunch-tip">음식을 끌어 담기 · 짧게 눌러 회전</p>
      <div className="lunch-tray">{foods.filter((food) => !placements.some((placement) => placement.id === food.id)).map((food) => foodButton(food))}</div>
      <button className="lunch-submit" onClick={() => completeTurn()}>이대로 도시락 제출</button>
      {drag?.moved && ghostFood && !insideBoard(drag) && <div className="lunch-ghost" style={ghostStyle}><span>{ghostFood.emoji}</span></div>}
    </section>}

    {phase === 'result' && currentResult && <section className="lunch-result"><div className="lunch-result-box"><span>🍱</span><small>{PLAYER_NAMES[player]}의 도시락</small><h2>{(currentResult.area / (LUNCH_WIDTH * LUNCH_HEIGHT) * 100).toFixed(1)}<b>%</b></h2><p>채운 면적 · {currentResult.score}점 · 반찬 {currentResult.placed}/{foods.length}개</p><button className="lunch-primary" onClick={continueGame}>{player + 1 < players ? '화면 가리고 넘기기' : '최종 순위 보기'}</button></div></section>}

    {phase === 'final' && payer && <section className="lunch-final"><div className="lunch-payer"><span>☕</span><ResultVerdict results={ranked} /><strong>채운 면적 {(payer.area / (LUNCH_WIDTH * LUNCH_HEIGHT) * 100).toFixed(1)}% · {payer.score}점</strong></div><ol>{ranked.map((result) => <li key={result.player}><span>{result.rank}</span><i style={{ background: COLORS[result.player] }} /><div><strong>{PLAYER_NAMES[result.player]}</strong><small>{result.placed}/{foods.length}개 · {(result.elapsedMs / 1000).toFixed(1)}초</small></div><b>{result.score}점</b></li>)}</ol><button className="lunch-primary" onClick={startGame}>새 도시락 한 판 더</button><button className="lunch-secondary" onClick={onExit}>게임 선택으로</button></section>}
  </main>;
}
