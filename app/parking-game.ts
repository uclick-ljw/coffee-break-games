export const PARKING_WIDTH = 390;
export const PARKING_HEIGHT = 550;
export const PARKING_MAX_SECONDS = 6;
export const PARKING_CAR_WIDTH = 38;
export const PARKING_CAR_LENGTH = 70;

const SLOT_X = [87, 195, 303] as const;
const SLOT_Y = 111;
const MAX_SPEED = 230;
const ACCELERATION = 300;
const BRAKE = 360;

export type ParkingCourse = {
  targetIndex: 0 | 2;
  targetX: number;
  targetY: number;
};

export type ParkingState = {
  x: number;
  y: number;
  angle: number;
  speed: number;
  elapsed: number;
  released: boolean;
  crashed: boolean;
};

export type ParkingInput = {
  driving: boolean;
  steering: number;
};

export type ParkingOutcome = {
  parked: boolean;
  score: number;
  reason: string;
  centerDistance: number;
  angleError: number;
  seconds: number;
};

export function makeParkingCourse(seed: number): ParkingCourse {
  const targetIndex = Math.abs(seed) % 2 === 0 ? 0 : 2;
  return { targetIndex, targetX: SLOT_X[targetIndex], targetY: SLOT_Y };
}

export function makeParkingState(): ParkingState {
  return { x: PARKING_WIDTH / 2, y: 500, angle: 0, speed: 0, elapsed: 0, released: false, crashed: false };
}

export function parkingSlotX(index: number) {
  return SLOT_X[index] ?? SLOT_X[1];
}

function pointInInflatedRect(x: number, y: number, centerX: number, centerY: number, halfWidth: number, halfHeight: number, radius: number) {
  return x >= centerX - halfWidth - radius && x <= centerX + halfWidth + radius
    && y >= centerY - halfHeight - radius && y <= centerY + halfHeight + radius;
}

function collides(state: ParkingState, course: ParkingCourse) {
  const radius = 14;
  const axle = 20;
  const sin = Math.sin(state.angle);
  const cos = Math.cos(state.angle);
  const probes = [
    { x: state.x + sin * axle, y: state.y - cos * axle },
    { x: state.x - sin * axle, y: state.y + cos * axle },
  ];

  for (const probe of probes) {
    if (probe.x < 26 + radius || probe.x > PARKING_WIDTH - 26 - radius || probe.y < 23 + radius || probe.y > PARKING_HEIGHT + radius) return true;
    for (let index = 0; index < SLOT_X.length; index += 1) {
      if (index === course.targetIndex) continue;
      if (pointInInflatedRect(probe.x, probe.y, SLOT_X[index], SLOT_Y, 25, 45, radius)) return true;
    }
  }
  return false;
}

export function stepParking(state: ParkingState, input: ParkingInput, seconds: number, course: ParkingCourse) {
  if (state.crashed) return;
  const delta = Math.max(0, Math.min(0.04, seconds));
  const driving = input.driving && !state.released;
  const steering = Math.max(-1, Math.min(1, input.steering));

  if (driving) {
    state.speed = Math.min(MAX_SPEED, state.speed + ACCELERATION * delta);
    state.angle += steering * (0.42 + state.speed / MAX_SPEED) * delta;
    state.angle = Math.max(-0.9, Math.min(0.9, state.angle));
  } else {
    if (state.speed > 0) state.released = true;
    state.speed = Math.max(0, state.speed - BRAKE * delta);
  }

  state.x += Math.sin(state.angle) * state.speed * delta;
  state.y -= Math.cos(state.angle) * state.speed * delta;
  state.elapsed += delta;

  if (collides(state, course)) {
    state.crashed = true;
    state.speed = 0;
  }
}

function normalizedAngle(angle: number) {
  return Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
}

export function parkingOutcome(state: ParkingState, course: ParkingCourse): ParkingOutcome | null {
  const timedOut = state.elapsed >= PARKING_MAX_SECONDS;
  const stopped = state.released && state.speed <= 0.5;
  if (!state.crashed && !timedOut && !stopped) return null;

  const xError = Math.abs(state.x - course.targetX);
  const yError = Math.abs(state.y - course.targetY);
  const centerDistance = Math.hypot(xError, yError);
  const angleError = normalizedAngle(state.angle);
  const parked = !state.crashed && xError <= 23 && yError <= 31 && angleError <= 0.24;
  const score = parked
    ? Math.max(650, Math.round(1000 - centerDistance * 5.2 - angleError * 300))
    : Math.max(0, Math.round(430 - centerDistance * 1.8 - angleError * 95 - (state.crashed ? 180 : 0)));

  let reason = '주차칸에서 벗어났어요';
  if (state.crashed) reason = '장애물에 부딪혔어요';
  else if (timedOut) reason = '시간 안에 멈추지 못했어요';
  else if (state.y < course.targetY - 31) reason = '너무 늦게 브레이크를 놓았어요';
  else if (state.y > course.targetY + 31) reason = '브레이크가 너무 빨랐어요';
  else if (angleError > 0.24) reason = '차가 비뚤게 멈췄어요';
  else if (parked) reason = score >= 900 ? '한 번에 완벽 주차!' : '주차선 안에 들어왔어요!';

  return { parked, score, reason, centerDistance, angleError, seconds: state.elapsed };
}
