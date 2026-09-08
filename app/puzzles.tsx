'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { PLAYER_NAMES } from './game';
import { CAT_PUZZLES, CAT_SIZE, POP_COLS, POP_ROWS, PUZZLE_MS, THREAD_EDGES, catEscaped, hasPopMove, makePopBoard, makeThreads, moveThread, popGroup, rankPuzzles, removePopGroup, slideCat, threadConflicts, variantCat, variantPop, variantThreads, type CatPiece, type Point, type PopTile, type PuzzleKind, type PuzzleScore } from './puzzle-game';

const COLORS = ['#168ad5', '#ff8f45', '#8b6edb', '#28a77a', '#e84d9b', '#d5a317'];
const POP_COLORS = ['#ed5679', '#3e8bdc', '#e4ac26', '#219d85'];
const SYMBOLS = ['♥', '◆', '★', '●'];
const CONFIG = {
  pop: { title: '딱 세 번만 터뜨려', icon: '🧩', kicker: '세 수 앞을 보는 한 판', hook: <>작게 터뜨리고,<br />크게 모아보세요.</>, rule: '같은 색이 2개 이상 붙은 덩어리를 눌러 확인하고, 한 번 더 눌러 터뜨리세요. 위의 블록이 빈자리로 떨어집니다.', rank: '터뜨린 블록 수 → 짧은 시간', tip: '25초 안에 딱 3번 · 대각선은 연결되지 않아요', unit: '개', start: '블록 섞기' },
  untangle: { title: '엉킨 선 풀어라', icon: '🪢', kicker: '복잡한 건 선, 단순한 건 조작', hook: <>점을 옮기면,<br />길이 보일 거예요.</>, rule: '8개의 점을 끌어 14개의 선이 서로 교차하지 않게 만드세요. 바깥으로 벌리기만 해서는 안 풀려요. 판의 안쪽도 활용하세요.', rank: '남은 교차 수가 적을수록 우승 · 모두 풀면 시간 비교', tip: '25초 도전 · 점 8개와 선 14개', unit: '곳', start: '선 엉키기' },
  cat: { title: '고양이 꺼내줘', icon: '🐈', kicker: '상자 사이, 탈출 작전', hook: <>길 좀 비켜줘,<br />집에 갈 시간이야.</>, rule: '상자를 표시된 방향으로 밀어 길을 여세요. 고양이를 오른쪽 출구까지 밀면 구출! 두 번째 방은 조금 더 어렵습니다.', rank: '구출 수 → 구출에 쓴 이동 수 → 구출 시간', tip: '25초 안에 두 마리 · 밀기 한 번이 1수', unit: '마리', start: '구출 준비' },
};

type Outcome = Omit<PuzzleScore, 'player'>;
type Challenge = { pop: PopTile[]; threads: Point[]; flip: boolean };
type TurnProps = { onDone: (result: Outcome) => void };

function useTurnClock(onTimeout: () => void) {
  const [left, setLeft] = useState(PUZZLE_MS);
  const started = useRef(0);
  const timeout = useRef(onTimeout);
  useEffect(() => { timeout.current = onTimeout; });
  useEffect(() => {
    started.current = performance.now();
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, PUZZLE_MS - (performance.now() - started.current));
      setLeft(remaining);
      if (!remaining) { window.clearInterval(timer); timeout.current(); }
    }, 50);
    return () => window.clearInterval(timer);
  }, []);
  const elapsed = () => Math.min(PUZZLE_MS, Math.max(0, performance.now() - started.current));
  return { left, elapsed, expired: () => elapsed() >= PUZZLE_MS };
}

function Clock({ left }: { left: number }) {
  return <div className={`puzzle-clock ${left < 6000 ? 'urgent' : ''}`}><span>남은 시간</span><b>{(left / 1000).toFixed(1)}<small>초</small></b><div><i style={{ width: `${left / PUZZLE_MS * 100}%` }} /></div></div>;
}

