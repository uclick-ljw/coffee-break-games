export const DARTS_PER_ROUND = 3;
export const DART_ROUNDS = 3;
export const DART_SHOT_MS = 2600;
export const DART_FLIGHT_MS = 180;
export const DART_COLLISION_RADIUS_PX = 114;
export const DART_COLLISION_CLEARANCE_PX = 17;
export const DART_GAP_DEG = Math.asin(DART_COLLISION_CLEARANCE_PX / DART_COLLISION_RADIUS_PX) * 180 / Math.PI;

export const DART_STARTING_ANGLES = [
  [24, 151, 273],
  [12, 74, 166, 242, 318],
  [8, 50, 103, 157, 223, 279, 332],
] as const;

export const DART_ROUND_INFO = [
  { name: '리듬 회전', hint: '미리 꽂힌 3개 사이를 노리세요' },
  { name: '반전 회전', hint: '5개의 장애물과 역회전을 읽으세요' },
  { name: '페이크 회전', hint: '7개의 장애물과 급정지를 조심하세요' },
] as const;

export type DartResult = { player: number; round: number; hits: number; misses: number; duration: number };

const KEYFRAMES = [
  [[0, 82], [1.8, 112], [3.8, 82]],
  [[0, 95], [1.2, 175], [2.3, 28], [3.1, -125], [4.4, -72], [5.8, 95]],
  [[0, 125], [.62, 285], [1.25, 18], [1.75, -225], [2.55, -35], [3.12, 0], [3.62, 255], [4.18, -145], [5.2, 125]],
] as const;

const normalize = (angle: number) => (angle % 360 + 360) % 360;
const smooth = (value: number) => value * value * (3 - 2 * value);

export function dartMotionSpeed(round: number, seconds: number) {
  const frames = KEYFRAMES[round] ?? KEYFRAMES[0];
  const cycle = frames.at(-1)![0];
  const time = Math.max(0, seconds) % cycle;
  const nextIndex = frames.findIndex(([at]) => at >= time);
  const end = frames[Math.max(1, nextIndex)];
  const start = frames[Math.max(0, nextIndex - 1)];
  const ratio = smooth((time - start[0]) / (end[0] - start[0]));
  return start[1] + (end[1] - start[1]) * ratio;
}

export function advanceDartAngle(angle: number, speed: number, seconds: number) {
  return normalize(angle + speed * Math.max(0, Math.min(.05, seconds)));
}

export function dartImpactAngle(boardAngle: number) {
  return normalize(180 - boardAngle);
}

export function dartAngleDistance(a: number, b: number) {
  const gap = Math.abs(normalize(a) - normalize(b));
  return Math.min(gap, 360 - gap);
}

export function canPlaceDart(angles: number[], candidate: number, minGap = DART_GAP_DEG) {
  return angles.every((angle) => dartAngleDistance(angle, candidate) >= minGap);
}

export function rankDartResults(results: DartResult[], players: number) {
  return Array.from({ length: players }, (_, player) => {
    const attempts = results.filter((result) => result.player === player);
    return {
      player,
      hits: attempts.reduce((sum, result) => sum + result.hits, 0),
      misses: attempts.reduce((sum, result) => sum + result.misses, 0),
      duration: attempts.reduce((sum, result) => sum + result.duration, 0),
    };
  }).sort((a, b) => b.hits - a.hits || a.misses - b.misses || a.duration - b.duration || a.player - b.player);
}
