import { rankResults } from './ranking.ts';

export const MEASURE_ROUNDS = [
  { vessel: 'tall', name: '긴 유리잔', hint: '반듯하지만 잔류 물줄기는 짧습니다', revealMs: 1200, flowScale: 1, decay: 5.2 },
  { vessel: 'bowl', name: '넓은 물잔', hint: '폭이 넓어 수위가 천천히 올라갑니다', revealMs: 1000, flowScale: 1.08, decay: 4.5 },
  { vessel: 'carafe', name: '굴곡진 카라페', hint: '좁은 목에서 수위가 빠르게 변합니다', revealMs: 850, flowScale: 1.14, decay: 3.9 },
] as const;

export type MeasureVessel = typeof MEASURE_ROUNDS[number]['vessel'];

export type WaterDrop = { x: number; y: number; vx: number; vy: number; volume: number; inside: boolean };

const DROP_PHYSICS: Record<MeasureVessel, { mouthY: number; left: number; right: number; vx: number }> = {
  tall: { mouthY: .39, left: .40, right: .76, vx: .54 },
  bowl: { mouthY: .55, left: .30, right: .86, vx: .38 },
  carafe: { mouthY: .40, left: .51, right: .65, vx: .53 },
};

const WATER_GRAVITY = 1.8;

export type MeasureResult = {
  player: number;
  round: number;
  target: number;
  guess: number;
  error: number;
  score: number;
};

const clamp = (value: number) => Math.max(0, Math.min(1.08, value));

function random(seed: number) {
  let value = seed | 0;
  return () => {
    value = value + 0x6d2b79f5 | 0;
    let mixed = Math.imul(value ^ value >>> 15, 1 | value);
    mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

export function makeMeasureTargets(players: number, seed: number) {
  const next = random(seed);
  return MEASURE_ROUNDS.map(() => Array.from({ length: players }, () => Math.round((.34 + next() * .38) * 1000) / 1000));
}

export function waterLevel(vessel: MeasureVessel, volume: number) {
  const safe = Math.max(0, Math.min(1, volume));
  if (vessel === 'bowl') return Math.pow(safe, .72);
  if (vessel === 'carafe') return Math.pow(safe, 1.22);
  return safe;
}

export function makeWaterDrop(vessel: MeasureVessel, volume: number, drift = 0): WaterDrop {
  return { x: .34, y: .23, vx: DROP_PHYSICS[vessel].vx + drift, vy: .05, volume, inside: false };
}

export function waterSurfaceY(vessel: MeasureVessel, volume: number) {
  const mouthY = DROP_PHYSICS[vessel].mouthY;
  return .96 - waterLevel(vessel, volume) * (.96 - mouthY);
}

export function waterImpact(vessel: MeasureVessel, volume: number) {
  const mouthY = DROP_PHYSICS[vessel].mouthY;
  return Math.max(.18, (waterSurfaceY(vessel, volume) - mouthY) / (.96 - mouthY));
}

export function stepWaterDrop(vessel: MeasureVessel, drop: WaterDrop, seconds: number): WaterDrop {
  const dt = Math.max(0, seconds);
  const next = { ...drop, x: drop.x + drop.vx * dt, y: drop.y + drop.vy * dt + WATER_GRAVITY * dt * dt / 2, vy: drop.vy + WATER_GRAVITY * dt };
  const mouth = DROP_PHYSICS[vessel];
  if (!drop.inside && drop.y < mouth.mouthY && next.y >= mouth.mouthY && next.x >= mouth.left && next.x <= mouth.right) {
    return { ...next, inside: true, vx: next.vx * .12 };
  }
  return next;
}

export function waterDropLanded(vessel: MeasureVessel, after: WaterDrop, volume: number) {
  return after.inside && after.y >= waterSurfaceY(vessel, volume);
}

export function pourRate(heldSeconds: number, round: number) {
  const scale = MEASURE_ROUNDS[round]?.flowScale ?? 1;
  return Math.min(.34, (.095 + Math.max(0, heldSeconds) * .105) * scale);
}

export function pourStep(volume: number, flow: number, seconds: number) {
  return clamp(volume + Math.max(0, flow) * Math.max(0, seconds));
}

export function settleFlow(flow: number, seconds: number, round: number) {
  const decay = MEASURE_ROUNDS[round]?.decay ?? 4.5;
  return Math.max(0, flow * Math.exp(-decay * Math.max(0, seconds)));
}

export function measureScore(target: number, guess: number) {
  return Math.max(0, Math.round(100 - Math.abs(target - guess) * 220));
}

export function makeMeasureResult(player: number, round: number, target: number, guess: number): MeasureResult {
  const error = Math.abs(target - guess);
  return { player, round, target, guess, error, score: measureScore(target, guess) };
}

export function rankMeasureResults(results: MeasureResult[], players: number) {
  return rankResults(Array.from({ length: players }, (_, player) => {
    const attempts = results.filter((result) => result.player === player);
    return {
      player,
      score: attempts.reduce((sum, result) => sum + result.score, 0),
      error: attempts.reduce((sum, result) => sum + result.error, 0),
      attempts,
    };
  }), (a, b) => b.score - a.score || Math.round(a.error / MEASURE_ROUNDS.length * 1000) - Math.round(b.error / MEASURE_ROUNDS.length * 1000));
}