function PopTurn({ initial, onDone }: TurnProps & { initial: PopTile[] }) {
  const [board, setBoard] = useState(initial);
  const [selection, setSelection] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [notice, setNotice] = useState('먼저 덩어리를 눌러 크기를 확인하세요.');
  const [gain, setGain] = useState(0);
  const locked = useRef(false);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (finishTimer.current) clearTimeout(finishTimer.current); }, []);
  const score = initial.length - board.length;
  const clock = useTurnClock(() => { if (!locked.current) onDone({ primary: score, moves, elapsedMs: PUZZLE_MS }); });

  function tap(id: number) {
    if (locked.current || clock.expired()) return;
    const group = popGroup(board, id);
    if (!group.length) { setSelection([]); setNotice('같은 색이 가로·세로로 2개 이상 붙어야 해요.'); return; }
    if (!selection.includes(id)) { setSelection(group); setNotice(`${group.length}개 선택! 같은 덩어리를 한 번 더 눌러 확정하세요.`); return; }
    const next = removePopGroup(board, id);
    setBoard(next); setMoves(moves + 1); setSelection([]); setGain(group.length);
    setNotice(`+${group.length}개! 빈자리로 떨어진 블록을 살펴보세요.`);
    if (moves + 1 === 3 || !hasPopMove(next)) {
      locked.current = true;
      const result = { primary: initial.length - next.length, moves: moves + 1, elapsedMs: clock.elapsed() };
      finishTimer.current = setTimeout(() => onDone(result), 550);
    }
  }

  return <><div className="puzzle-metrics"><div><span>터뜨린 블록</span><strong>{score}<small>개</small></strong></div><div className="pop-moves" aria-label={`${3 - moves}번 남음`}>{[0, 1, 2].map((i) => <i key={i} className={i < moves ? 'used' : ''}>{i < moves ? '✓' : i + 1}</i>)}</div><Clock left={clock.left} /></div>
    <div className="pop-board" aria-label="블록 게임판">{Array.from({ length: POP_COLS * POP_ROWS }, (_, i) => <i className="pop-slot" key={i} />)}{board.map((tile) => <button key={tile.id} className={`pop-tile ${selection.includes(tile.id) ? 'selected' : ''} ${selection.length && !selection.includes(tile.id) ? 'unselected' : ''}`} data-tile={tile.id} data-color={tile.color} data-x={tile.x} data-y={tile.y} style={{ '--tile-color': POP_COLORS[tile.color], left: `${tile.x / POP_COLS * 100}%`, top: `${tile.y / POP_ROWS * 100}%`, width: `${100 / POP_COLS}%`, height: `${100 / POP_ROWS}%` } as CSSProperties} onClick={() => tap(tile.id)} disabled={moves >= 3 || clock.left === 0} aria-label={`${tile.y + 1}행 ${tile.x + 1}열 ${['분홍 하트', '파랑 마름모', '노랑 별', '초록 원'][tile.color]} 블록`} aria-pressed={selection.includes(tile.id)}><span>{SYMBOLS[tile.color]}</span></button>)}</div>
    <p className="puzzle-feedback" aria-live="polite" key={`${moves}-${selection[0] ?? 'none'}`}>{notice}</p>
    <div className="puzzle-tip">{gain > 0 ? `방금 +${gain}개 · ` : ''}새 블록은 생기지 않아요. 다음 수까지 생각해 보세요.</div></>;
}

