'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PLAYER_NAMES } from './game';
import { DOMINO, DOMINO_MS, canPlaceDomino, createDominoEngine, dominoYaw, makeDominoBoard, placedDominoes, rankDominoes, type DominoBoard, type DominoEngine, type DominoPlacement, type DominoPose, type DominoScore } from './domino-game';

const COLORS = ['#168ad5', '#ff8f45', '#8b6edb', '#28a77a', '#e84d9b', '#d5a317'];
const W = 480, H = 380;
function project(x: number, y: number, z: number) { return { x: W / 2 + x * 29, y: 339 - z * 27 - y * 23 }; }
function markerPosition(slot: DominoBoard['slots'][number]) {
  const p = project(slot.x, .05, slot.z);
  if (slot.id % 3 === 0) return { x: p.x, y: p.y - 23 };
  if (slot.id % 3 === 2) return { x: p.x + Math.sign(slot.x) * 30, y: p.y + 13 };
  return { x: p.x, y: p.y - 3 };
}
function poses(board: DominoBoard, placements: DominoPlacement[]): DominoPose[] {
  return placedDominoes(board, placements).map((piece) => ({ ...piece, y: DOMINO.height / 2, q: dominoYaw(piece.yaw), fallen: false }));
}
function vertex(pose: DominoPose, x: number, y: number, z: number) {
  const q = pose.q;
  const tx = 2 * (q.y * z - q.z * y), ty = 2 * (q.z * x - q.x * z), tz = 2 * (q.x * y - q.y * x);
  return { x: pose.x + x + q.w * tx + q.y * tz - q.z * ty, y: pose.y + y + q.w * ty + q.z * tx - q.x * tz, z: pose.z + z + q.w * tz + q.x * ty - q.y * tx };
}
function draw(canvas: HTMLCanvasElement, pieces: DominoPose[], board: DominoBoard, selected: number | undefined, building: boolean, lens = false) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const height = H, dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== W * dpr || canvas.height !== height * dpr) { canvas.width = W * dpr; canvas.height = height * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, height);
  ctx.fillStyle = '#102b36'; ctx.fillRect(0, 0, W, height);
  const slot = board.slots.find((item) => item.id === selected);
  const focus = slot ? project(slot.x, .25, slot.z) : { x: 240, y: 240 };
  const view = (x: number, y: number, z: number) => { const p = project(x, y, z); return lens ? { x: 240 + (p.x - focus.x) * 3.2, y: 200 + (p.y - focus.y) * 3.2 } : p; };
  const polygon = (points: { x: number; y: number }[], fill: string, stroke?: string) => {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .65; ctx.stroke(); }
  };
  polygon([[-7.8, -.5], [7.8, -.5], [7.8, 11], [-7.8, 11]].map(([x, z]) => view(x, -.02, z)), '#183e48', '#39636b');
  ctx.strokeStyle = '#ffffff09'; ctx.lineWidth = 1;
  for (let x = -7; x <= 7; x++) { const a = view(x, 0, 0), b = view(x, 0, 10.5); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  for (let z = 0; z <= 10; z++) { const a = view(-7.5, 0, z), b = view(7.5, 0, z); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  if (building) board.slots.forEach((item) => {
    const p = view(item.x, .01, item.z);
    ctx.beginPath(); ctx.ellipse(p.x, p.y, selected === item.id ? 16 : 11, selected === item.id ? 12 : 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = selected === item.id ? '#ff537c50' : '#ffffff0d'; ctx.fill();
    ctx.setLineDash([3, 3]); ctx.strokeStyle = selected === item.id ? '#ff93b1' : '#99c2c8'; ctx.stroke(); ctx.setLineDash([]);
  });
  for (const piece of pieces) {
    const p = view(piece.x, .01, piece.z);
    ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 2, lens ? 18 : 8, lens ? 8 : 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#00101965'; ctx.fill();
  }
  const faces: { points: { x: number; y: number }[]; depth: number; color: string; shade: number }[] = [];
  for (const piece of pieces) {
    const vertices = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => vertex(piece, x * DOMINO.width / 2, y * DOMINO.height / 2, z * DOMINO.thickness / 2))));
    for (const [indexes, shade] of [ [[0, 1, 3, 2], -.25], [[4, 6, 7, 5], -.07], [[0, 4, 5, 1], -.4], [[2, 3, 7, 6], .15], [[0, 2, 6, 4], .02], [[1, 5, 7, 3], -.12] ] as [number[], number][]) {
      const vs = indexes.map((i) => vertices[i]);
      faces.push({ points: vs.map((p) => view(p.x, p.y, p.z)), depth: vs.reduce((n, p) => n + p.z - p.y * .85, 0) / 4, color: piece.color, shade });
    }
  }
  // Painter-sorted real cuboid faces; the rendered dimensions match Rapier's collider.
  faces.sort((a, b) => b.depth - a.depth).forEach((face) => {
    polygon(face.points, face.color, '#09252c90'); polygon(face.points, face.shade > 0 ? `rgba(255,255,255,${face.shade})` : `rgba(0,0,0,${-face.shade})`);
  });
  if (!lens) {
    const start = view(0, 0, .6);
    ctx.fillStyle = '#b7ffdf'; ctx.textAlign = 'center'; ctx.font = 'bold 15px system-ui'; ctx.fillText('↑ 첫 밀기', start.x, start.y + 30);
    ctx.fillStyle = '#8eafb5'; ctx.font = '12px system-ui'; ctx.fillText('각도 · 간격 · 모서리 접촉', 240, 26);
  }
  if (building && !lens) board.slots.forEach((item) => { const a = view(item.x, .01, item.z), b = markerPosition(item); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = selected === item.id ? '#ff91b2' : '#a0c3cc80'; ctx.stroke(); });
  if (lens) { ctx.fillStyle = '#ffd1df'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${(selected ?? 0) + 1}번 자리 확대 · 분홍색이 내 도미노`, 240, 30); }
}

function DominoTurn({ board, player, players, onDone, onNext }: { board: DominoBoard; player: number; players: number; onDone: (score: DominoScore) => void; onNext: () => void }) {
  const [placements, setPlacements] = useState<DominoPlacement[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<'build' | 'loading' | 'rolling' | 'done' | 'error'>('build');
  const [left, setLeft] = useState(DOMINO_MS);
  const [fallen, setFallen] = useState(0);
  const [buildMs, setBuildMs] = useState(0);
  const [notice, setNotice] = useState('분홍 도미노 3개로 길을 이으세요. 번호를 눌러 배치!');
  const [zoom, setZoom] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<DominoEngine | null>(null);
  const started = useRef(0), elapsed = useRef(0), current = useRef(placements), locked = useRef(false), alive = useRef(true);
  const launchRef = useRef<() => void>(() => {});
  const selected = placements[active];
  useEffect(() => {
    alive.current = true; started.current = performance.now();
    const timer = window.setInterval(() => { if (locked.current || document.hidden) return; const remaining = Math.max(0, DOMINO_MS - (performance.now() - started.current)); setLeft(remaining); if (!remaining) launchRef.current(); }, 50);
    let hiddenAt = 0;
    const visibility = () => { if (document.hidden) hiddenAt = performance.now(); else if (hiddenAt) { started.current += performance.now() - hiddenAt; hiddenAt = 0; } };
    document.addEventListener('visibilitychange', visibility);
    return () => { alive.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', visibility); engine.current?.dispose(); engine.current = null; };
  }, []);
  useEffect(() => { if (canvas.current && status === 'build') draw(canvas.current, poses(board, placements), board, selected?.slot, true, zoom && Boolean(selected)); }, [board, placements, selected, status, zoom]);
  useEffect(() => {
    if (status !== 'rolling') return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const sim = engine.current;
      if (!sim) return;
      if (!document.hidden) sim.step(Math.min(.08, (now - last) / 1000));
      last = now;
      if (canvas.current) draw(canvas.current, sim.snapshot(), board, undefined, false);
      setFallen(sim.fallen);
      if (sim.settled) { setStatus('done'); onDone({ player, fallen: sim.fallen, elapsedMs: elapsed.current }); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status, board, player, onDone]);
  async function launch() {
    if (locked.current) return;
    locked.current = true; elapsed.current = Math.round(Math.min(DOMINO_MS, performance.now() - started.current) / 100) * 100;
    setBuildMs(elapsed.current);
    setStatus('loading');
    try {
      const sim = await createDominoEngine(placedDominoes(board, current.current));
      if (!alive.current) { sim.dispose(); return; }
      engine.current = sim; sim.start(); setStatus('rolling');
    } catch { if (alive.current) setStatus('error'); }
  }
  useEffect(() => { launchRef.current = () => { void launch(); }; });
  function put(slot: number) {
    if (locked.current) return;
    const occupied = placements.findIndex((item) => item.slot === slot);
    if (occupied >= 0) { setActive(occupied); setNotice(`${occupied + 1}번 도미노 선택 · 다른 후보를 누르면 이동합니다.`); return; }
    const index = Math.min(active, placements.length);
    const candidate = { slot, yaw: placements[index]?.yaw ?? 0 };
    if (!canPlaceDomino(board, placements, index, candidate)) { setNotice('다른 도미노와 겹쳐요. 각도를 바꾸거나 다른 후보를 고르세요.'); return; }
    const next = [...placements]; next[index] = candidate; current.current = next; setPlacements(next); setActive(index);
    setNotice(`${index + 1}번을 ${slot + 1}번 후보에 배치했어요. 각도를 확인하세요.`);
  }
  function rotate(direction: number) {
    if (!selected || locked.current) return;
    const candidate = { ...selected, yaw: selected.yaw + direction * Math.PI / 12 };
    if (!canPlaceDomino(board, placements, active, candidate)) { setNotice('이 각도에서는 옆 도미노와 겹쳐요.'); return; }
    const next = placements.map((item, i) => i === active ? candidate : item); current.current = next; setPlacements(next);
  }
  return <section className="domino-play">
    <div className="domino-turn"><strong>{PLAYER_NAMES[player]}의 차례</strong><span>{player + 1} / {players}</span></div>
    <div className="domino-metrics"><div><span>{status === 'build' ? '추가 도미노' : '넘어진 도미노'}</span><b>{status === 'build' ? `${placements.length} / 3` : fallen}<small>개</small></b></div><div><span>{status === 'build' ? '배치 시간' : status === 'done' ? '관찰 완료' : '연쇄 관찰 중'}</span><b className={left < 6000 ? 'urgent' : ''}>{status === 'build' ? (left / 1000).toFixed(1) : status === 'done' ? '✓' : '…'}{status === 'build' && <small>초</small>}</b></div></div>
    <div className="domino-board" aria-label="3D 도미노 게임판"><canvas ref={canvas} aria-label="실제 충돌에 따라 넘어지는 도미노" />
      {status === 'build' && !(zoom && selected) && board.slots.map((slot) => { const p = markerPosition(slot); const used = placements.some((item) => item.slot === slot.id); return <button key={slot.id} className={`domino-marker ${selected?.slot === slot.id ? 'selected' : ''} ${used ? 'used' : ''}`} style={{ left: `${p.x / W * 100}%`, top: `${p.y / H * 100}%` }} onClick={() => put(slot.id)} aria-label={`판 위 후보 ${slot.id + 1}`} aria-pressed={selected?.slot === slot.id}>{slot.id + 1}</button>; })}
      {status === 'build' && selected && <button className="domino-zoom" onClick={() => setZoom(!zoom)}>{zoom ? '전체 판 보기' : '선택 자리 확대'}</button>}
      {(status === 'loading' || status === 'done') && <div className="domino-board-note">{status === 'done' ? `${fallen}개! 연쇄가 멈췄어요` : '도미노를 세우는 중…'}</div>}
    </div>
    {status === 'build' && <>
      <div className="domino-tools"><div className="domino-inventory" aria-label="추가 도미노 선택">{[0, 1, 2].map((i) => <button key={i} disabled={i > placements.length} className={active === i ? 'selected' : ''} onClick={() => { setActive(i); setNotice(`${i + 1}번 도미노 · 놓을 후보를 고르세요.`); }} aria-pressed={active === i}>{i + 1}번 <small>{placements[i] ? `${placements[i].slot + 1}번 자리` : '미배치'}</small></button>)}</div><div className="domino-rotation"><button disabled={!selected} onClick={() => rotate(-1)} aria-label="선택 도미노 왼쪽 15도 회전">↶ 15°</button><b>{selected ? `${((Math.round(selected.yaw * 180 / Math.PI) % 180) + 180) % 180}°` : '각도'}</b><button disabled={!selected} onClick={() => rotate(1)} aria-label="선택 도미노 오른쪽 15도 회전">15° ↷</button></div></div>
      <div className="domino-candidates" aria-label="큰 버튼으로 배치 후보 선택">{board.slots.map((slot) => <button key={slot.id} onClick={() => put(slot.id)} aria-label={`후보 ${slot.id + 1}에 배치`} className={selected?.slot === slot.id ? 'selected' : placements.some((item) => item.slot === slot.id) ? 'used' : ''}>{slot.id + 1}<small>{slot.group}</small></button>)}</div>
      <p className="domino-notice" aria-live="polite">{notice}</p><button className="domino-primary" onClick={() => { void launch(); }}>한 번 밀기 <span>{3 - placements.length > 0 ? `· ${3 - placements.length}개 남음` : '· 배치 확정'}</span></button>
      <p className="domino-fine">다른 번호를 눌러 이동 · 겹쳐서 놓기 불가<br />30초가 지나면 현재 배치로 자동 시작합니다.</p>
    </>}
    {status === 'rolling' && <p className="domino-watch" aria-live="polite">{fallen === 0 ? '첫 도미노가 움직입니다…' : '닿을까, 멈출까…'}<small>아슬아슬하게 흔들리면 끝까지 기다려요.</small></p>}
    {status === 'done' && <div className="domino-outcome"><p>{fallen} / {board.pieces.length + placements.length}개 · 배치 {(buildMs / 1000).toFixed(1)}초</p><p>60° 이상 기운 도미노를 셉니다.<br />넘어진 수 → 배치 시간이 짧은 순</p><button className="domino-primary" onClick={onNext}>{player + 1 === players ? '최종 순위 보기' : '화면 가리고 넘기기'}</button></div>}
    {status === 'error' && <div role="alert"><p>물리 계산을 준비하지 못했어요. 다시 시작해 주세요.</p><button className="domino-primary" onClick={() => { locked.current = false; void launch(); }}>다시 준비하기</button></div>}
  </section>;
}

export default function DominoGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<'setup' | 'ready' | 'play' | 'final'>('setup');
  const [players, setPlayers] = useState(2), [player, setPlayer] = useState(0);
  const [mirror, setMirror] = useState(false);
  const [results, setResults] = useState<DominoScore[]>([]);
  const [board, setBoard] = useState<DominoBoard | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (preview.current && phase === 'setup') { const b = makeDominoBoard(); draw(preview.current, poses(b, []), b, undefined, true); } }, [phase]);
  function prepare() { const flip = Math.random() > .5; setMirror(flip); setBoard(makeDominoBoard(flip)); setResults([]); setPlayer(0); setPhase('ready'); }
  function next() { if (player + 1 === players) setPhase('final'); else { setBoard(makeDominoBoard(mirror !== Boolean((player + 1) % 2))); setPlayer(player + 1); setPhase('ready'); } }
  const ranked = rankDominoes(results);
  return <main className="domino-shell" style={{ '--domino-player': COLORS[player] } as CSSProperties}>
    <header className="domino-header"><div><p>COFFEE BREAK · STRATEGY</p><h1>도미노 한 방</h1></div><button onClick={onExit}>게임 선택</button></header>
    {phase === 'setup' && <section className="domino-setup"><h2>세 개만 더 놓으면,<br /><em>어디까지 이어질까?</em></h2><div className="domino-board"><canvas ref={preview} aria-label="갈림길과 코너가 있는 도미노 판" /></div><p>12개의 후보 중 자리를 고르고 각도를 맞추세요.<br />짧은 길 여러 개? 긴 길 하나? 딱 한 번 밀어봅니다.</p><div className="domino-rules"><span>① 3개 배치 · 이동·회전 가능</span><span>② 첫 도미노 한 번 밀기</span><span>③ 많이 쓰러뜨린 사람이 우승</span></div><label className="domino-players">참가 인원<select value={players} onChange={(e) => setPlayers(Number(e.target.value))}>{[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}명</option>)}</select></label><button className="domino-primary" onClick={prepare}>도미노 판 준비</button><p className="domino-fine">1인 배치 30초 + 연쇄 관찰 · 한 기기 · 소리 없음</p></section>}
    {phase === 'ready' && <section className="domino-ready"><b className="domino-avatar">{player + 1}</b><p>{player + 1} / {players}번째 도전</p><h2>{PLAYER_NAMES[player]} 차례</h2><p>번호를 눌러 배치하고, 15°씩 돌려 맞추세요.<br />출발점은 판 아래의 <strong>↑ 첫 밀기</strong>입니다.</p><div className="domino-rules"><span>같은 판을 좌우만 바꿔 도전합니다.</span><span>다른 사람은 배치와 결과를 보지 않기!</span><span>같은 개수라면 배치 시간이 짧은 순</span></div><button className="domino-primary" onClick={() => setPhase('play')}>30초 배치 시작</button></section>}
    {phase === 'play' && board && <DominoTurn key={player} board={board} player={player} players={players} onDone={(score) => setResults((current) => current.some((item) => item.player === score.player) ? current : [...current, score])} onNext={next} />}
    {phase === 'final' && <section className="domino-final"><p>한 번의 밀기, 서로 다른 결과</p><h2>오늘의 순위</h2><p>넘어진 수 → 배치 시간이 짧은 순</p><ol>{ranked.map((item) => <li key={item.player}><b>{item.rank}위</b><i style={{ background: COLORS[item.player] }} /><div><strong>{PLAYER_NAMES[item.player]}</strong><small>{(item.elapsedMs / 1000).toFixed(1)}초에 배치</small></div><em>{item.fallen}<small>개</small></em></li>)}</ol><p className="domino-fine">개수와 배치 시간까지 같으면 공동 순위입니다.</p><button className="domino-primary" onClick={prepare}>한 판 더</button><button className="domino-secondary" onClick={() => setPhase('setup')}>인원 바꾸기</button></section>}
  </main>;
}
