export const FLIP_WIDTH = 390;
export const FLIP_HEIGHT = 500;
export const FLIP_TABLE_Y = 432;
export const CUP_HEIGHT = 74;
export const CUP_BOTTOM_WIDTH = 42;
export const CUP_TOP_WIDTH = 58;
export const FLIP_MAX_SECONDS = 4.5;

const HALF_HEIGHT = CUP_HEIGHT / 2;
const GRAVITY = 760;
const MASS = 1;
const INERTIA = (CUP_HEIGHT ** 2 + CUP_TOP_WIDTH ** 2) / 12;

export type CupFlipState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  omega: number;
  elapsed: number;
  settled: number;
  peakRotation: number;
  launched: boolean;
};

export type CupFlipOutcome = {
  upright: boolean;
  score: number;
  reason: string;
  angleError: number;
  centerDistance: number;
  rotations: number;
};

type Point = { x: number; y: number };

export function makeCupFlipState(): CupFlipState {
  return {
    x: FLIP_WIDTH / 2,
    y: FLIP_TABLE_Y - HALF_HEIGHT,
    vx: 0,
    vy: 0,
    angle: 0,
    omega: 0,
    elapsed: 0,
    settled: 0,
    peakRotation: 0,
    launched: false,
  };
}

function localCupPoints(): Point[] {
  return [
    { x: -CUP_BOTTOM_WIDTH / 2, y: HALF_HEIGHT },
    { x: CUP_BOTTOM_WIDTH / 2, y: HALF_HEIGHT },
    { x: CUP_TOP_WIDTH / 2, y: -HALF_HEIGHT },
    { x: -CUP_TOP_WIDTH / 2, y: -HALF_HEIGHT },
  ];
}

export function cupWorldPoints(state: CupFlipState) {
  const cosine = Math.cos(state.angle);
  const sine = Math.sin(state.angle);
  return localCupPoints().map((point) => ({
    x: state.x + point.x * cosine - point.y * sine,
    y: state.y + point.x * sine + point.y * cosine,
  }));
}

export function launchCupFromGesture(state: CupFlipState, dx: number, dy: number, seconds: number, contactOffset = 0) {
  const upward = Math.max(0, -dy);
  if (state.launched || upward < 50) return false;
  const duration = Math.max(0.11, Math.min(0.48, seconds));
  const speedFactor = Math.max(0.76, Math.min(1.28, 0.22 / duration));
  const direction = Math.abs(contactOffset) > 0.16 ? Math.sign(contactOffset) : dx < -8 ? -1 : 1;
  state.vx = Math.max(-170, Math.min(170, dx / duration * 0.31));
  state.vy = -(270 + Math.min(190, upward) * 1.35) * speedFactor;
  state.omega = direction * (4.2 + Math.min(190, upward) * 0.012 + Math.abs(dx) * 0.009) * speedFactor;
  state.launched = true;
  return true;
}

export function stepCupFlip(state: CupFlipState, seconds: number) {
  if (!state.launched) return;
  const delta = Math.max(0, Math.min(0.025, seconds));
  state.vy += GRAVITY * delta;
  state.vx *= Math.exp(-0.08 * delta);
  state.omega *= Math.exp(-0.035 * delta);
  state.x += state.vx * delta;
  state.y += state.vy * delta;
  state.angle += state.omega * delta;
  state.elapsed += delta;
  state.peakRotation = Math.max(state.peakRotation, Math.abs(state.angle));

  let collided = false;
  for (let pass = 0; pass < 2; pass += 1) {
    const points = cupWorldPoints(state);
    let contactIndex = 0;
    for (let index = 1; index < points.length; index += 1) {
      if (points[index].y > points[contactIndex].y) contactIndex = index;
    }
    const contact = points[contactIndex];
    if (contact.y <= FLIP_TABLE_Y) break;
    collided = true;
    state.y -= contact.y - FLIP_TABLE_Y;
    const rx = contact.x - state.x;
    const ry = contact.y - state.y;
    const contactVy = state.vy + state.omega * rx;
    if (contactVy > 0) {
      const normalImpulse = -(1.18 * contactVy) / (1 / MASS + rx * rx / INERTIA);
      state.vy += normalImpulse / MASS;
      state.omega += rx * normalImpulse / INERTIA;
      const contactVx = state.vx - state.omega * ry;
      const rawFriction = -contactVx / (1 / MASS + ry * ry / INERTIA);
      const frictionLimit = Math.abs(normalImpulse) * 0.42;
      const frictionImpulse = Math.max(-frictionLimit, Math.min(frictionLimit, rawFriction));
      state.vx += frictionImpulse / MASS;
      state.omega -= ry * frictionImpulse / INERTIA;
    }
  }

  if (collided) {
    state.vx *= Math.exp(-4.2 * delta);
    state.omega *= Math.exp(-2.1 * delta);
  }
  if (collided && Math.abs(state.vx) < 18 && Math.abs(state.vy) < 18 && Math.abs(state.omega) < 0.72) {
    state.settled += delta;
  } else {
    state.settled = 0;
  }
}

function normalizedAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function cupFlipOutcome(state: CupFlipState): CupFlipOutcome | null {
  if (!state.launched) return null;
  const outside = state.x < -70 || state.x > FLIP_WIDTH + 70 || state.y > FLIP_HEIGHT + 70;
  if (!outside && state.settled < 0.42 && state.elapsed < FLIP_MAX_SECONDS) return null;
  const angleError = Math.abs(normalizedAngle(state.angle));
  const centerDistance = Math.abs(state.x - FLIP_WIDTH / 2);
  const points = cupWorldPoints(state);
  const bottomAverage = (points[0].y + points[1].y) / 2;
  const topAverage = (points[2].y + points[3].y) / 2;
  const upright = !outside && bottomAverage > topAverage && angleError <= 0.19 && Math.abs(state.omega) < 0.8;
  const rotations = Math.round(state.peakRotation / (Math.PI * 2) * 10) / 10;
  const score = upright
    ? Math.max(600, Math.round(930 - centerDistance * 1.5 - angleError * 300 - Math.abs(rotations - 1) * 90))
    : Math.max(0, Math.round(240 - angleError * 95 - centerDistance * 0.7));
  return {
    upright,
    score,
    angleError,
    centerDistance,
    rotations,
    reason: upright ? '바닥으로 반듯하게 섰어요!' : outside ? '테이블 밖으로 날아갔어요' : angleError > 2.4 ? '거꾸로 착지했어요' : '컵이 옆으로 넘어졌어요',
  };
}
