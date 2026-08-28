export const DODGE_WIDTH = 390;
export const DODGE_HEIGHT = 540;
export const DODGE_FINGER_OFFSET = 52;
export const DODGE_PLAYER_RADIUS = 15;
export const DODGE_MAX_SECONDS = 20;
export const DODGE_FIRST_SPAWN = 0.5;

export type DodgeAnimal = {
  id: string;
  name: string;
  column: number;
  row: number;
  color: string;
};

export const DODGE_ANIMALS: DodgeAnimal[] = [
  { id: 'puppy', name: '강아지', column: 0, row: 0, color: '#f0a45d' },
  { id: 'cat', name: '고양이', column: 1, row: 0, color: '#9b95a2' },
  { id: 'panda', name: '판다', column: 2, row: 0, color: '#3d454f' },
  { id: 'red-panda', name: '레서판다', column: 3, row: 0, color: '#d76835' },
  { id: 'otter', name: '수달', column: 0, row: 1, color: '#9b674d' },
  { id: 'rabbit', name: '토끼', column: 1, row: 1, color: '#e6a371' },
  { id: 'hamster', name: '햄스터', column: 2, row: 1, color: '#e49545' },
  { id: 'quokka', name: '쿼카', column: 3, row: 1, color: '#9b745a' },
];

export type DodgeObstacle = {
  id: number;
  kind: 'ball' | 'block';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  width: number;
  height: number;
  activeAt: number;
  color: string;
};

function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function assignDodgeAnimals(players: number, seed: number) {
  const animals = [...DODGE_ANIMALS];
  const nextRandom = random(seed);
  for (let index = animals.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(nextRandom() * (index + 1));
    [animals[index], animals[swap]] = [animals[swap], animals[index]];
  }
  return animals.slice(0, Math.max(2, Math.min(6, players)));
}

export function dodgeDifficulty(seconds: number) {
  const time = Math.max(0, Math.min(DODGE_MAX_SECONDS, seconds));
  const suddenDeath = Math.max(0, time - 8);
  return {
    speed: 125 + time * 9 + suddenDeath * 8,
    spawnInterval: Math.max(0.24, 0.98 - time * 0.055 - suddenDeath * 0.02),
    warningSeconds: Math.max(0.34, 0.62 - time * 0.018),
  };
}

export function clampDodgePosition(x: number, y: number) {
  return {
    x: Math.max(28, Math.min(DODGE_WIDTH - 28, x)),
    y: Math.max(34, Math.min(DODGE_HEIGHT - 28, y)),
  };
}

export function makeDodgeObstacle(id: number, seconds: number, seed: number): DodgeObstacle {
  const nextRandom = random(seed + id * 7919);
  const difficulty = dodgeDifficulty(seconds);
  const side = Math.floor(nextRandom() * 4);
  const kind = seconds >= 4 && id % 4 === 3 ? 'block' : 'ball';
  const speed = difficulty.speed * (0.9 + nextRandom() * 0.2);
  const targetX = 65 + nextRandom() * (DODGE_WIDTH - 130);
  const targetY = 80 + nextRandom() * (DODGE_HEIGHT - 160);
  const radius = kind === 'ball' ? 16 + nextRandom() * 5 : 0;
  const width = kind === 'block' ? (side % 2 === 0 ? 18 : 80 + nextRandom() * 35) : 0;
  const height = kind === 'block' ? (side % 2 === 0 ? 80 + nextRandom() * 35 : 18) : 0;
  let x = targetX;
  let y = targetY;
  if (side === 0) x = -Math.max(radius, width / 2) - 3;
  if (side === 1) y = -Math.max(radius, height / 2) - 3;
  if (side === 2) x = DODGE_WIDTH + Math.max(radius, width / 2) + 3;
  if (side === 3) y = DODGE_HEIGHT + Math.max(radius, height / 2) + 3;
  const distance = Math.hypot(targetX - x, targetY - y) || 1;
  return {
    id,
    kind,
    x,
    y,
    vx: (targetX - x) / distance * speed,
    vy: (targetY - y) / distance * speed,
    radius,
    width,
    height,
    activeAt: seconds + difficulty.warningSeconds,
    color: ['#ff7a83', '#6ac9ef', '#f7b84b', '#9f83ee'][id % 4],
  };
}

export function advanceDodgeObstacle(obstacle: DodgeObstacle, seconds: number) {
  obstacle.x += obstacle.vx * seconds;
  obstacle.y += obstacle.vy * seconds;
}

export function dodgeObstacleHits(obstacle: DodgeObstacle, x: number, y: number) {
  if (obstacle.kind === 'ball') {
    return Math.hypot(obstacle.x - x, obstacle.y - y) < obstacle.radius + DODGE_PLAYER_RADIUS;
  }
  const closestX = Math.max(obstacle.x - obstacle.width / 2, Math.min(x, obstacle.x + obstacle.width / 2));
  const closestY = Math.max(obstacle.y - obstacle.height / 2, Math.min(y, obstacle.y + obstacle.height / 2));
  return Math.hypot(x - closestX, y - closestY) < DODGE_PLAYER_RADIUS;
}

export function dodgeObstacleGone(obstacle: DodgeObstacle) {
  const margin = 130;
  return obstacle.x < -margin || obstacle.x > DODGE_WIDTH + margin || obstacle.y < -margin || obstacle.y > DODGE_HEIGHT + margin;
}
