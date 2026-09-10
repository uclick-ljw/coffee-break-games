export const SAND_W = 400;
export const SAND_H = 520;
export const CELL = 4;
export const COLS = SAND_W / CELL;
export const ROWS = SAND_H / CELL;
export const SAND_TOP = 80;
export const SAND_BOTTOM = 440;
export const BALL_R = 6.5;
export const BRUSH_R = 22;
export const BALL_COUNT = 18;
export const DIG_SECONDS = 25;
export const DRAIN_SECONDS = 4;
export const STEP = 1 / 120;
export const BIN_EDGES = [12, 112, 176, 224, 288, 388];
export const BIN_POINTS = [10, 30, 50, 30, 10];
export const BIN_TOP = 450;
export const BIN_FLOOR = 506;
export type Point = { x: number; y: number };
export type Rock = { a: Point; b: Point; r: number };
export type SandBall = Point & { id: number; vx: number; vy: number; bin: number | null; collectedAt: number };
export type SandWorld = {
  sand: Uint8Array; rocks: Rock[]; balls: SandBall[]; revision: number;
  elapsed: number; score: number; collected: number; bins: number[]; done: boolean;
};
export type SandResult = { player: number; score: number; collected: number; bins: number[] };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function nearestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

export function makeSandWorld(seed: number, mirrored = false): SandWorld {
  let state = seed >>> 0;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const shift = Math.round((random() - .5) * 36);
  // Wide, deliberately connected passages; randomize within safe bounds, not arbitrary impassable maps.
  const rocks: Rock[] = [
    { a: { x: 121 + shift, y: 170 }, b: { x: 208 + shift, y: 194 }, r: 17 },
    { a: { x: 264 - shift, y: 247 }, b: { x: 324 - shift, y: 224 }, r: 18 },
    { a: { x: 82 + shift, y: 291 }, b: { x: 162 + shift, y: 317 }, r: 17 },
    { a: { x: 170, y: 384 }, b: { x: 230, y: 384 }, r: 17 },
  ];
  if (mirrored) rocks.forEach((rock) => { rock.a.x = SAND_W - rock.a.x; rock.b.x = SAND_W - rock.b.x; });
  const sand = new Uint8Array(COLS * ROWS);
  for (let y = SAND_TOP / CELL; y < SAND_BOTTOM / CELL; y++) {
    for (let x = 3; x < COLS - 3; x++) sand[y * COLS + x] = 1;
  }
  const offset = (random() - .5) * 32;
  const balls = Array.from({ length: BALL_COUNT }, (_, id) => {
    const x = 200 + offset + (id % 6 - 2.5) * 14;
    return { id, x: mirrored ? SAND_W - x : x, y: 25 + Math.floor(id / 6) * 15, vx: 0, vy: 0, bin: null, collectedAt: -1 };
  });
  return { sand, rocks, balls, revision: 0, elapsed: 0, score: 0, collected: 0, bins: [0, 0, 0, 0, 0], done: false };
}

export function digSand(world: SandWorld, from: Point, to: Point): number {
  if (world.done || world.elapsed >= DIG_SECONDS || ![from.x, from.y, to.x, to.y].every(Number.isFinite)) return 0;
  const a = { x: clamp(from.x, 0, SAND_W), y: clamp(from.y, 0, SAND_H) };
  const b = { x: clamp(to.x, 0, SAND_W), y: clamp(to.y, 0, SAND_H) };
  let removed = 0;
  for (let y = Math.max(SAND_TOP / CELL, Math.floor((Math.min(a.y, b.y) - BRUSH_R) / CELL)); y < Math.min(SAND_BOTTOM / CELL, Math.ceil((Math.max(a.y, b.y) + BRUSH_R) / CELL)); y++) {
    for (let x = Math.max(3, Math.floor((Math.min(a.x, b.x) - BRUSH_R) / CELL)); x < Math.min(COLS - 3, Math.ceil((Math.max(a.x, b.x) + BRUSH_R) / CELL)); x++) {
      const p = { x: (x + .5) * CELL, y: (y + .5) * CELL };
      const near = nearestOnSegment(p, a, b);
      if ((p.x - near.x) ** 2 + (p.y - near.y) ** 2 <= BRUSH_R ** 2 && world.sand[y * COLS + x]) {
        world.sand[y * COLS + x] = 0; removed++;
      }
    }
  }
  if (removed) world.revision++;
  return removed;
}

function bounce(ball: SandBall, nx: number, ny: number, depth: number, restitution = .12) {
  ball.x += nx * depth; ball.y += ny * depth;
  const inward = ball.vx * nx + ball.vy * ny;
  if (inward < 0) { ball.vx -= (1 + restitution) * inward * nx; ball.vy -= (1 + restitution) * inward * ny; }
}

