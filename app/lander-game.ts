export const LANDER_WIDTH = 390;
export const LANDER_HEIGHT = 540;
export const LANDER_GROUND_Y = 486;
export const LANDER_PAD_WIDTH = 112;
export const LANDER_MAX_SECONDS = 15;
export const LANDER_START_FUEL = 5.8;

const GRAVITY = 78;
const THRUST = 145;

export type LanderState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  fuel: number;
  elapsed: number;
};

export type LanderInput = { thrusting: boolean; direction: number };

export type LanderOutcome = {
  success: boolean;
  score: number;
  reason: string;
  impactSpeed: number;
  centerDistance: number;
};

export function makeLanderState(): LanderState {
  return { x: LANDER_WIDTH / 2, y: 76, vx: 0, vy: 6, angle: 0, fuel: LANDER_START_FUEL, elapsed: 0 };
}

export function makeLandingPad(seed: number) {
  return 112 + ((seed * 73) % 167);
}

export function landerWind(seconds: number, seed: number) {
  const phase = (seed % 31) * 0.17;
  return Math.sin(seconds * 1.35 + phase) * 6 + Math.sin(seconds * 0.57 + 1.2) * 3;
}

export function stepLander(state: LanderState, input: LanderInput, seconds: number, windSeed: number) {
  const delta = Math.max(0, Math.min(0.04, seconds));
  const direction = Math.max(-1, Math.min(1, input.direction));
  const targetAngle = input.thrusting ? direction * 0.48 : 0;
  state.angle += (targetAngle - state.angle) * Math.min(1, delta * 5.2);
  const burning = input.thrusting && state.fuel > 0;
  const force = burning ? THRUST : 0;
  if (burning) state.fuel = Math.max(0, state.fuel - delta);
  state.vx += (landerWind(state.elapsed, windSeed) + Math.sin(state.angle) * force) * delta;
  state.vy += (GRAVITY - Math.cos(state.angle) * force) * delta;
  state.vx *= Math.exp(-0.12 * delta);
  state.x += state.vx * delta;
  state.y += state.vy * delta;
  state.elapsed += delta;
}

export function landerOutcome(state: LanderState, padX: number): LanderOutcome | null {
  const outside = state.x < -30 || state.x > LANDER_WIDTH + 30 || state.y < -90;
  const touchedGround = state.y + 29 >= LANDER_GROUND_Y;
  const timedOut = state.elapsed >= LANDER_MAX_SECONDS;
  if (!outside && !touchedGround && !timedOut) return null;

  const centerDistance = Math.abs(state.x - padX);
  const impactSpeed = Math.hypot(state.vx, state.vy);
  const onPad = centerDistance <= LANDER_PAD_WIDTH / 2 - 8;
  const safe = touchedGround && onPad && Math.abs(state.vy) <= 58 && Math.abs(state.vx) <= 38 && Math.abs(state.angle) <= 0.42;
  const score = safe
    ? Math.max(500, Math.round(720 + state.fuel * 42 + (LANDER_PAD_WIDTH / 2 - centerDistance) * 3 - impactSpeed * 1.7))
    : Math.max(0, Math.round(300 - centerDistance * 1.25 - impactSpeed * 1.8 - (onPad ? 0 : 80)));
  return {
    success: safe,
    score,
    impactSpeed,
    centerDistance,
    reason: safe ? '부드럽게 착륙했어요!' : timedOut ? '착륙 시간이 끝났어요' : outside ? '비행 구역을 벗어났어요' : onPad ? '충돌 속도가 너무 빨랐어요' : '착륙장을 벗어났어요',
  };
}