function ThreadTurn({ initial, onDone }: TurnProps & { initial: Point[] }) {
  const [points, setPoints] = useState(initial);
  const [active, setActive] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; pointer: number; offsetX: number; offsetY: number } | null>(null);
  const pointsRef = useRef(initial);
  const conflicts = threadConflicts(points);
  const badEdges = new Set(conflicts.flat());
  const clock = useTurnClock(() => onDone({ primary: threadConflicts(pointsRef.current).length, moves: 0, elapsedMs: PUZZLE_MS }));
  function put(id: number, point: Point) {
    if (clock.expired()) return;
    const next = moveThread(pointsRef.current, id, point);
    pointsRef.current = next; setPoints(next);
  }
  function coordinates(event: ReactPointerEvent) {
    const rect = boardRef.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 400, y: (event.clientY - rect.top) / rect.height * 400 };
  }
  function release(event: ReactPointerEvent, canceled = false) {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null; setActive(null);
    if (!canceled && !clock.expired() && threadConflicts(pointsRef.current).length === 0) onDone({ primary: 0, moves: 0, elapsedMs: clock.elapsed() });
  }
  return <><div className="puzzle-metrics"><div><span>남은 교차</span><strong>{conflicts.length}<small>곳</small></strong></div><div className="thread-status">{conflicts.length === 0 ? '풀렸어요!' : '선을 풀어주세요'}</div><Clock left={clock.left} /></div>
    <div className="thread-board" ref={boardRef} aria-label="엉킨 선 게임판" onPointerMove={(event) => { if (drag.current?.pointer === event.pointerId) { const pos = coordinates(event); put(drag.current.id, { x: pos.x - drag.current.offsetX, y: pos.y - drag.current.offsetY }); } }} onPointerUp={(event) => release(event)} onPointerCancel={(event) => release(event, true)}>
      <svg viewBox="0 0 400 400" aria-hidden="true">{THREAD_EDGES.map(([a, b], i) => <g key={i} className={badEdges.has(i) ? 'tangled' : 'clear'}><line className="thread-shadow" x1={points[a].x} y1={points[a].y} x2={points[b].x} y2={points[b].y} /><line x1={points[a].x} y1={points[a].y} x2={points[b].x} y2={points[b].y} /></g>)}</svg>
      {points.map((point, id) => <button key={id} className={`thread-node ${active === id ? 'active' : ''}`} data-node={id} data-x={point.x} data-y={point.y} style={{ left: `${point.x / 4}%`, top: `${point.y / 4}%` }} aria-label={`${id + 1}번 점, 끌어서 이동. 방향키로도 이동 가능`} onPointerDown={(event) => { if (drag.current || clock.expired()) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); const pos = coordinates(event); drag.current = { id, pointer: event.pointerId, offsetX: pos.x - point.x, offsetY: pos.y - point.y }; setActive(id); }} onKeyDown={(event) => { const delta: Record<string, [number, number]> = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }; if (!delta[event.key]) return; event.preventDefault(); put(id, { x: point.x + delta[event.key][0], y: point.y + delta[event.key][1] }); if (!clock.expired() && threadConflicts(pointsRef.current).length === 0) onDone({ primary: 0, moves: 0, elapsedMs: clock.elapsed() }); }}><span>{id + 1}</span></button>)}
    </div><p className="puzzle-feedback" aria-live="polite">{conflicts.length === 0 ? '손을 떼면 완성!' : '점을 끌어 빨간 선이 서로 만나지 않게 해보세요.'}</p><div className="puzzle-tip"><i className="thread-legend bad" /> 엉킨 선 <i className="thread-legend good" /> 풀린 선 · 연결된 점은 함께 써도 괜찮아요.</div></>;
}

