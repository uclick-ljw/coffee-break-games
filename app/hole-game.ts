export const HOLE_W = 400;
export const HOLE_H = 480;
export const HOLE_SECONDS = 30;
export const ARCADE_STEP = 1 / 120;
export type Point = { x: number; y: number };
export const TOYS = [
  { icon: '🔴', name: '단추', radius: 8, points: 10, mass: 1 },
  { icon: '🍬', name: '사탕', radius: 14, points: 30, mass: 3 },
  { icon: '🚙', name: '장난감 차', radius: 22, points: 80, mass: 6 },
  { icon: '🧸', name: '동물 인형', radius: 31, points: 180, mass: 12 },
] as const;
export type Toy = Point & { id: number; tier: number; angle: number; sinking: number; eaten: boolean; hover: number };
export type HoleWorld = { hole: Point; target: Point; radius: number; mass: number; score: number; count: number; elapsed: number; done: boolean; toys: Toy[] };

export function arcadeRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = Math.imul(value ^ (value >>> 15), value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeHoleWorld(seed: number): HoleWorld {
  const random = arcadeRandom(seed);
  const toys: Toy[] = [];
  for (const tier of [3, 2, 1, 0]) {
    const radius = TOYS[tier].radius;
    for (let n = 0; n < [40, 24, 14, 6][tier]; n++) {
      let p: Point = { x: 0, y: 0 }, placed = false;
      for (let attempt = 0; attempt < 4000; attempt++) {
        p = { x: radius + 10 + random() * (HOLE_W - 20 - radius * 2), y: radius + 10 + random() * (HOLE_H - 20 - radius * 2) };
        if (Math.hypot(p.x - 200, p.y - 438) < radius + 24) continue;
        if (toys.every((toy) => Math.hypot(toy.x - p.x, toy.y - p.y) > TOYS[toy.tier].radius + radius + 3)) { placed = true; break; }
      }
      if (!placed) throw new Error('장난감 배치를 준비하지 못했습니다.');
      toys.push({ ...p, id: toys.length, tier, angle: (random() - .5) * .7, sinking: 0, eaten: false, hover: 0 });
    }
  }
  return { hole: { x: 200, y: 438 }, target: { x: 200, y: 438 }, radius: 15, mass: 0, score: 0, count: 0, elapsed: 0, done: false, toys };
}

export function moveHole(world: HoleWorld, target: Point) {
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || world.done || world.elapsed >= HOLE_SECONDS) return;
  world.target = { x: Math.max(world.radius, Math.min(HOLE_W - world.radius, target.x)), y: Math.max(world.radius, Math.min(HOLE_H - world.radius, target.y)) };
}

export function canSwallow(world: HoleWorld, toy: Toy) { return TOYS[toy.tier].radius + 3 <= world.radius; }

export function stepHole(world: HoleWorld, dt = ARCADE_STEP) {
  if (world.done) return;
  world.elapsed += dt;
  if (world.elapsed <= HOLE_SECONDS) {
    const dx = world.target.x - world.hole.x, dy = world.target.y - world.hole.y;
    const fraction = Math.min(1, 100 * dt / (Math.hypot(dx, dy) || 1));
    world.hole.x += dx * fraction; world.hole.y += dy * fraction;
  }
  for (const toy of world.toys) {
    if (toy.eaten) continue;
    if (toy.sinking) {
      toy.sinking += dt;
      if (toy.sinking >= .36) {
        toy.eaten = true; world.score += TOYS[toy.tier].points; world.mass += TOYS[toy.tier].mass; world.count++;
        world.radius = Math.min(43, Math.sqrt(225 + world.mass * 7));
      }
    } else if (world.elapsed <= HOLE_SECONDS && canSwallow(world, toy) && Math.hypot(toy.x - world.hole.x, toy.y - world.hole.y) < world.radius - TOYS[toy.tier].radius * .7) {
      toy.hover += dt;
      if (toy.hover >= .1) toy.sinking = dt;
    } else toy.hover = 0;
  }
  world.done = (world.elapsed >= HOLE_SECONDS && world.toys.every((toy) => toy.eaten || !toy.sinking)) || world.count === world.toys.length;
}

export type ArcadeResult = { player: number; score: number; count: number };
export function rankArcade(results: ArcadeResult[]) {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  return sorted.map((result) => ({ ...result, rank: sorted.findIndex((other) => other.score === result.score) + 1 }));
}
