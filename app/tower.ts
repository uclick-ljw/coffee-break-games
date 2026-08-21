export const TOWER_WIDTH = 360;
export const TOWER_HEIGHT = 500;
export const WALL_LEFT = 36;
export const WALL_RIGHT = 324;
export const BALL_RADIUS = 10;

export type Ball = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  fallen: boolean;
};

export type Pin = {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  side: 'left' | 'right';
  color: string;
  progress: number;
  removing: boolean;
  gone: boolean;
};

export type Tower = {
  balls: Ball[];
  pins: Pin[];
};

const BALL_COLORS = ['#ef476f', '#ff9f1c', '#ffd166', '#06d6a0', '#3a86ff', '#8b5cf6'];
const PIN_COLORS = ['#ec6b56', '#f3b63f', '#54a8d8', '#6a78c8'];

function random(seed: number, index: number) {
  let value = Math.imul(seed ^ (index + 1), 2654435761);
  value ^= value >>> 15;
  value = Math.imul(value, 2246822519);
  return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
}

export function towerCounts(players: number) {
  return { pins: Math.max(12, players * 3), balls: 12 + players * 3 };
}

export function createTower(players: number, seed: number): Tower {
  const counts = towerCounts(players);
  const pairs = Math.floor(counts.pins / 2);
  const pins: Pin[] = [];
  for (let layer = 0; layer < pairs; layer += 1) {
    const y = 150 + layer * (285 / Math.max(1, pairs - 1));
    const lean = (random(seed, layer) - 0.5) * 14;
    pins.push({
      id: pins.length,
      x1: 22,
      y1: y - lean,
      x2: 236 + random(seed, 40 + layer) * 34,
      y2: y + lean,
      side: 'left',
      color: PIN_COLORS[pins.length % PIN_COLORS.length],
      progress: 0,
      removing: false,
      gone: false,
    });
    pins.push({
      id: pins.length,
      x1: 90 + random(seed, 80 + layer) * 34,
      y1: y + lean,
      x2: 338,
      y2: y - lean,
      side: 'right',
      color: PIN_COLORS[pins.length % PIN_COLORS.length],
      progress: 0,
      removing: false,
      gone: false,
    });
  }
  if (pins.length < counts.pins) {
    pins.push({
      id: pins.length,
      x1: 22,
      y1: 286,
      x2: 338,
      y2: 300,
      side: 'left',
      color: PIN_COLORS[pins.length % PIN_COLORS.length],
      progress: 0,
      removing: false,
      gone: false,
    });
  }

  const balls: Ball[] = Array.from({ length: counts.balls }, (_, id) => ({
    id,
    x: 62 + (id % 10) * 26 + (random(seed, 130 + id) - 0.5) * 4,
    y: 45 + Math.floor(id / 10) * 23,
    vx: 0,
    vy: 0,
    color: BALL_COLORS[id % BALL_COLORS.length],
    fallen: false,
  }));

  const tower = { balls, pins };
  for (let step = 0; step < 1200; step += 1) stepTower(tower, 1 / 120);
  for (const ball of balls) {
    ball.vx = 0;
    ball.vy = 0;
  }
  return tower;
}

export function removePin(tower: Tower, id: number) {
  const pin = tower.pins.find((item) => item.id === id);
  if (!pin || pin.gone || pin.removing) return false;
  pin.removing = true;
  return true;
}

export function visibleSegment(pin: Pin) {
  const offset = (pin.side === 'left' ? -1 : 1) * (TOWER_WIDTH + 50) * pin.progress;
  return { x1: pin.x1 + offset, y1: pin.y1, x2: pin.x2 + offset, y2: pin.y2 };
}

function collidePin(ball: Ball, pin: Pin) {
  if (pin.gone) return;
  const { x1, y1, x2, y2 } = visibleSegment(pin);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((ball.x - x1) * dx + (ball.y - y1) * dy) / lengthSquared));
  const closestX = x1 + dx * t;
  const closestY = y1 + dy * t;
  let nx = ball.x - closestX;
  let ny = ball.y - closestY;
  const distance = Math.hypot(nx, ny);
  const minimum = BALL_RADIUS + 4.5;
  if (distance >= minimum) return;
  if (distance < 0.001) {
    nx = -dy;
    ny = dx;
  }
  const normalLength = Math.hypot(nx, ny);
  nx /= normalLength;
  ny /= normalLength;
  const overlap = minimum - distance;
  ball.x += nx * overlap;
  ball.y += ny * overlap;
  const velocity = ball.vx * nx + ball.vy * ny;
  if (velocity < 0) {
    ball.vx -= velocity * 1.16 * nx;
    ball.vy -= velocity * 1.16 * ny;
    ball.vx *= 0.91;
  }
}

function collideBalls(a: Ball, b: Ball) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let distance = Math.hypot(dx, dy);
  const minimum = BALL_RADIUS * 2;
  if (distance >= minimum) return;
  if (distance < 0.001) {
    dx = 1;
    dy = 0;
    distance = 1;
  }
  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = (minimum - distance) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;
  const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (relative >= 0) return;
  const impulse = -relative * 0.58;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;
}

export function stepTower(tower: Tower, dt: number) {
  const newlyFallen: number[] = [];
  for (const pin of tower.pins) {
    if (!pin.removing || pin.gone) continue;
    pin.progress = Math.min(1, pin.progress + dt / 0.28);
    if (pin.progress === 1) {
      pin.gone = true;
      pin.removing = false;
    }
  }

  const active = tower.balls.filter((ball) => !ball.fallen);
  for (const ball of active) {
    ball.vy += 820 * dt;
    ball.vx *= 0.998;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < WALL_LEFT + BALL_RADIUS) {
      ball.x = WALL_LEFT + BALL_RADIUS;
      ball.vx = Math.abs(ball.vx) * 0.28;
    } else if (ball.x > WALL_RIGHT - BALL_RADIUS) {
      ball.x = WALL_RIGHT - BALL_RADIUS;
      ball.vx = -Math.abs(ball.vx) * 0.28;
    }
    for (const pin of tower.pins) collidePin(ball, pin);
  }

  for (let iteration = 0; iteration < 2; iteration += 1) {
    for (let i = 0; i < active.length; i += 1) {
      for (let j = i + 1; j < active.length; j += 1) collideBalls(active[i], active[j]);
    }
  }

  for (const ball of active) {
    if (ball.y <= TOWER_HEIGHT + 28) continue;
    ball.fallen = true;
    newlyFallen.push(ball.id);
  }
  return newlyFallen;
}

export function towerSettled(tower: Tower) {
  return !tower.pins.some((pin) => pin.removing)
    && tower.balls.filter((ball) => !ball.fallen).every((ball) => Math.abs(ball.vx) < 28 && Math.abs(ball.vy) < 28);
}

export function losingPlayer(scores: number[], lastDropTurn: number[]) {
  const highest = Math.max(...scores);
  return scores.reduce((loser, score, index) => (
    score === highest && lastDropTurn[index] > lastDropTurn[loser] ? index : loser
  ), scores.findIndex((score) => score === highest));
}
