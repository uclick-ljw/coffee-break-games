'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { PLAYER_NAMES } from './game';
import { ARCADE_STEP, HOLE_H, HOLE_SECONDS, HOLE_W, TOYS, canSwallow, holeGrowth, makeHoleWorld, moveHole, rankArcade, steerHole, stepHole, type ArcadeResult, type HoleWorld, type Point } from './hole-game';

type Phase = 'setup' | 'ready' | 'practice' | 'play' | 'result' | 'final';
type Result = ArcadeResult & { collected: number[] };
const COLORS = ['#168ad5', '#e37627', '#8b6edb', '#199474', '#d84386', '#a78210'];
const SPRITES = [[80, 100, 490, 468], [650, 110, 566, 425], [60, 638, 492, 557], [670, 626, 490, 544]];
const RULE = '단추 10 · 사탕 30 · 자동차 80 · 인형 180점';

function drawHole(ctx: CanvasRenderingContext2D, world: HoleWorld, atlas: HTMLImageElement, color: string, reducedMotion: boolean) {
  const bg = ctx.createLinearGradient(0, 0, 400, 480); bg.addColorStop(0, '#193f54'); bg.addColorStop(1, '#142e47');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 400, 480);
  ctx.strokeStyle = '#ffffff09'; ctx.lineWidth = 1;
  for (let x = 20; x < 400; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 480); ctx.stroke(); }
  for (let y = 20; y < 480; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(400, y); ctx.stroke(); }
  const { x, y } = world.hole, r = world.radius, growthAge = world.elapsed - world.grewAt;
  if (growthAge < .8 && !reducedMotion) {
    ctx.globalAlpha = 1 - growthAge / .8; ctx.strokeStyle = '#a2ffe6'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, r + growthAge * 45, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.shadowColor = '#43e7ed'; ctx.shadowBlur = 13; ctx.strokeStyle = '#84fbef'; ctx.lineWidth = 3;
  ctx.fillStyle = '#01030c'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath();
  const spin = reducedMotion ? 0 : world.elapsed * 2;
  ctx.arc(x, y, r + 5, spin, spin + Math.PI * 1.5); ctx.stroke();
  for (const toy of world.toys) {
    const spec = TOYS[toy.tier];
    if (toy.eaten) {
      const age = world.elapsed - toy.eatenAt;
      if (age < .65) {
        ctx.globalAlpha = 1 - age / .65; ctx.fillStyle = '#fff7b6'; ctx.font = '900 19px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('+' + spec.points, toy.x, toy.y - 12 - (reducedMotion ? 0 : age * 28)); ctx.globalAlpha = 1;
      }
      continue;
    }
    const t = Math.min(1, toy.sinking / .36), size = spec.radius * (1 - t * .85);
    const tx = toy.x + (x - toy.x) * t, ty = toy.y + (y - toy.y) * t;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(toy.angle + (reducedMotion ? 0 : t * 1.8)); ctx.globalAlpha = 1 - t;
    if (!t && canSwallow(world, toy)) {
      ctx.strokeStyle = '#83f4baca'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.arc(0, 0, spec.radius + 3, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#0003'; ctx.beginPath(); ctx.ellipse(1, size * .55, size * .8, size * .35, 0, 0, Math.PI * 2); ctx.fill();
    if (atlas.complete && atlas.naturalWidth) {
      const [sx, sy, sw, sh] = SPRITES[toy.tier], scale = size * 2 / Math.max(sw, sh);
      ctx.drawImage(atlas, sx, sy, sw, sh, -sw * scale / 2, -sh * scale / 2, sw * scale, sh * scale);
    } else {
      ctx.fillStyle = '#fff'; ctx.font = size * 1.8 + 'px "Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(spec.icon, 0, 1);
    }
    ctx.restore();
  }
  const tier = holeGrowth(world).tier;
  const message = growthAge < 1.6 ? TOYS[tier].name + '도 한입에! LEVEL UP' : world.blockedUntil > world.elapsed ? '아직 커요 · ' + TOYS[tier].name + '부터!' : '';
  if (message) {
    ctx.fillStyle = '#092c42ed'; ctx.beginPath(); ctx.roundRect(37, 13, 326, 37, 14); ctx.fill();
    ctx.fillStyle = growthAge < 1.6 ? '#a7ffe0' : '#ffddb0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 16px system-ui'; ctx.fillText(message, 200, 32);
  }
}

function HoleTurn({ seed, player, practice, onDone }: { seed: number; player: number; practice: boolean; onDone: (result: Omit<Result, 'player'>) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null), world = useRef<HoleWorld | null>(null);
  const drag = useRef<{ id: number; pad: boolean; start: Point } | null>(null), keys = useRef(new Set<string>());
  const pausedRef = useRef(false), countdownRef = useRef(3), finish = useRef(onDone);
  const [paused, setPaused] = useState(false), [countdown, setCountdown] = useState(3), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [retry, setRetry] = useState(0), [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [hud, setHud] = useState({ score: 0, count: 0, seconds: practice ? 10 : 30, tier: 0, progress: 0 });
  useEffect(() => { finish.current = onDone; }, [onDone]);
  const stop = () => { drag.current = null; keys.current.clear(); setStick(null); if (world.current) steerHole(world.current, { x: 0, y: 0 }); };
  const pause = () => { stop(); pausedRef.current = true; setPaused(true); };
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d');
    if (!element || !ctx) return;
    let disposed = false, frame = 0, previous = 0, accumulator = 0, lastHUD = -1, reported = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1); element.width = HOLE_W * dpr; element.height = HOLE_H * dpr; ctx.scale(dpr, dpr);
    const atlas = new Image(); atlas.src = '/hole-toys.png';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    countdownRef.current = 3; pausedRef.current = document.hidden;
    const onHidden = () => {
      if (document.hidden) {
        previous = 0; accumulator = 0; drag.current = null; keys.current.clear(); setStick(null);
        if (world.current) steerHole(world.current, { x: 0, y: 0 });
        pausedRef.current = true; setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    const tick = (now: number) => {
      if (disposed) return;
      if (pausedRef.current) { previous = 0; accumulator = 0; frame = requestAnimationFrame(tick); return; }
      const delta = previous ? (now - previous) / 1000 : 0; previous = now;
      const h = world.current!;
      if (countdownRef.current > 0) {
        countdownRef.current = Math.max(0, countdownRef.current - delta); setCountdown(Math.ceil(countdownRef.current));
      } else {
        accumulator += delta;
        while (accumulator >= ARCADE_STEP && !h.done) { stepHole(h); accumulator -= ARCADE_STEP; }
      }
      drawHole(ctx, h, atlas, COLORS[player], reducedMotion);
      if (h.elapsed - lastHUD > .08 || h.done) {
        setHud({ score: h.score, count: h.count, seconds: Math.max(0, Math.ceil(h.duration - h.elapsed)), ...holeGrowth(h) }); lastHUD = h.elapsed;
      }
      if (h.done) {
        if (!reported) {
          reported = true;
          finish.current({ score: h.score, count: h.count, collected: TOYS.map((_, tier) => h.toys.filter((toy) => toy.eaten && toy.tier === tier).length) });
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    try {
      world.current = makeHoleWorld(seed, player, practice ? 10 : HOLE_SECONDS);
      drawHole(ctx, world.current, atlas, COLORS[player], reducedMotion);
      // An unavailable image uses the emoji fallback; it must never prevent a turn.
      atlas.decode().catch(() => {}).then(() => { if (!disposed) { setLoading(false); setPaused(pausedRef.current); frame = requestAnimationFrame(tick); } });
    } catch {
      queueMicrotask(() => { if (!disposed) setError('게임판을 준비하지 못했어요. 다시 준비해 주세요.'); });
    }
    return () => { disposed = true; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onHidden); world.current = null; };
  }, [seed, player, practice, retry]);

  const locked = () => pausedRef.current || countdownRef.current > 0 || !world.current || world.current.done;
  const pos = (event: ReactPointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width * 400, y: (event.clientY - rect.top) / rect.height * 480 }; };
  const end = (event: ReactPointerEvent<HTMLElement>, cancel = false) => {
    if (drag.current?.id !== event.pointerId) return;
    if (drag.current.pad || cancel) stop(); else drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyboard = (event: ReactKeyboardEvent, down: boolean) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); if (locked()) return;
    if (down) keys.current.add(event.key); else keys.current.delete(event.key);
    steerHole(world.current!, { x: Number(keys.current.has('ArrowRight')) - Number(keys.current.has('ArrowLeft')), y: Number(keys.current.has('ArrowDown')) - Number(keys.current.has('ArrowUp')) });
  };
  return <>
    <div className="arcade-hud"><div><span>{practice ? '연습 점수 · 순위 제외' : '모은 점수'}</span><strong>{hud.score}<small>점</small></strong></div><div className={hud.seconds <= 5 ? 'hole-urgent' : ''}><span>남은 시간</span><strong>{hud.seconds}<small>초</small></strong></div><button className="hole-pause-button" onClick={pause} disabled={paused || loading || !!error} aria-label="잠깐 멈추기">Ⅱ</button></div>
    <div className="hole-growth"><div><strong>Lv.{hud.tier + 1} · {TOYS[hud.tier].name}까지 꿀꺽</strong><span>{hud.tier === 3 ? '모든 장난감 OK!' : '다음: ' + TOYS[hud.tier + 1].name}</span></div><progress value={hud.progress} max={1} aria-label="다음 크기까지 성장" /></div>
    <div className="arcade-stage">
      <canvas ref={canvas} className="arcade-board" style={{ visibility: paused ? 'hidden' : 'visible' }} tabIndex={paused ? -1 : 0} aria-hidden={paused} role="application" aria-label="블랙홀 게임판. 누르면 이동합니다. 방향키를 누르고 있어도 이동합니다." onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (locked() || drag.current || event.button !== 0) return;
          event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
          keys.current.clear(); drag.current = { id: event.pointerId, pad: false, start: pos(event) }; moveHole(world.current!, pos(event));
        }}
        onPointerMove={(event) => { if (!locked() && drag.current?.id === event.pointerId) moveHole(world.current!, pos(event)); }}
        onPointerUp={(event) => end(event)} onPointerCancel={(event) => end(event, true)} onLostPointerCapture={(event) => end(event, true)}
        onKeyDown={(event) => keyboard(event, true)} onKeyUp={(event) => keyboard(event, false)} onBlur={stop} />
      {(paused || error || loading || countdown > 0) && <div className={'arcade-overlay' + (paused ? ' hole-paused' : !error && !loading ? ' hole-countdown' : '')}>
        <h2>{error ? '잠깐, 다시 준비할게요' : paused ? '잠깐 멈췄어요' : loading ? '장난감 준비 중…' : countdown}</h2>
        {error ? <><p>{error}</p><button className="puzzle-primary" onClick={() => { setError(''); setLoading(true); setCountdown(3); setRetry((n) => n + 1); }}>다시 준비하기</button></> : paused ? <button className="puzzle-primary" onClick={() => { pausedRef.current = false; setPaused(false); }}>계속하기</button> : !loading ? <p>아래 패드를 누르고 방향으로 밀기</p> : null}
      </div>}
    </div>
    <div className="hole-pad" role="application" tabIndex={0} aria-label="블랙홀 조작 패드. 누른 곳에서 원하는 방향으로 밀고, 손을 떼면 멈춥니다." aria-disabled={paused || countdown > 0 || loading}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (locked() || drag.current || event.button !== 0) return;
        event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
        const rect = event.currentTarget.getBoundingClientRect();
        drag.current = { id: event.pointerId, pad: true, start: { x: event.clientX, y: event.clientY } };
        setStick({ x: event.clientX - rect.left, y: event.clientY - rect.top, dx: 0, dy: 0 }); steerHole(world.current!, { x: 0, y: 0 });
      }}
      onPointerMove={(event) => {
        if (locked() || drag.current?.id !== event.pointerId) return;
        const dx = event.clientX - drag.current.start.x, dy = event.clientY - drag.current.start.y, length = Math.max(30, Math.hypot(dx, dy));
        steerHole(world.current!, { x: dx / 30, y: dy / 30 });
        setStick((current) => current && { ...current, dx: dx / length * 30, dy: dy / length * 30 });
      }}
      onPointerUp={(event) => end(event)} onPointerCancel={(event) => end(event, true)} onLostPointerCapture={(event) => end(event, true)}
      onKeyDown={(event) => keyboard(event, true)} onKeyUp={(event) => keyboard(event, false)} onBlur={stop}>
      {stick ? <i className="hole-stick-base" style={{ left: stick.x, top: stick.y }}><i style={{ transform: 'translate(' + stick.dx + 'px,' + stick.dy + 'px)' }} /></i> : <span><b>✥</b> 여기를 누르고 원하는 방향으로 밀기<small>손을 떼면 멈춰요</small></span>}
    </div>
    <p className="arcade-status">{hud.count}개 꿀꺽 · 초록 테두리부터 먹으세요</p>
    {practice && <button className="puzzle-secondary hole-practice-end" onClick={() => onDone({ score: 0, count: 0, collected: [0, 0, 0, 0] })}>연습 끝내기</button>}
  </>;
}

