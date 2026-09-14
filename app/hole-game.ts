export const HOLE_W = 400;
export const HOLE_H = 480;
export const HOLE_SECONDS = 30;
export const ARCADE_STEP = 1 / 120;
export const HOLE_SPEED = 100;
export type Point = { x: number; y: number };
export const TOYS = [
  { icon: '🔵', name: '단추', radius: 10, points: 10, mass: 1 },
  { icon: '🍬', name: '사탕', radius: 16, points: 30, mass: 3 },
  { icon: '🚙', name: '자동차', radius: 24, points: 80, mass: 6 },
  { icon: '🧸', name: '인형', radius: 33, points: 180, mass: 12 },
] as const;
export type Toy = Point & { id: number; tier: number; angle: number; sinking: number; eaten: boolean; eatenAt: number; hover: number };
export type HoleWorld = { hole: Point; target: Point; steering: Point | null; radius: number; mass: number; score: number; count: number; elapsed: number; duration: number; done: boolean; blockedUntil: number; grewAt: number; toys: Toy[] };

export function arcadeRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = Math.imul(value ^ (value >>> 15), value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeHoleWorld(seed: number, player = 0, duration = HOLE_SECONDS): HoleWorld {
  const random = arcadeRandom(seed), toys: Toy[] = [];
  const add = (p: Point, tier: number) => toys.push({ ...p, id: toys.length, tier, angle: (random() - .5) * .7, sinking: 0, eaten: false, eatenAt: -10, hover: 0 });
  // A reachable starter trail teaches growth before searching the whole board.
  for (const [dx, dy] of [[-42, -32], [0, -54], [42, -32], [-58, -66], [58, -66], [-22, -92], [22, -92], [0, -127]]) add({ x: 200 + dx, y: 438 + dy }, 0);
  for (const tier of [3, 2, 1, 0]) {
    const radius = TOYS[tier].radius;
    for (let n = 0; n < [24, 24, 14, 6][tier]; n++) {
      let p: Point = { x: 0, y: 0 }, placed = false;
      for (let attempt = 0; attempt < 4000; attempt++) {
        p = { x: radius + 10 + random() * (HOLE_W - 20 - radius * 2), y: radius + 10 + random() * (HOLE_H - 20 - radius * 2) };
        if (Math.hypot(p.x - 200, p.y - 438) < radius + 24) continue;
        if (toys.every((toy) => Math.hypot(toy.x - p.x, toy.y - p.y) > TOYS[toy.tier].radius + radius + 3)) { placed = true; break; }
      }
      if (!placed) throw new Error('장난감 배치를 준비하지 못했습니다.');
      add(p, tier);
    }
  }
  const mirror = (p: Point) => ({ x: player % 2 ? HOLE_W - p.x : p.x, y: Math.floor(player / 2) % 2 ? HOLE_H - p.y : p.y });
  const hole = mirror({ x: 200, y: 438 });
  return { hole, target: { ...hole }, steering: null, radius: 17, mass: 0, score: 0, count: 0, elapsed: 0, duration, done: false, blockedUntil: 0, grewAt: -10, toys: toys.map((toy) => ({ ...toy, ...mirror(toy) })) };
}

export function moveHole(world: HoleWorld, target: Point) {
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || world.done || world.elapsed >= world.duration) return;
  world.steering = null;
  world.target = { x: Math.max(world.radius, Math.min(HOLE_W - world.radius, target.x)), y: Math.max(world.radius, Math.min(HOLE_H - world.radius, target.y)) };
}

export function steerHole(world: HoleWorld, direction: Point) {
  if (!Number.isFinite(direction.x) || !Number.isFinite(direction.y) || world.done || world.elapsed >= world.duration) return;
  const length = Math.hypot(direction.x, direction.y);
  world.steering = length < .12 ? { x: 0, y: 0 } : { x: direction.x / Math.max(1, length), y: direction.y / Math.max(1, length) };
  world.target = { ...world.hole };
}

export function canSwallow(world: HoleWorld, toy: Toy) { return TOYS[toy.tier].radius + 3 <= world.radius; }

export function holeGrowth(world: Pick<HoleWorld, 'radius' | 'mass'>) {
  const tier = TOYS.reduce((best, toy, index) => toy.radius + 3 <= world.radius ? index : best, 0);
  const threshold = (index: number) => index === 0 ? 0 : Math.ceil(((TOYS[index].radius + 3) ** 2 - 289) / 8);
  const from = threshold(tier), next = tier < 3 ? threshold(tier + 1) : from;
  return { tier, progress: tier === 3 ? 1 : Math.min(1, (world.mass - from) / (next - from)) };
}

export function stepHole(world: HoleWorld, dt = ARCADE_STEP) {
  if (world.done || !Number.isFinite(dt) || dt <= 0) return;
  world.elapsed += dt;
  if (world.elapsed <= world.duration) {
    const dx = world.target.x - world.hole.x, dy = world.target.y - world.hole.y;
    const fraction = Math.min(1, HOLE_SPEED * dt / (Math.hypot(dx, dy) || 1));
    world.hole.x += world.steering ? world.steering.x * HOLE_SPEED * dt : dx * fraction;
    world.hole.y += world.steering ? world.steering.y * HOLE_SPEED * dt : dy * fraction;
    world.hole.x = Math.max(world.radius, Math.min(HOLE_W - world.radius, world.hole.x));
    world.hole.y = Math.max(world.radius, Math.min(HOLE_H - world.radius, world.hole.y));
  }
  for (const toy of world.toys) {
    if (toy.eaten) continue;
    if (toy.sinking) {
      toy.sinking += dt;
      if (toy.sinking >= .36) {
        const tier = holeGrowth(world).tier;
        toy.eaten = true; toy.eatenAt = world.elapsed; world.score += TOYS[toy.tier].points; world.mass += TOYS[toy.tier].mass; world.count++;
        world.radius = Math.min(43, Math.sqrt(289 + world.mass * 8));
        if (holeGrowth(world).tier > tier) world.grewAt = world.elapsed;
      }
    } else if (world.elapsed <= world.duration) {
      const dx = world.hole.x - toy.x, dy = world.hole.y - toy.y, distance = Math.hypot(dx, dy);
      if (canSwallow(world, toy)) {
        if (distance < world.radius + TOYS[toy.tier].radius * .3) {
          const pull = Math.min(1, 55 * dt / (distance || 1));
          toy.x += dx * pull; toy.y += dy * pull;
        }
        if (distance < world.radius - TOYS[toy.tier].radius * .45) {
          toy.hover += dt;
          if (toy.hover >= .07) toy.sinking = dt;
        } else toy.hover = 0;
      } else if (distance < TOYS[toy.tier].radius) world.blockedUntil = world.elapsed + .5;
    }
  }
  world.done = (world.elapsed >= world.duration && world.toys.every((toy) => toy.eaten || !toy.sinking)) || world.count === world.toys.length;
}

export type ArcadeResult = { player: number; score: number; count: number };
export function rankArcade(results: ArcadeResult[]) {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  return sorted.map((result) => ({ ...result, rank: sorted.findIndex((other) => other.score === result.score) + 1 }));
}
