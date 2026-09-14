'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { PLAYER_NAMES } from './game';
import { ARCADE_STEP, HOLE_H, HOLE_SECONDS, HOLE_W, TOYS, canSwallow, makeHoleWorld, moveHole, rankArcade, stepHole, type ArcadeResult, type HoleWorld, type Point } from './hole-game';
import type { DemoEngine } from './demolition-game';

type Kind = 'hole' | 'demolition';
type Phase = 'setup' | 'ready' | 'play' | 'result' | 'final';
const COLORS = ['#168ad5', '#e37627', '#8b6edb', '#199474', '#d84386', '#a78210'];
const INFO = {
  hole: { title: '블랙홀 대청소', icon: '🕳️', heading: '작은 것부터,\n마지막엔 한입에.', intro: '구멍을 움직여 장난감을 삼키세요. 많이 먹을수록 커져서 큰 장난감도 먹을 수 있어요.', rule: '단추 10 · 사탕 30 · 자동차 80 · 인형 180점', tip: '초록 테두리 = 지금 먹을 수 있어요. 큰 물건에 멈춰 있으면 시간만 흘러요.', button: '30초 시작', result: '장난감' },
  demolition: { title: '세 발 철거왕', icon: '💥', heading: '어디를 쏴야\n와르르 무너질까?', intro: '탄환을 뒤로 당겼다 놓으세요. 지지대를 밀거나 위쪽 무게추를 쳐서 블록을 아래로 떨어뜨리는 게임입니다.', rule: '기둥 40 · 가로판 60 · 분홍 무게추 120점', tip: '한 발마다 조준 12초. 시간이 지나면 그 발은 패스예요. 흔들리는 블록은 끝까지 기다려요.', button: '세 발 도전', result: '블록' },
};

