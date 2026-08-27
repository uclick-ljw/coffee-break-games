export const PEG_BOARD_WIDTH = 400;
export const PEG_BOARD_HEIGHT = 540;
export const BALL_RADIUS = 9;
export const PEG_RADIUS = 8;
export const FIELD_LEFT = 18;
export const FIELD_RIGHT = 338;
export const LANE_CENTER = 369;
export const DOME_CENTER_X = (FIELD_LEFT + LANE_CENTER) / 2;
export const DOME_CENTER_Y = 135;
export const DOME_RADIUS_X = (LANE_CENTER - FIELD_LEFT) / 2;
export const DOME_RADIUS_Y = 100;
export const LAUNCHER = { x: LANE_CENTER, y: 418 };
export const SCORE_TOP = 458;
export const SCORE_VALUES = [10, 30, 50, 100, 50, 30, 10];

export type Hole = { id: string; row: number; col: number; x: number; y: number };
export type Peg = Hole & { owner: number };
export type BallStage = 'lane' | 'curve' | 'field';
export type BallState = { x: number; y: number; vx: number; vy: number; age: number; stage: BallStage; guide: number; curveEnd: number; bias: number };

export const FIXED_PEGS: Peg[] = [
  [302, 103], [258, 128], [214, 103], [170, 128], [126, 103], [82, 128],
].map(([x, y], index) => ({ id: `fixed:${index}`, row: -1, col: index, x, y, owner: -1 }));

export const BOARD_CONFIGS: Record<number, { cols: number; rows: number; pegs: number }> = {
  2: { cols: 4, rows: 5, pegs: 10 },
  3: { cols: 5, rows: 6, pegs: 15 },
  4: { cols: 6, rows: 7, pegs: 20 },
  5: { cols: 7, rows: 7, pegs: 25 },
  6: { cols: 7, rows: 9, pegs: 30 },
};

export function makeHoles(players: number): Hole[] {
  const { cols, rows } = BOARD_CONFIGS[players];
  const gapX = Math.min(58, 260 / (cols - 0.5));
  const gapY = (414 - 154) / (rows - 1);
  return Array.from({ length: rows * cols }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      id: `${row}:${col}`,
      row,
      col,
      x: 178 - ((cols - 1) * gapX) / 2 + (row % 2 ? gapX / 4 : -gapX / 4) + col * gapX,
      y: 154 + row * gapY,
    };
  });
}

export function makePlacementOrder(players: number) {
  const forward = Array.from({ length: players }, (_, index) => index);
  return [...forward, ...forward, ...forward, ...forward.toReversed(), ...forward.toReversed()];
}

export function canPlacePeg(placed: Peg[], hole: Hole) {
  return !placed.some((peg) => peg.id === hole.id);
}

export function shuffledScores(seed: number) {
  const scores = [...SCORE_VALUES];
  let state = seed >>> 0;
  for (let index = scores.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swap = state % (index + 1);
    [scores[index], scores[swap]] = [scores[swap], scores[index]];
  }
  return scores;
}

export function scoreSlot(x: number) {
  return Math.max(0, Math.min(SCORE_VALUES.length - 1, Math.floor(((x - FIELD_LEFT) / (FIELD_RIGHT - FIELD_LEFT)) * SCORE_VALUES.length)));
}

export function stepBall(current: BallState, pegs: Peg[], dt: number) {
  const next = { ...current, age: current.age + dt };

  if (next.stage === 'lane') {
    next.vy += 560 * dt;
    next.x = LANE_CENTER;
    next.y += next.vy * dt;
    if (next.y <= DOME_CENTER_Y && next.vy < 0) {
      next.stage = 'curve';
      next.guide = 0;
      next.vx = Math.max(170, -next.vy);
      next.vy = 0;
      next.x = LANE_CENTER;
      next.y = DOME_CENTER_Y;
    }
    const misfire = next.age > 0.35 && next.y >= LAUNCHER.y + 15 && next.vy > 0;
    return { ball: next, settled: false, misfire, slot: -1 };
  }

  if (next.stage === 'curve') {
    next.guide = Math.min(next.curveEnd, next.guide + (next.vx * dt) / DOME_RADIUS_X);
    next.x = DOME_CENTER_X + DOME_RADIUS_X * Math.cos(next.guide);
    next.y = DOME_CENTER_Y - DOME_RADIUS_Y * Math.sin(next.guide);
    if (next.guide >= next.curveEnd) {
      next.stage = 'field';
      next.vx = next.bias;
      next.vy = 15;
    }
    return { ball: next, settled: false, misfire: false, slot: -1 };
  }

  next.vy += 560 * dt;
  next.vx *= Math.pow(0.997, dt * 60);
  next.x += next.vx * dt;
  next.y += next.vy * dt;

  const left = FIELD_LEFT + BALL_RADIUS;
  const right = FIELD_RIGHT - BALL_RADIUS;
  if (next.x < left) {
    next.x = left;
    next.vx = Math.abs(next.vx) * 0.72;
  } else if (next.x > right) {
    next.x = right;
    next.vx = -Math.abs(next.vx) * 0.72;
  }
  if (next.y < 31) {
    next.y = 31;
    next.vy = Math.abs(next.vy) * 0.55;
  }

  const hitDistance = BALL_RADIUS + PEG_RADIUS;
  for (const peg of pegs) {
    const dx = next.x - peg.x;
    const dy = next.y - peg.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= hitDistance * hitDistance) continue;
    const distance = Math.sqrt(distanceSquared) || 0.01;
    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = hitDistance - distance;
    next.x += nx * overlap;
    next.y += ny * overlap;
    const inward = next.vx * nx + next.vy * ny;
    if (inward < 0) {
      next.vx -= 1.72 * inward * nx;
      next.vy -= 1.72 * inward * ny;
    }
  }

  if (next.y + BALL_RADIUS >= SCORE_TOP) {
    const binWidth = (FIELD_RIGHT - FIELD_LEFT) / SCORE_VALUES.length;
    for (let index = 1; index < SCORE_VALUES.length; index += 1) {
      const divider = FIELD_LEFT + index * binWidth;
      if (Math.abs(next.x - divider) >= BALL_RADIUS + 2) continue;
      if (next.vx >= 0) next.x = divider - BALL_RADIUS - 2;
      else next.x = divider + BALL_RADIUS + 2;
      next.vx *= -0.42;
    }
    next.vx *= Math.pow(0.91, dt * 60);
    next.vy *= Math.pow(0.965, dt * 60);
  }

  const floor = PEG_BOARD_HEIGHT - 18 - BALL_RADIUS;
  if (next.y > floor) {
    next.y = floor;
    next.vy = -Math.abs(next.vy) * 0.18;
    next.vx *= 0.72;
  }
  const settled = next.y > floor - 3 && (Math.hypot(next.vx, next.vy) < 34 || next.age >= 4.2);
  return { ball: next, settled, misfire: false, slot: settled ? scoreSlot(next.x) : -1 };
}