export function HoleGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup'), [players, setPlayers] = useState(2), [player, setPlayer] = useState(0), [seed, setSeed] = useState(1), [results, setResults] = useState<Result[]>([]);
  const finished = useRef(false);
  const finish = useCallback((result: Omit<Result, 'player'>) => { if (finished.current) return; finished.current = true; setResults((items) => [...items, { ...result, player }]); setPhase('result'); }, [player]);
  const prepare = () => { setSeed(Math.floor(Math.random() * 4294967296)); setPlayer(0); setResults([]); setPhase('ready'); };
  const result = results.find((item) => item.player === player);
  return <main className="puzzle-shell arcade-shell" style={{ '--puzzle-player': COLORS[player] } as CSSProperties}>
    <header className="puzzle-topbar"><div><p>COFFEE BREAK · NEW GAME</p><h1>블랙홀 대청소</h1></div><button onClick={onExit}>게임 선택</button></header>
    {phase === 'setup' && <section className="puzzle-setup"><div className="puzzle-hero" aria-hidden="true">🕳️</div><h2>작은 것부터,<br />마지막엔 한입에.</h2><p>작은 단추를 먹어 구멍을 키우세요.<br />커질수록 더 비싼 장난감도 꿀꺽!</p><div className="puzzle-rule"><strong>{RULE}</strong><span>아래 조작 패드를 눌러 방향으로 밀기.<br />초록 테두리 = 지금 먹을 수 있어요.</span></div><label className="puzzle-players">참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}명</option>)}</select></label><button className="puzzle-primary" onClick={prepare}>게임판 준비하기</button><p className="puzzle-fine">한 기기로 돌려가며 · 1인 30초 · 점수가 높은 순서<br />동점은 공동 순위 · 소리 없이 플레이</p></section>}
    {phase === 'ready' && <section className="puzzle-ready"><span className="puzzle-player-badge">{player + 1}</span><p>{player + 1} / {players}번째 도전</p><h2>{PLAYER_NAMES[player]} 차례</h2><p>아래 패드를 밀면 그 방향으로 움직여요.<br />게임판을 직접 눌러 이동해도 좋아요.</p><div className="puzzle-rule"><strong>같은 구성, 뒤집힌 배치</strong><span>물건 수와 시작 거리는 같아요.<br />다른 사람은 화면을 보지 말고 기다려 주세요.</span></div><button className="puzzle-primary" onClick={() => { finished.current = false; setPhase('play'); }}>30초 시작</button><button className="puzzle-secondary" onClick={() => setPhase('practice')}>먼저 10초 연습하기</button><p className="puzzle-fine">연습은 다른 판 · 순위에 들어가지 않아요</p></section>}
    {(phase === 'play' || phase === 'practice') && <section className="puzzle-play"><div className="puzzle-turn"><i /><strong>{PLAYER_NAMES[player]}{phase === 'practice' ? ' 연습 중' : '의 차례'}</strong><span>{player + 1} / {players}</span></div><HoleTurn key={seed + '-' + player + '-' + phase} seed={phase === 'practice' ? seed ^ 0x6e624eb7 : seed} player={player} practice={phase === 'practice'} onDone={phase === 'practice' ? () => setPhase('ready') : finish} /></section>}
    {phase === 'result' && result && <section className="puzzle-result"><p>{PLAYER_NAMES[player]}의 기록</p><h2>{result.score}<small>점</small></h2><p>장난감 {result.count}개 꿀꺽!</p><div className="hole-breakdown">{TOYS.map((toy, tier) => <div key={toy.name}><b>{toy.icon} {toy.name}</b><span>{result.collected[tier]}개</span><small>{result.collected[tier] * toy.points}점</small></div>)}</div><p className="puzzle-fine">시간 안에 삼키기 시작한 장난감까지 계산했어요.</p><button className="puzzle-primary" onClick={() => { if (player + 1 === players) setPhase('final'); else { setPlayer(player + 1); setPhase('ready'); } }}>{player + 1 < players ? '화면 가리고 넘기기' : '최종 순위 보기'}</button></section>}
    {phase === 'final' && <section className="puzzle-final"><p className="puzzle-kicker">블랙홀 대청소</p><h2>오늘의 순위</h2><p>점수가 높은 순서 · 동점은 공동 순위</p><ol>{rankArcade(results).map((item) => <li key={item.player} style={{ '--puzzle-player': COLORS[item.player] } as CSSProperties}><b>{item.rank}<small>위</small></b><i /><div><strong>{PLAYER_NAMES[item.player]}</strong><small>장난감 {item.count}개</small></div><em>{item.score}<small>점</small></em></li>)}</ol><button className="puzzle-primary" onClick={prepare}>새 게임판으로 한 번 더</button><button className="puzzle-secondary" onClick={() => setPhase('setup')}>인원 바꾸기</button><button className="puzzle-secondary" onClick={onExit}>게임 선택으로</button></section>}
  </main>;
}