type CatDrag = { id: string; pointer: number; start: number; cell: number; initial: CatPiece[]; delta: number };
function CatTurn({ flip, onDone }: TurnProps & { flip: boolean }) {
  const [room, setRoom] = useState(0);
  const [board, setBoard] = useState(() => variantCat(CAT_PUZZLES[0], flip));
  const [moves, setMoves] = useState(0);
  const [banked, setBanked] = useState({ moves: 0, time: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState('상자의 화살표 방향으로 밀어 길을 만드세요.');
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<CatDrag | null>(null);
  const finished = useRef(false);
  const clock = useTurnClock(() => onDone({ primary: room, moves: banked.moves, elapsedMs: room ? banked.time : PUZZLE_MS }));
  const cat = board.find((piece) => piece.id === 'cat')!;

  function commit(next: CatPiece[], before: CatPiece[]) {
    if (finished.current || clock.expired() || next.every((piece, i) => piece.x === before[i].x && piece.y === before[i].y)) return;
    setBoard(next); setMoves(moves + 1);
    if (catEscaped(next)) {
      const totalMoves = banked.moves + moves + 1;
      const elapsedMs = clock.elapsed();
      if (room === 1) { finished.current = true; onDone({ primary: 2, moves: totalMoves, elapsedMs }); }
      else { setRoom(1); setBanked({ moves: totalMoves, time: elapsedMs }); setMoves(0); setSelected(null); setBoard(variantCat(CAT_PUZZLES[1], !flip)); setNotice('첫 구출 성공! 이번에는 상자가 더 많아요.'); }
    }
  }
  function release(event: ReactPointerEvent, cancel = false) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    drag.current = null;
    if (cancel || clock.expired()) { setBoard(current.initial); return; }
    const next = slideCat(current.initial, current.id, current.delta);
    if (next === current.initial && current.delta) setNotice('다른 상자나 벽에 막혔어요. 길부터 비워주세요.');
    commit(next, current.initial);
  }
  return <><div className="puzzle-metrics"><div><span>구출한 고양이</span><strong>{room}<small>/ 2</small></strong></div><div className="cat-room">{room + 1}번째 방<strong>{moves}수</strong></div><Clock left={clock.left} /></div>
    <div className="cat-stage"><div className="cat-exit" style={{ top: `${(cat.y + .5) / CAT_SIZE * 100}%` }}><span>출구</span>➜</div>
      <div className="cat-board" key={room} ref={boardRef} aria-label={`${room + 1}번째 고양이 방`} onPointerMove={(event) => { const current = drag.current; if (!current || current.pointer !== event.pointerId || clock.expired()) return; const piece = current.initial.find((item) => item.id === current.id)!; current.delta = Math.round(((piece.axis === 'x' ? event.clientX : event.clientY) - current.start) / current.cell); setBoard(slideCat(current.initial, current.id, current.delta)); }} onPointerUp={(event) => release(event)} onPointerCancel={(event) => release(event, true)}>
        {Array.from({ length: 36 }, (_, i) => <i className="cat-cell" key={i} />)}
        {board.map((piece, index) => <button key={piece.id} className={`cat-piece ${piece.id === 'cat' ? 'is-cat' : ''} ${selected === piece.id ? 'selected' : ''} ${piece.axis === 'y' ? 'vertical' : ''}`} data-piece={piece.id} data-x={piece.x} data-y={piece.y} data-size={piece.size} data-axis={piece.axis} style={{ left: `${piece.x / CAT_SIZE * 100}%`, top: `${piece.y / CAT_SIZE * 100}%`, width: `${(piece.axis === 'x' ? piece.size : 1) / CAT_SIZE * 100}%`, height: `${(piece.axis === 'y' ? piece.size : 1) / CAT_SIZE * 100}%`, '--box-color': COLORS[(index + (flip ? 2 : 0)) % COLORS.length] } as CSSProperties} aria-label={piece.id === 'cat' ? '고양이, 오른쪽 출구로 밀기' : `${piece.id} 상자, ${piece.axis === 'x' ? '좌우' : '상하'}로 밀기`} onPointerDown={(event) => { if (drag.current || clock.expired()) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: piece.id, pointer: event.pointerId, start: piece.axis === 'x' ? event.clientX : event.clientY, cell: boardRef.current!.getBoundingClientRect().width / CAT_SIZE, initial: board, delta: 0 }; setSelected(piece.id); }} onKeyDown={(event) => { const delta = piece.axis === 'x' ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 }; const amount = delta[event.key as keyof typeof delta]; if (amount) { event.preventDefault(); commit(slideCat(board, piece.id, amount), board); } }}><span>{piece.id === 'cat' ? '🐈' : piece.id}</span><small>{piece.id === 'cat' ? '➜' : piece.axis === 'x' ? '↔' : '↕'}</small></button>)}
      </div></div><p className="puzzle-feedback" aria-live="polite">{notice}</p><div className="puzzle-tip">놓은 상자는 다시 움직일 수 있어요.<br />상자를 뚫고 지나가거나 회전할 수는 없어요.</div></>;
}