function capsule(ball: SandBall, rock: Rock) {
  const near = nearestOnSegment(ball, rock.a, rock.b);
  const dx = ball.x - near.x, dy = ball.y - near.y;
  const distance = Math.hypot(dx, dy), reach = rock.r + BALL_R;
  if (distance < reach) bounce(ball, distance ? dx / distance : 0, distance ? dy / distance : -1, reach - distance);
}

function terrainContact(world: SandWorld, ball: SandBall) {
  // ponytail: a 4px solid mask, not thousands of simulated sand grains. Only nearby cells are queried.
  // Same mask is rendered and excavated; 120Hz + bounded velocity prevents tunnelling through a cell.
  const x0 = clamp(Math.floor((ball.x - BALL_R) / CELL), 0, COLS - 1);
  const x1 = clamp(Math.floor((ball.x + BALL_R) / CELL), 0, COLS - 1);
  const y0 = clamp(Math.floor((ball.y - BALL_R) / CELL), 0, ROWS - 1);
  const y1 = clamp(Math.floor((ball.y + BALL_R) / CELL), 0, ROWS - 1);
  let hit: { nx: number; ny: number; depth: number } | null = null;
  // Deepest first avoids order-dependent forces at adjoining grid seams.
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!world.sand[y * COLS + x]) continue;
    const dx = ball.x - clamp(ball.x, x * CELL, (x + 1) * CELL);
    const dy = ball.y - clamp(ball.y, y * CELL, (y + 1) * CELL);
    const distance = Math.hypot(dx, dy);
    if (distance >= BALL_R) continue;
    const depth = BALL_R - distance;
    if (!hit || depth > hit.depth) hit = { nx: distance ? dx / distance : 0, ny: distance ? dy / distance : -1, depth };
  }
  if (hit) bounce(ball, hit.nx, hit.ny, hit.depth, .02);
}

function boundaries(world: SandWorld, ball: SandBall) {
  if (ball.x < 12 + BALL_R) bounce(ball, 1, 0, 12 + BALL_R - ball.x);
  if (ball.x > 388 - BALL_R) bounce(ball, -1, 0, ball.x - 388 + BALL_R);
  if (ball.y < BALL_R + 4) bounce(ball, 0, 1, BALL_R + 4 - ball.y);
  for (let i = 1; i < BIN_EDGES.length - 1; i++) {
    capsule(ball, { a: { x: BIN_EDGES[i], y: BIN_TOP }, b: { x: BIN_EDGES[i], y: BIN_FLOOR }, r: 2 });
  }
  world.rocks.forEach((rock) => capsule(ball, rock));
  if (ball.y >= BIN_FLOOR - BALL_R) {
    ball.y = BIN_FLOOR - BALL_R;
    const bin = BIN_POINTS.findIndex((_, i) => ball.x >= BIN_EDGES[i] && ball.x < BIN_EDGES[i + 1]);
    if (bin >= 0 && ball.bin === null) {
      ball.bin = bin; ball.vx = 0; ball.vy = 0; ball.collectedAt = world.elapsed;
      world.score += BIN_POINTS[bin]; world.collected++; world.bins[bin]++;
    }
  }
}

export function stepSand(world: SandWorld) {
  if (world.done) return;
  world.elapsed += STEP;
  const active = world.balls.filter((ball) => ball.bin === null);
  for (const ball of active) {
    ball.vy = Math.min(320, ball.vy + 620 * STEP);
    ball.vx *= .999;
    ball.vx = clamp(ball.vx, -320, 320);
    ball.x += ball.vx * STEP; ball.y += ball.vy * STEP;
  }
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      if (a.bin !== null || b.bin !== null) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= BALL_R * 2) continue;
      const nx = d ? dx / d : 1, ny = d ? dy / d : 0;
      const overlap = (BALL_R * 2 - d) / 2;
      a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
      const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relative < 0) {
        const impulse = -.54 * relative;
        a.vx -= impulse * nx; a.vy -= impulse * ny; b.vx += impulse * nx; b.vy += impulse * ny;
      }
    }
    for (const ball of active) if (ball.bin === null) { terrainContact(world, ball); boundaries(world, ball); }
  }
  // No early loss while a ball is still travelling: a visible drain period follows digging.
  world.done = world.collected === BALL_COUNT || world.elapsed >= DIG_SECONDS + DRAIN_SECONDS - STEP / 2;
}

export function rankSand(results: SandResult[]) {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  let rank = 1;
  return sorted.map((result, i) => {
    if (i && sorted[i - 1].score !== result.score) rank = i + 1;
    return { ...result, rank };
  });
}