function drawHole(ctx: CanvasRenderingContext2D, world: HoleWorld, animals: HTMLImageElement, color: string) {
  const bg = ctx.createLinearGradient(0, 0, 400, 480); bg.addColorStop(0, '#192f4d'); bg.addColorStop(1, '#153c50');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 400, 480);
  ctx.strokeStyle = '#ffffff09'; ctx.lineWidth = 1;
  for (let x = 20; x < 400; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 480); ctx.stroke(); }
  for (let y = 20; y < 480; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(400, y); ctx.stroke(); }
  const { x, y } = world.hole, r = world.radius;
  ctx.shadowColor = '#43e7ed'; ctx.shadowBlur = 15; ctx.strokeStyle = '#84fbef'; ctx.lineWidth = 3;
  ctx.fillStyle = '#01030c'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 5, world.elapsed * 2, world.elapsed * 2 + Math.PI * 1.5); ctx.stroke();
  for (const toy of world.toys) {
    if (toy.eaten) continue;
    const spec = TOYS[toy.tier], t = Math.min(1, toy.sinking / .36), size = spec.radius * (1 - t * .85);
    const tx = toy.x + (x - toy.x) * t, ty = toy.y + (y - toy.y) * t;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(toy.angle + t * 1.8); ctx.globalAlpha = 1 - t;
    if (!t && canSwallow(world, toy)) { ctx.strokeStyle = '#80e9b5a0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, spec.radius + 3, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#0003'; ctx.beginPath(); ctx.ellipse(1, size * .55, size * .8, size * .35, 0, 0, Math.PI * 2); ctx.fill();
    if (toy.tier === 3 && animals.complete && animals.naturalWidth) {
      const col = toy.id % 4, row = Math.floor(toy.id / 4) % 2;
      ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(animals, col * 192, row * 256, 192, 256, -size * .8, -size, size * 1.6, size * 2);
    } else {
      ctx.fillStyle = '#fff'; ctx.font = `${size * 1.8}px "Segoe UI Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(spec.icon, 0, 1);
    }
    ctx.restore();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (!world.count && world.elapsed < 5) { ctx.fillStyle = '#e7ffff'; ctx.font = '700 16px system-ui'; ctx.fillText('눌러서 이동 · 작은 것부터 꿀꺽', 200, 468); }
}

function drawDemo(ctx: CanvasRenderingContext2D, game: DemoEngine, pull: Point | null, color: string) {
  const scale = 31, ox = 200, oy = 345;
  ctx.fillStyle = '#152b45'; ctx.fillRect(0, 0, 400, 480);
  ctx.strokeStyle = '#ffffff09'; ctx.lineWidth = 1;
  for (let x = 20; x < 400; x += 30) { ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, 345); ctx.stroke(); }
  ctx.fillStyle = '#244052'; ctx.fillRect(0, 347, 400, 81);
  ctx.fillStyle = '#fbba4960'; ctx.fillRect(0, 428, 400, 4);
  ctx.fillStyle = '#e3b873'; ctx.font = '700 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('↓ 이 아래로 떨어진 블록만 득점', 242, 374);
  ctx.fillStyle = '#456272'; ctx.fillRect(ox - 1.4 * scale, oy, 6.2 * scale, .34 * scale);
  ctx.fillStyle = '#9ec2cd'; ctx.fillRect(ox - 1.4 * scale, oy, 6.2 * scale, 3);
  for (const block of game.blocks) {
    const p = block.body.translation(), q = block.body.rotation();
    ctx.save(); ctx.translate(ox + p.x * scale, oy - p.y * scale); ctx.rotate(-2 * Math.atan2(q.z, q.w));
    const w = block.w * scale, h = block.h * scale;
    ctx.fillStyle = block.scored ? '#65818e' : block.color; ctx.strokeStyle = '#ffffff80'; ctx.lineWidth = 1;
    ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = '#fff5'; ctx.fillRect(-w / 2 + 2, -h / 2 + 2, Math.max(1, w - 4), 2);
    if (block.points === 120 && !block.scored) { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText('★', 0, 4); }
    ctx.restore();
    const age = game.elapsed - block.scoredAt;
    if (block.scored && age < .6) { ctx.globalAlpha = 1 - age / .6; ctx.fillStyle = '#fff0ac'; ctx.font = 'bold 16px system-ui'; ctx.fillText(`+${block.points}`, ox + p.x * scale, oy - p.y * scale - 15 - age * 25); ctx.globalAlpha = 1; }
  }
  for (const body of game.balls) {
    const p = body.translation(); ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ox + p.x * scale, oy - p.y * scale, .26 * scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#0c1c31'; ctx.fillRect(0, 434, 400, 46);
  ctx.textAlign = 'center'; ctx.font = '700 14px system-ui'; ctx.fillStyle = '#c8e0f5';
  ctx.fillText(game.phase === 'aim' ? '발사 구역 · 왼쪽 아래로 당겼다 놓기' : '와르르… 블록이 멈출 때까지', 200, 462);
  if (game.phase === 'aim') {
    const dx = Math.max(-82, Math.min(0, pull?.x ?? 0)), dy = Math.max(0, Math.min(82, pull?.y ?? 0));
    ctx.strokeStyle = '#a6c8e266'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.strokeRect(12, 294, 125, 121); ctx.setLineDash([]);
    ctx.strokeStyle = '#809bb4'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(70, 340); ctx.lineTo(84 + dx, 320 + dy); ctx.lineTo(98, 340); ctx.stroke();
    ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(84 + dx, 320 + dy, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c4dceba0'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(84, 320, 25, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (pull && Math.hypot(dx, dy) > 8) {
      const f = Math.min(1, 82 / Math.hypot(dx, dy)), vx = -dx * .23 * f, vy = dy * .23 * f;
      // Only the initial arc, not a predicted hit or a collapse hint.
      for (let i = 1; i <= 7; i++) { const t = i * .04; ctx.fillStyle = '#ffffffb0'; ctx.beginPath(); ctx.arc(84 + vx * t * scale, 320 - (vy * t - 4.905 * t * t) * scale, 2, 0, Math.PI * 2); ctx.fill(); }
    }
  }
}

function ArcadeTurn({ kind, seed, player, onDone }: { kind: Kind; seed: number; player: number; onDone: (result: Omit<ArcadeResult, 'player'>) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null), hole = useRef<HoleWorld | null>(null), demo = useRef<DemoEngine | null>(null);
  const drag = useRef<{ id: number; start: Point; pull: Point } | null>(null);
  const pauseRef = useRef(false), finish = useRef(onDone);
  const [paused, setPaused] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [hud, setHud] = useState({ score: 0, count: 0, seconds: kind === 'hole' ? 30 : 12, shots: 0, radius: 15, status: 'loading' });
  useEffect(() => { finish.current = onDone; }, [onDone]);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d');
    if (!element || !ctx) return;
    let disposed = false, frame = 0, previous = 0, accumulator = 0, lastHUD = -1, reported = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1); element.width = HOLE_W * dpr; element.height = HOLE_H * dpr; ctx.scale(dpr, dpr);
    const animals = new Image(); animals.src = '/dodge-animals.jpg';
    pauseRef.current = false; hole.current = null; demo.current = null;
    const pause = () => { if (document.hidden) { previous = 0; accumulator = 0; drag.current = null; pauseRef.current = true; setPaused(true); } };
    document.addEventListener('visibilitychange', pause);
    const tick = (now: number) => {
      if (disposed) return;
      if (pauseRef.current) { previous = 0; accumulator = 0; frame = requestAnimationFrame(tick); return; }
      if (previous) accumulator += (now - previous) / 1000;
      previous = now;
      const h = hole.current, d = demo.current;
      while (accumulator >= ARCADE_STEP && !(h?.done || d?.phase === 'done')) { if (h) stepHole(h); if (d) d.step(); accumulator -= ARCADE_STEP; }
      if (h) drawHole(ctx, h, animals, COLORS[player]);
      if (d) { if (d.phase !== 'aim') drag.current = null; drawDemo(ctx, d, drag.current?.pull ?? null, COLORS[player]); }
      const elapsed = h?.elapsed ?? d?.elapsed ?? 0, done = h?.done || d?.phase === 'done';
      if (elapsed - lastHUD > .08 || done) { setHud({ score: h?.score ?? d?.score ?? 0, count: h?.count ?? d?.count ?? 0, seconds: h ? Math.max(0, Math.ceil(HOLE_SECONDS - h.elapsed)) : Math.max(0, Math.ceil(d?.aimLeft ?? 12)), shots: d?.shots ?? 0, radius: h?.radius ?? 15, status: h ? 'play' : d?.phase ?? 'loading' }); lastHUD = elapsed; }
      if (done) { if (!reported) { reported = true; finish.current({ score: h?.score ?? d?.score ?? 0, count: h?.count ?? d?.count ?? 0 }); } return; }
      frame = requestAnimationFrame(tick);
    };
    if (kind === 'hole') { hole.current = makeHoleWorld(seed); frame = requestAnimationFrame(tick); }
    else import('./demolition-game').then((module) => module.makeDemolition(seed)).then((game) => { if (disposed) game.dispose(); else { demo.current = game; frame = requestAnimationFrame(tick); } }).catch(() => { if (!disposed) setError('철거 현장을 불러오지 못했어요. 다시 준비해 주세요.'); });
    return () => { disposed = true; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', pause); demo.current?.dispose(); demo.current = null; };
  }, [kind, seed, player, retry]);

  const pos = (event: ReactPointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width * 400, y: (event.clientY - rect.top) / rect.height * 480 }; };
  const end = (event: ReactPointerEvent<HTMLCanvasElement>, fire: boolean) => {
    if (drag.current?.id !== event.pointerId) return;
    if (fire && !pauseRef.current) demo.current?.fire(drag.current.pull);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const tier = TOYS.reduce((best, toy, index) => toy.radius + 3 <= hud.radius ? index : best, 0);
  return <>
    <div className="arcade-hud"><div><span>모은 점수</span><strong>{hud.score}<small>점</small></strong></div><div><span>{kind === 'hole' ? '지금 먹을 수 있어요' : '남은 탄환'}</span><strong className="arcade-tier">{kind === 'hole' ? `${TOYS[tier].icon} ${TOYS[tier].name}` : `${3 - hud.shots} / 3`}</strong></div><div><span>{hud.status === 'flight' ? '붕괴 확인' : '남은 시간'}</span><strong>{hud.status === 'flight' ? '…' : hud.seconds}<small>{hud.status === 'flight' ? '' : '초'}</small></strong></div></div>
    <div className="arcade-stage">
      <canvas ref={canvas} className="arcade-board" tabIndex={0} role="application" aria-label={kind === 'hole' ? '블랙홀 게임판. 누른 채 이동. 방향키로도 이동합니다.' : '철거 게임판. 아래 발사 구역을 왼쪽 아래로 당겨 놓으세요. 방향키로 조준하고 스페이스로 발사합니다.'} onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => { if (pauseRef.current || drag.current || event.button !== 0) return; const p = pos(event); if (kind === 'demolition' && (demo.current?.phase !== 'aim' || p.y < 294 || p.y > 415 || p.x < 12 || p.x > 137)) return; event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, start: p, pull: { x: 0, y: 0 } }; if (hole.current) moveHole(hole.current, p); }}
        onPointerMove={(event) => { if (pauseRef.current || drag.current?.id !== event.pointerId) return; const p = pos(event); drag.current.pull = { x: Math.max(-82, Math.min(0, p.x - drag.current.start.x)), y: Math.max(0, Math.min(82, p.y - drag.current.start.y)) }; if (hole.current) moveHole(hole.current, p); }}
        onPointerUp={(event) => end(event, true)} onPointerCancel={(event) => end(event, false)} onLostPointerCapture={(event) => end(event, false)}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) return;
          event.preventDefault(); if (pauseRef.current) return;
          if (hole.current) { const p = hole.current.target; moveHole(hole.current, { x: p.x + (event.key === 'ArrowLeft' ? -22 : event.key === 'ArrowRight' ? 22 : 0), y: p.y + (event.key === 'ArrowUp' ? -22 : event.key === 'ArrowDown' ? 22 : 0) }); }
          else if (demo.current?.phase === 'aim') {
            drag.current ??= { id: -1, start: { x: 84, y: 320 }, pull: { x: -56, y: 52 } };
            if (event.key === ' ') { demo.current.fire(drag.current.pull); drag.current = null; }
            else { const p = drag.current.pull; p.x = Math.max(-82, Math.min(0, p.x + (event.key === 'ArrowLeft' ? -4 : event.key === 'ArrowRight' ? 4 : 0))); p.y = Math.max(0, Math.min(82, p.y + (event.key === 'ArrowDown' ? 4 : event.key === 'ArrowUp' ? -4 : 0))); }
          }
        }} />
      {(paused || error || hud.status === 'loading') && <div className="arcade-overlay"><h2>{error ? '잠깐, 다시 준비할게요' : paused ? '잠깐 멈췄어요' : '게임판 준비 중…'}</h2>{error ? <><p>{error}</p><button className="puzzle-primary" onClick={() => { setError(''); setRetry((n) => n + 1); }}>다시 준비하기</button></> : paused ? <button className="puzzle-primary" onClick={() => { pauseRef.current = false; setPaused(false); }}>계속하기</button> : null}</div>}
    </div>
    <p className="arcade-status" role="status">{kind === 'hole' ? `${hud.count}개 꿀꺽 · 초록 테두리부터 먹어보세요` : hud.status === 'flight' ? '흔들리는 중! 마지막에 떨어진 블록까지 계산해요.' : `${Math.min(3, hud.shots + 1)}번째 발 · 아래 발사 구역을 당겼다 놓으세요`}</p>
    <p className="arcade-legend">{INFO[kind].rule}</p>
  </>;
}

function ArcadeGame({ kind, onExit }: { kind: Kind; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup'), [players, setPlayers] = useState(2), [player, setPlayer] = useState(0), [seed, setSeed] = useState(1), [results, setResults] = useState<ArcadeResult[]>([]);
  const finished = useRef(false), info = INFO[kind];
  const finish = useCallback((result: Omit<ArcadeResult, 'player'>) => { if (finished.current) return; finished.current = true; setResults((items) => [...items, { ...result, player }]); setPhase('result'); }, [player]);
  const prepare = () => { setSeed(Math.floor(Math.random() * 4294967296)); setPlayer(0); setResults([]); setPhase('ready'); };
  const result = results.find((item) => item.player === player);
  return <main className={`puzzle-shell arcade-shell arcade-${kind}`} style={{ '--puzzle-player': COLORS[player] } as CSSProperties}>
    <header className="puzzle-topbar"><div><p>COFFEE BREAK · NEW GAME</p><h1>{info.title}</h1></div><button onClick={onExit}>게임 선택</button></header>
    {phase === 'setup' && <section className="puzzle-setup"><div className="puzzle-hero" aria-hidden="true">{info.icon}</div><h2 style={{ whiteSpace: 'pre-line' }}>{info.heading}</h2><p>{info.intro}</p><div className="puzzle-rule"><strong>{info.rule}</strong><span>{info.tip}</span></div><label className="puzzle-players">참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}명</option>)}</select></label><button className="puzzle-primary" onClick={prepare}>게임판 준비하기</button><p className="puzzle-fine">한 기기로 돌려가며 · 점수가 높은 순서<br />동점은 공동 순위 · 소리 없이 플레이</p></section>}
    {phase === 'ready' && <section className="puzzle-ready"><span className="puzzle-player-badge">{player + 1}</span><p>{player + 1} / {players}번째 도전</p><h2>{PLAYER_NAMES[player]} 차례</h2><p>{kind === 'hole' ? '게임판을 누르고 작은 장난감부터 먹으세요.' : '아래 발사 구역을 왼쪽 아래로 당겼다 놓으세요.'}</p><div className="puzzle-rule"><strong>모두 같은 배치 · 다른 사람은 화면 보지 않기</strong><span>내 차례가 되면 기기를 받아 시작하세요.<br />{info.tip}</span></div><button className="puzzle-primary" onClick={() => { finished.current = false; setPhase('play'); }}>{info.button}</button></section>}
    {phase === 'play' && <section className="puzzle-play"><div className="puzzle-turn"><i /><strong>{PLAYER_NAMES[player]}의 차례</strong><span>{player + 1} / {players}</span></div><ArcadeTurn key={`${seed}-${player}`} kind={kind} seed={seed} player={player} onDone={finish} /></section>}
    {phase === 'result' && result && <section className="puzzle-result"><p>{PLAYER_NAMES[player]}의 기록</p><h2>{result.score}<small>점</small></h2><p>{info.result} {result.count}개 {kind === 'hole' ? '꿀꺽!' : '철거 성공!'}</p><p className="puzzle-fine">{kind === 'hole' ? '시간 안에 삼키기 시작한 장난감까지 계산했어요.' : '받침 아래로 떨어지지 않은 블록은 0점이에요.'}</p><button className="puzzle-primary" onClick={() => { if (player + 1 === players) setPhase('final'); else { setPlayer(player + 1); setPhase('ready'); } }}>{player + 1 < players ? '화면 가리고 넘기기' : '최종 순위 보기'}</button></section>}
    {phase === 'final' && <section className="puzzle-final"><p className="puzzle-kicker">{info.title}</p><h2>오늘의 순위</h2><p>점수가 높은 순서 · 동점은 공동 순위</p><ol>{rankArcade(results).map((item) => <li key={item.player} style={{ '--puzzle-player': COLORS[item.player] } as CSSProperties}><b>{item.rank}<small>위</small></b><i /><div><strong>{PLAYER_NAMES[item.player]}</strong><small>{info.result} {item.count}개</small></div><em>{item.score}<small>점</small></em></li>)}</ol><button className="puzzle-primary" onClick={prepare}>새 게임판으로 한 번 더</button><button className="puzzle-secondary" onClick={() => setPhase('setup')}>인원 바꾸기</button><button className="puzzle-secondary" onClick={onExit}>게임 선택으로</button></section>}
  </main>;
}

export function HoleGame({ onExit }: { onExit: () => void }) { return <ArcadeGame kind="hole" onExit={onExit} />; }
export function DemolitionGame({ onExit }: { onExit: () => void }) { return <ArcadeGame kind="demolition" onExit={onExit} />; }