function PuzzleGame({ kind, onExit }: { kind: PuzzleKind; onExit: () => void }) {
  const config = CONFIG[kind];
  const [phase, setPhase] = useState<'setup' | 'ready' | 'play' | 'result' | 'final'>('setup');
  const [players, setPlayers] = useState(2);
  const [player, setPlayer] = useState(0);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [results, setResults] = useState<PuzzleScore[]>([]);
  const finishing = useRef(false);
  const ranked = rankPuzzles(kind, results);
  const result = results.find((item) => item.player === player);
  const finish = useCallback((outcome: Outcome) => {
    if (finishing.current) return;
    finishing.current = true;
    setResults((current) => [...current, { ...outcome, player }]);
    setPhase('result');
  }, [player]);
  function prepare() {
    let board = makePopBoard();
    if (!hasPopMove(board)) board = board.map((tile) => ({ ...tile, color: tile.y % 4 }));
    setChallenge({ pop: board, threads: makeThreads(), flip: Math.random() > .5 });
    setResults([]); setPlayer(0); setPhase('ready');
  }
  function next() { if (player + 1 === players) setPhase('final'); else { setPlayer(player + 1); setPhase('ready'); } }
  const describe = (score: PuzzleScore) => kind === 'cat' ? `${score.primary ? `구출에 ${score.moves}수 · ${(score.elapsedMs / 1000).toFixed(1)}초` : '다음에는 길을 열 수 있을 거예요'}` : kind === 'untangle' && score.primary > 0 ? '시간 종료 · 교차 수로 비교' : `${(score.elapsedMs / 1000).toFixed(1)}초${kind === 'pop' ? ` · ${score.moves}번 터뜨림` : ' · 모두 풀었어요'}`;
  return <main className={`puzzle-shell puzzle-${kind}`} style={{ '--puzzle-player': COLORS[player] } as CSSProperties}>
    <header className="puzzle-topbar"><div><p>COFFEE BREAK · STRATEGY</p><h1>{config.title}</h1></div><button onClick={onExit}>게임 선택</button></header>
    {phase === 'setup' && <section className="puzzle-setup"><div className="puzzle-hero" aria-hidden="true">{config.icon}</div><p className="puzzle-kicker">{config.kicker}</p><h2>{config.hook}</h2><p>{config.rule}</p><div className="puzzle-rule"><strong>어떻게 순위를 정하나요?</strong><span>{config.rank}</span></div><label className="puzzle-players">참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}명</option>)}</select></label><button className="puzzle-primary" onClick={prepare}>{config.start}</button><p className="puzzle-fine">{config.tip}<br />스마트폰 한 대 · 소리 없이 진행</p></section>}
    {phase === 'ready' && <section className="puzzle-ready"><span className="puzzle-player-badge">{player + 1}</span><p>{player + 1} / {players}번째 도전</p><h2>{PLAYER_NAMES[player]} 차례</h2><p>준비되면 시작하세요.<br />다른 사람은 화면을 보지 않기!</p><div className="puzzle-rule"><span>모두 같은 난이도 · 색이나 방향만 달라져요.</span><strong>{config.tip}</strong></div><button className="puzzle-primary" onClick={() => { finishing.current = false; setPhase('play'); }}>25초 시작</button></section>}
    {phase === 'play' && challenge && <section className="puzzle-play"><div className="puzzle-turn"><i /><strong>{PLAYER_NAMES[player]}의 차례</strong><span>{player + 1} / {players}</span></div>{kind === 'pop' ? <PopTurn key={player} initial={variantPop(challenge.pop, player)} onDone={finish} /> : kind === 'untangle' ? <ThreadTurn key={player} initial={variantThreads(challenge.threads, player)} onDone={finish} /> : <CatTurn key={player} flip={challenge.flip !== Boolean(player % 2)} onDone={finish} />}</section>}
    {phase === 'result' && result && <section className="puzzle-result"><div className="puzzle-hero">{kind === 'untangle' && result.primary === 0 || kind === 'cat' && result.primary === 2 ? '✨' : config.icon}</div><p>{PLAYER_NAMES[player]}의 기록</p><h2>{result.primary}<small>{kind === 'untangle' ? '곳 남음' : kind === 'cat' ? '마리 구출' : '개 터뜨림'}</small></h2><p>{describe(result)}</p><div className="puzzle-rule"><span>{config.rank}</span></div><button className="puzzle-primary" onClick={next}>{player + 1 < players ? '화면 가리고 넘기기' : '최종 순위 보기'}</button></section>}
    {phase === 'final' && <section className="puzzle-final"><p className="puzzle-kicker">모두의 도전이 끝났어요</p><h2>오늘의 순위</h2><p>{config.rank}</p><ol>{ranked.map((item) => <li key={item.player} style={{ '--puzzle-player': COLORS[item.player] } as CSSProperties}><b>{item.rank}<small>위</small></b><i /><div><strong>{PLAYER_NAMES[item.player]}</strong><small>{describe(item)}</small></div><em>{item.primary}<small>{config.unit}</small></em></li>)}</ol>{ranked.some((item, i) => i > 0 && item.rank === ranked[i - 1].rank) && <p className="puzzle-fine">같은 기록은 공동 순위입니다. 동점 결판은 한 판 더!</p>}<button className="puzzle-primary" onClick={prepare}>새 판으로 한 번 더</button><button className="puzzle-secondary" onClick={() => setPhase('setup')}>인원 바꾸기</button><button className="puzzle-secondary" onClick={onExit}>게임 선택으로</button></section>}
  </main>;
}

export function PopGame(props: { onExit: () => void }) { return <PuzzleGame kind="pop" {...props} />; }
export function UntangleGame(props: { onExit: () => void }) { return <PuzzleGame kind="untangle" {...props} />; }
export function CatGame(props: { onExit: () => void }) { return <PuzzleGame kind="cat" {...props} />; }
