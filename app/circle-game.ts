import { rankResults } from './ranking.ts';

export type CurvePoint = { x: number; y: number };
export type CurveShape = 'circle' | 'drop' | 'heart' | 'infinity' | 'spiral';

export type CurveResult = {
  player: number;
  shape: CurveShape;
  score: number;
  accuracy: number;
  points: CurvePoint[];
};

export const CURVES: Record<CurveShape, { label: string; hint: string; closed: boolean }> = {
  circle: { label: '원', hint: '별들을 둥글게 감싸세요', closed: true },
  drop: { label: '물방울', hint: '위는 뾰족하게, 아래는 둥글게', closed: true },
  heart: { label: '하트', hint: '두 봉우리의 균형을 맞추세요', closed: true },
  infinity: { label: '무한대', hint: '두 고리를 같은 크기로 그리세요', closed: true },
  spiral: { label: '나선', hint: '가운데부터 일정한 간격으로 감으세요', closed: false },
};

export const CURVE_SHAPES = Object.keys(CURVES) as CurveShape[];

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function rawPoint(shape: CurveShape, progress: number): CurvePoint {
  const angle = progress * Math.PI * 2;
  if (shape === 'drop') {
    const width = 0.55 + 0.45 * (1 - Math.cos(angle)) / 2;
    return { x: Math.sin(angle) * width, y: -(1 - Math.cos(angle)) };
  }
  if (shape === 'heart') {
    return {
      x: 16 * Math.sin(angle) ** 3,
      y: 13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle),
    };
  }
  if (shape === 'infinity') return { x: Math.sin(angle), y: Math.sin(angle * 2) * 0.52 };
  if (shape === 'spiral') {
    const spiralAngle = progress * Math.PI * 4.5 - Math.PI / 2;
    const radius = 0.08 + progress * 0.92;
    return { x: Math.cos(spiralAngle) * radius, y: Math.sin(spiralAngle) * radius };
  }
  return { x: Math.cos(angle - Math.PI / 2), y: Math.sin(angle - Math.PI / 2) };
}

export function curveTemplate(shape: CurveShape, count = 96): CurvePoint[] {
  const resolution = Math.max(256, count * 4);
  const points = Array.from({ length: resolution }, (_, index) => rawPoint(shape, index / (resolution - 1)));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = 0.64 / Math.max(maxX - minX, maxY - minY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const fitted = points.map((point) => ({ x: 0.5 + (point.x - centerX) * scale, y: 0.5 - (point.y - centerY) * scale }));
  return resample(fitted, count);
}

export function pathIsLongEnough(points: CurvePoint[]) {
  if (points.length < 12) return false;
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return length >= 0.45;
}

function resample(points: CurvePoint[], count: number) {
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    distances.push(distances[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  }
  const total = distances.at(-1) || 1;
  return Array.from({ length: count }, (_, index) => {
    const target = total * index / (count - 1);
    let upper = 1;
    while (upper < distances.length - 1 && distances[upper] < target) upper += 1;
    const lower = upper - 1;
    const span = distances[upper] - distances[lower] || 1;
    const mix = (target - distances[lower]) / span;
    return {
      x: points[lower].x + (points[upper].x - points[lower].x) * mix,
      y: points[lower].y + (points[upper].y - points[lower].y) * mix,
    };
  });
}

function rmsDistance(points: CurvePoint[], template: CurvePoint[], shift = 0, reverse = false) {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const templateIndex = reverse
      ? (shift - index + template.length) % template.length
      : (index + shift) % template.length;
    sum += (points[index].x - template[templateIndex].x) ** 2 + (points[index].y - template[templateIndex].y) ** 2;
  }
  return Math.sqrt(sum / points.length);
}

export function scoreCurve(player: number, shape: CurveShape, points: CurvePoint[]): CurveResult {
  const count = 96;
  const sampled = resample(points, count);
  const template = curveTemplate(shape, count);
  let distance = Number.POSITIVE_INFINITY;

  if (CURVES[shape].closed) {
    for (let shift = 0; shift < count - 1; shift += 1) {
      distance = Math.min(distance, rmsDistance(sampled, template, shift), rmsDistance(sampled, template, shift, true));
    }
  } else {
    distance = Math.min(rmsDistance(sampled, template), rmsDistance(sampled, [...template].reverse()));
  }

  const fit = clamp(1 - distance / 0.22);
  const first = sampled[0];
  const last = sampled.at(-1)!;
  const closure = CURVES[shape].closed ? clamp(1 - Math.hypot(first.x - last.x, first.y - last.y) / 0.18) : 1;
  const accuracy = fit * (0.82 + closure * 0.18);

  return {
    player,
    shape,
    score: Math.round(100 * accuracy ** 1.25),
    accuracy: Math.round(accuracy * 100),
    points: points.map((point) => ({ ...point })),
  };
}

export function rankCurves(results: CurveResult[]) {
  return rankResults(results, (a, b) => b.score - a.score);
}
