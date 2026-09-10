'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { PLAYER_NAMES } from './game';
import { BALL_COUNT, BALL_R, BIN_EDGES, BIN_FLOOR, BIN_POINTS, BIN_TOP, BRUSH_R, CELL, COLS, DIG_SECONDS, DRAIN_SECONDS, SAND_BOTTOM, SAND_H, SAND_TOP, SAND_W, STEP, digSand, makeSandWorld, rankSand, stepSand, type Point, type SandResult, type SandWorld } from './sand-game';

const COLORS = ['#168ad5', '#e37627', '#8b6edb', '#199474', '#d84386', '#a78210'];
const BIN_COLORS = ['#459c91', '#3c8cd9', '#ffba3f', '#3c8cd9', '#459c91'];
type Phase = 'setup' | 'ready' | 'play' | 'result' | 'final';

function paintTerrain(ctx: CanvasRenderingContext2D, world: SandWorld) {
  ctx.clearRect(0, 0, SAND_W, SAND_H);
  for (let y = SAND_TOP / CELL; y < SAND_BOTTOM / CELL; y++) for (let x = 3; x < COLS - 3; x++) {
    if (!world.sand[y * COLS + x]) continue;
    const shade = (Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 0;
    ctx.fillStyle = ['#eec078', '#ecc17e', '#edc581', '#e8ba71'][shade % 4];
    ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    if (!world.sand[(y - 1) * COLS + x]) { ctx.fillStyle = '#ffe5b0'; ctx.fillRect(x * CELL, y * CELL, CELL, 2); }
    if (!world.sand[(y + 1) * COLS + x]) { ctx.fillStyle = '#b47b40'; ctx.fillRect(x * CELL, y * CELL + 2, CELL, 2); }
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, world: SandWorld, terrain: HTMLCanvasElement, cursor: Point | null, color: string) {
  ctx.clearRect(0, 0, SAND_W, SAND_H);
  const bg = ctx.createLinearGradient(0, 0, 0, SAND_H);
  bg.addColorStop(0, '#133d4b'); bg.addColorStop(1, '#071e31');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SAND_W, SAND_H);
  ctx.fillStyle = '#ffffff05';
  for (let y = 90; y < SAND_BOTTOM; y += 28) ctx.fillRect(12, y, 376, 1);
  ctx.drawImage(terrain, 0, 0);
  ctx.lineCap = 'round';
  for (const rock of world.rocks) {
    ctx.strokeStyle = '#112633'; ctx.lineWidth = rock.r * 2 + 5;
    ctx.beginPath(); ctx.moveTo(rock.a.x, rock.a.y + 3); ctx.lineTo(rock.b.x, rock.b.y + 3); ctx.stroke();
    ctx.strokeStyle = '#52717b'; ctx.lineWidth = rock.r * 2;
    ctx.beginPath(); ctx.moveTo(rock.a.x, rock.a.y); ctx.lineTo(rock.b.x, rock.b.y); ctx.stroke();
    ctx.strokeStyle = '#9db0ad'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(rock.a.x, rock.a.y - rock.r + 5); ctx.lineTo(rock.b.x, rock.b.y - rock.r + 5); ctx.stroke();
  }
  for (let i = 0; i < BIN_POINTS.length; i++) {
    const x = BIN_EDGES[i], width = BIN_EDGES[i + 1] - x;
    const flash = world.balls.some((b) => b.bin === i && world.elapsed - b.collectedAt < .3);
    ctx.fillStyle = flash ? BIN_COLORS[i] + '88' : BIN_COLORS[i] + '22';
    ctx.fillRect(x + 3, BIN_TOP + 1, width - 6, BIN_FLOOR - BIN_TOP);
    ctx.strokeStyle = BIN_COLORS[i]; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 2, BIN_TOP); ctx.lineTo(x + 2, BIN_FLOOR); ctx.lineTo(x + width - 2, BIN_FLOOR); ctx.lineTo(x + width - 2, BIN_TOP); ctx.stroke();
    ctx.fillStyle = i === 2 ? '#ffd881' : '#e4faf7'; ctx.font = '800 20px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(String(BIN_POINTS[i]), x + width / 2, 478);
    ctx.font = '12px system-ui'; ctx.fillText(`${world.bins[i]}개`, x + width / 2, 496);
  }
  for (const ball of world.balls) {
    if (ball.bin !== null) {
      const t = world.elapsed - ball.collectedAt;
      if (t < .7) { ctx.globalAlpha = 1 - t / .7; ctx.fillStyle = '#fff1b6'; ctx.font = 'bold 16px system-ui'; ctx.fillText(`+${BIN_POINTS[ball.bin]}`, ball.x, 460 - t * 35); ctx.globalAlpha = 1; }
      continue;
    }
    ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.arc(ball.x + 1, ball.y + 2, BALL_R + 1, 0, Math.PI * 2); ctx.fill();
    const pearl = ctx.createRadialGradient(ball.x - 2, ball.y - 3, 0, ball.x, ball.y, BALL_R);
    pearl.addColorStop(0, '#fff'); pearl.addColorStop(.32, '#bdf7ff'); pearl.addColorStop(1, color);
    ctx.fillStyle = pearl; ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2); ctx.fill();
  }
  if (cursor && world.elapsed < DIG_SECONDS) {
    ctx.strokeStyle = '#ffffffbb'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(cursor.x, cursor.y, BRUSH_R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  if (!world.revision && world.elapsed < 6) {
    ctx.fillStyle = '#49321f'; ctx.textAlign = 'center'; ctx.font = '700 17px system-ui'; ctx.fillText('구슬 아래부터 쓱, 길을 파세요', 200, 124);
  }
}

function SandTurn({ seed, player, onDone }: { seed: number; player: number; onDone: (result: Omit<SandResult, 'player'>) => void }) {
  const [world] = useState(() => makeSandWorld(seed, player % 2 === 1));
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ pointer: number; point: Point } | null>(null);
  const cursor = useRef<Point | null>(null);
  const keyboardDig = useRef(false);
  const [view, setView] = useState({ elapsed: 0, score: 0, collected: 0 });
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const finish = useRef(onDone);
  useEffect(() => { finish.current = onDone; }, [onDone]);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx) return;
    const terrain = document.createElement('canvas'); terrain.width = SAND_W; terrain.height = SAND_H;
    const terrainCtx = terrain.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    element.width = SAND_W * dpr; element.height = SAND_H * dpr; ctx.scale(dpr, dpr);
    let frame = 0, previous = 0, accumulator = 0, revision = -1, lastHUD = -1;
    let reported = false;
    const pause = () => {
      if (document.hidden) { previous = 0; pausedRef.current = true; setPaused(true); drag.current = null; keyboardDig.current = false; cursor.current = null; }
    };
    document.addEventListener('visibilitychange', pause);
    const tick = (now: number) => {
      if (pausedRef.current) { previous = 0; accumulator = 0; frame = requestAnimationFrame(tick); return; }
      // Fixed-step simulation keeps play time equal on 30/60/120Hz displays. Hidden tabs explicitly pause.
      if (previous) accumulator += (now - previous) / 1000;
      previous = now;
      while (accumulator >= STEP && !world.done) { stepSand(world); accumulator -= STEP; }
      if (revision !== world.revision) { paintTerrain(terrainCtx, world); revision = world.revision; }
      drawBoard(ctx, world, terrain, cursor.current, COLORS[player]);
      if (world.elapsed - lastHUD >= .08 || world.done) { setView({ elapsed: world.elapsed, score: world.score, collected: world.collected }); lastHUD = world.elapsed; }
      if (world.done) {
        if (!reported) { reported = true; finish.current({ score: world.score, collected: world.collected, bins: [...world.bins] }); }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', pause); };
  }, [world, player]);

  const pos = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * SAND_W, y: (event.clientY - rect.top) / rect.height * SAND_H };
  };
  const canDig = () => !pausedRef.current && !world.done && world.elapsed < DIG_SECONDS;
  const release = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null; cursor.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const draining = view.elapsed >= DIG_SECONDS;
  return <>
    <div className="sand-hud"><div><span>모은 점수</span><strong>{view.score}<small>점</small></strong></div><div><span>도착한 구슬</span><strong>{view.collected}<small> / {BALL_COUNT}</small></strong></div><div className={view.elapsed > 20 ? 'sand-urgent' : ''}><span>{draining ? '도착 기다리기' : '길 파는 시간'}</span><strong>{Math.max(0, Math.ceil((draining ? DIG_SECONDS + DRAIN_SECONDS : DIG_SECONDS) - view.elapsed))}<small>초</small></strong></div></div>
    <div className="sand-timer" role="progressbar" aria-label="길 파기 남은 시간" aria-valuemin={0} aria-valuemax={25} aria-valuenow={Math.max(0, Math.ceil(DIG_SECONDS - view.elapsed))}><i style={{ width: `${Math.max(0, 1 - view.elapsed / DIG_SECONDS) * 100}%` }} /></div>
    <div className="sand-stage">
      <canvas ref={canvas} className="sand-board" tabIndex={0} role="application" aria-label="모래길 게임판. 구슬 아래에서 손가락으로 길을 파세요. 키보드는 방향키로 삽 이동, 스페이스로 파기 전환." onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => { if (!canDig() || drag.current || event.button !== 0) return; event.preventDefault(); const point = pos(event); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { pointer: event.pointerId, point }; cursor.current = point; digSand(world, point, point); }}
        onPointerMove={(event) => { if (!canDig() || drag.current?.pointer !== event.pointerId) return; const point = pos(event); digSand(world, drag.current.point, point); drag.current.point = point; cursor.current = point; }}
        onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
        onBlur={() => { keyboardDig.current = false; cursor.current = null; }}
        onKeyDown={(event) => {
          const dirs: Record<string, Point> = { ArrowLeft: { x: -8, y: 0 }, ArrowRight: { x: 8, y: 0 }, ArrowUp: { x: 0, y: -8 }, ArrowDown: { x: 0, y: 8 } };
          if (event.key !== ' ' && !dirs[event.key]) return;
          event.preventDefault(); if (!canDig()) return;
          const before = cursor.current ?? { x: 200, y: 90 };
          if (event.key === ' ') { if (!event.repeat) keyboardDig.current = !keyboardDig.current; cursor.current = before; }
          else cursor.current = { x: Math.max(12, Math.min(388, before.x + dirs[event.key].x)), y: Math.max(80, Math.min(440, before.y + dirs[event.key].y)) };
          if (keyboardDig.current) digSand(world, before, cursor.current!);
        }} />
      {paused && <div className="sand-pause"><h2>잠깐 멈췄어요</h2><p>돌아왔으면 이어서 파세요.</p><button className="puzzle-primary" onClick={() => { pausedRef.current = false; setPaused(false); }}>계속하기</button></div>}
    </div>
    <p className="sand-status" role="status">{draining ? '삽질 끝! 굴러가는 구슬이 도착하면 점수에 포함돼요.' : '모래는 쓱쓱 · 회색 바위는 피해 가세요'}</p>
    <p className="sand-legend">넓은 통 <b>10점</b> · 중간 통 <b>30점</b> · 좁은 통 <b>50점</b></p>
  </>;
}

