export type CirclePoint = { x: number; y: number };

export type CircleResult = {
  player: number;
  score: number;
  roundness: number;
  closure: number;
  points: CirclePoint[];
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function pathIsLongEnough(points: CirclePoint[]) {
  if (points.length < 12) return false;
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return length >= 0.45;
}

export function scoreCircle(player: number, points: CirclePoint[]): CircleResult {
  const radii = points.map(({ x, y }) => Math.hypot(x - 0.5, y - 0.5));
  const meanRadius = radii.reduce((sum, radius) => sum + radius, 0) / Math.max(1, radii.length);
  const variance = radii.reduce((sum, radius) => sum + (radius - meanRadius) ** 2, 0) / Math.max(1, radii.length);
  const roundness = clamp(1 - Math.sqrt(variance) / Math.max(0.01, meanRadius) * 4.5);

  const first = points[0] ?? { x: 0.5, y: 0.5 };
  const last = points.at(-1) ?? first;
  const closure = clamp(1 - Math.hypot(first.x - last.x, first.y - last.y) / 0.22);

  const angles = points.map(({ x, y }) => Math.atan2(y - 0.5, x - 0.5)).sort((a, b) => a - b);
  let largestGap = Math.PI * 2;
  if (angles.length > 1) {
    largestGap = 0;
    for (let index = 1; index < angles.length; index += 1) largestGap = Math.max(largestGap, angles[index] - angles[index - 1]);
    largestGap = Math.max(largestGap, angles[0] + Math.PI * 2 - angles.at(-1)!);
  }
  const coverage = clamp(((Math.PI * 2 - largestGap) / (Math.PI * 2) - 0.55) / 0.42);
  const size = clamp(1 - Math.abs(meanRadius - 0.33) / 0.22);
  const base = roundness * 0.6 + closure * 0.2 + coverage * 0.14 + size * 0.06;
  const score = Math.round(100 * base * (0.25 + size * 0.75));

  return {
    player,
    score,
    roundness: Math.round(roundness * 100),
    closure: Math.round(closure * 100),
    points: points.map((point) => ({ ...point })),
  };
}

export function rankCircles(results: CircleResult[]) {
  return [...results].sort((a, b) => b.score - a.score || a.player - b.player);
}