export default function SandGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [player, setPlayer] = useState(0);
  const [seed, setSeed] = useState(1);
  const [results, setResults] = useState<SandResult[]>([]);
  const finished = useRef(false);
  const finish = useCallback((result: Omit<SandResult, 'player'>) => {
    if (finished.current) return;
    finished.current = true; setResults((items) => [...items, { ...result, player }]); setPhase('result');
  }, [player]);
  const prepare = () => { setSeed(Math.floor(Math.random() * 4294967296)); setPlayer(0); setResults([]); setPhase('ready'); };
  const result = results.find((item) => item.player === player);
  const ranked = rankSand(results);
  return <main className="puzzle-shell sand-shell" style={{ '--puzzle-player': COLORS[player] } as CSSProperties}>
    <header className="puzzle-topbar"><div><p>COFFEE BREAK · DIG & FLOW</p><h1>모래길 파기</h1></div><button onClick={onExit}>게임 선택</button></header>
    {phase === 'setup' && <section className="puzzle-setup"><div className="puzzle-hero" aria-hidden="true">⛏️</div><p className="puzzle-kicker">내 손끝으로 만드는 구슬길</p><h2>쓱 파면,<br />또르르 굴러가요.</h2><p>모래에 길을 파서 구슬 18개를 점수통으로 보내세요. 구슬이 막히면 옆길을 파서 구해 주세요.</p><div className="puzzle-rule"><strong>넓고 안전한 10점? 좁고 까다로운 50점?</strong><span>구슬은 계속 움직여요. 회색 바위는 팔 수 없어요.<br />25초 동안 파고, 마지막 4초는 도착을 기다려요.</span></div><label className="puzzle-players">참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}명</option>)}</select></label><button className="puzzle-primary" onClick={prepare}>모래판 준비하기</button><p className="puzzle-fine">도착 점수 합계로 순위 · 동점은 공동 순위<br />스마트폰 한 대 · 소리 없이 플레이</p></section>}
    {phase === 'ready' && <section className="puzzle-ready"><span className="puzzle-player-badge">{player + 1}</span><p>{player + 1} / {players}번째 도전</p><h2>{PLAYER_NAMES[player]} 차례</h2><p>구슬 아래부터 눌러서 길을 파세요.<br />다른 사람은 화면을 보지 않기!</p><div className="puzzle-rule"><strong>같은 지형 · 같은 구슬 · 좌우만 바뀌어요</strong><span>25초가 끝나면 더 팔 수 없어요.<br />통 바닥에 도착한 구슬만 점수에 포함됩니다.</span></div><button className="puzzle-primary" onClick={() => { finished.current = false; setPhase('play'); }}>25초 시작</button></section>}
    {phase === 'play' && <section className="puzzle-play sand-play"><div className="puzzle-turn"><i /><strong>{PLAYER_NAMES[player]}의 차례</strong><span>{player + 1} / {players}</span></div><SandTurn key={`${seed}-${player}`} seed={seed} player={player} onDone={finish} /></section>}
    {phase === 'result' && result && <section className="puzzle-result"><p>{PLAYER_NAMES[player]}의 기록</p><h2>{result.score}<small>점</small></h2><p>구슬 {result.collected} / {BALL_COUNT}개 도착</p><div className="sand-breakdown">{[10, 30, 50].map((points) => <div key={points}><b>{points}점 통</b><span>{result.bins.reduce((sum, n, i) => sum + (BIN_POINTS[i] === points ? n : 0), 0)}개</span></div>)}</div><p className="puzzle-fine">도착하지 못한 {BALL_COUNT - result.collected}개는 0점입니다.</p><button className="puzzle-primary" onClick={() => { if (player + 1 === players) setPhase('final'); else { setPlayer(player + 1); setPhase('ready'); } }}>{player + 1 < players ? '화면 가리고 넘기기' : '최종 순위 보기'}</button></section>}
    {phase === 'final' && <section className="puzzle-final"><p className="puzzle-kicker">모래 속에서 찾아낸 오늘의 기록</p><h2>오늘의 순위</h2><p>도착 점수가 높은 순서 · 동점은 공동 순위</p><ol>{ranked.map((item) => <li key={item.player} style={{ '--puzzle-player': COLORS[item.player] } as CSSProperties}><b>{item.rank}<small>위</small></b><i /><div><strong>{PLAYER_NAMES[item.player]}</strong><small>구슬 {item.collected}개 도착</small></div><em>{item.score}<small>점</small></em></li>)}</ol><button className="puzzle-primary" onClick={prepare}>새 모래판으로 한 번 더</button><button className="puzzle-secondary" onClick={() => setPhase('setup')}>인원 바꾸기</button><button className="puzzle-secondary" onClick={onExit}>게임 선택으로</button></section>}
  </main>;
}
