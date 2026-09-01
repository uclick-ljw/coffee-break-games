export type SlicePoint = { x: number; y: number };

export type SliceShape = {
  id: string;
  name: string;
  hint: string;
  color: string;
  accent: string;
  points: SlicePoint[];
};

export type SliceChallenge = SliceShape & {
  rotation: number;
  mirrored: boolean;
  viewSkew: number;
  viewTilt: number;
  viewPerspective: number;
  transformed: SlicePoint[];
};

type SliceView = Pick<SliceChallenge, 'viewSkew' | 'viewTilt' | 'viewPerspective'>;

export type SliceOutcome = {
  player: number;
  shapeId: string;
  shapeName: string;
  score: number;
  left: number;
  right: number;
  error: number;
  start: SlicePoint;
  end: SlicePoint;
};

function radialPoints(radii: number[], width = 0.72, height = 0.7) {
  return radii.map((radius, index) => {
    const angle = index / radii.length * Math.PI * 2 - Math.PI / 2;
    return { x: 0.5 + Math.cos(angle) * width * radius / 2, y: 0.5 + Math.sin(angle) * height * radius / 2 };
  });
}

function roundedPoints(points: SlicePoint[], rounds = 2) {
  let rounded = points;
  for (let round = 0; round < rounds; round += 1) {
    rounded = rounded.flatMap((point, index) => {
      const next = rounded[(index + 1) % rounded.length];
      return [
        { x: point.x * .75 + next.x * .25, y: point.y * .75 + next.y * .25 },
        { x: point.x * .25 + next.x * .75, y: point.y * .25 + next.y * .75 },
      ];
    });
  }
  return rounded;
}

export const SLICE_SHAPES: SliceShape[] = [
  { id: 'hotteok', name: '삐뚤한 호떡', hint: '납작하게 부푼 두께까지 생각하세요', color: '#d9903f', accent: '#7e4326', points: radialPoints(Array.from({ length: 20 }, (_, index) => 1 + Math.sin(index / 20 * Math.PI * 2) * .025)) },
  { id: 'sweet-potato', name: '고구마', hint: '굽고 찌그러진 몸통의 부피를 읽어보세요', color: '#8f4e7a', accent: '#522447', points: roundedPoints([{ x: .09, y: .5 }, { x: .16, y: .35 }, { x: .35, y: .25 }, { x: .58, y: .22 }, { x: .78, y: .27 }, { x: .91, y: .39 }, { x: .87, y: .54 }, { x: .7, y: .65 }, { x: .47, y: .73 }, { x: .25, y: .68 }, { x: .11, y: .59 }]) },
  { id: 'cheese', name: '치즈 조각', hint: '뾰족한 쪽보다 넓은 쪽이 훨씬 무거워요', color: '#f1c84b', accent: '#a76c20', points: [{ x: .14, y: .3 }, { x: .74, y: .15 }, { x: .88, y: .72 }, { x: .31, y: .84 }, { x: .13, y: .62 }] },
  { id: 'watermelon', name: '통수박', hint: '둥근 구의 중심과 부피를 가늠하세요', color: '#4b9d55', accent: '#1e6339', points: radialPoints(Array(48).fill(1), .78, .78) },
  { id: 'leaf', name: '나뭇잎', hint: '잎의 끝보다 볼록한 몸통을 살펴보세요', color: '#68ad58', accent: '#285d35', points: [{ x: .1, y: .61 }, { x: .2, y: .38 }, { x: .42, y: .19 }, { x: .7, y: .12 }, { x: .89, y: .27 }, { x: .83, y: .5 }, { x: .64, y: .7 }, { x: .36, y: .84 }, { x: .16, y: .77 }] },
  { id: 'dumpling', name: '왕만두', hint: '주름 아래 부푼 만두소의 부피를 보세요', color: '#f1d6a0', accent: '#a87942', points: roundedPoints([{ x: .13, y: .68 }, { x: .17, y: .45 }, { x: .31, y: .25 }, { x: .51, y: .16 }, { x: .73, y: .24 }, { x: .87, y: .45 }, { x: .88, y: .67 }, { x: .71, y: .81 }, { x: .31, y: .82 }]) },
  { id: 'pear', name: '울퉁불퉁 배', hint: '작은 꼭지보다 둥글게 부푼 아랫배가 무거워요', color: '#b9cf59', accent: '#68782c', points: roundedPoints([{ x: .43, y: .11 }, { x: .57, y: .13 }, { x: .68, y: .3 }, { x: .82, y: .52 }, { x: .82, y: .7 }, { x: .68, y: .84 }, { x: .45, y: .88 }, { x: .24, y: .79 }, { x: .15, y: .6 }, { x: .23, y: .39 }]) },
  { id: 'rice-cake', name: '비뚤어진 절편', hint: '완만하게 솟은 떡의 두께도 함께 보세요', color: '#efb9c1', accent: '#a65d6c', points: roundedPoints([{ x: .16, y: .28 }, { x: .72, y: .14 }, { x: .88, y: .43 }, { x: .77, y: .77 }, { x: .27, y: .85 }, { x: .1, y: .55 }]) },
];

export function polygonArea(points: SlicePoint[]) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(area) / 2;
}

function side(point: SlicePoint, start: SlicePoint, end: SlicePoint) {
  return (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
}

export function pointInPolygon(point: SlicePoint, points: SlicePoint[]) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const a = points[index];
    const b = points[previous];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function sliceSurfaceHeight(shapeId: string, point: SlicePoint) {
  const x = point.x - .5;
  const y = point.y - .5;
  const ellipse = (width: number, height: number, centerY = 0) => Math.sqrt(Math.max(0, 1 - (x / width) ** 2 - ((y - centerY) / height) ** 2));
  switch (shapeId) {
    case 'watermelon': return ellipse(.4, .4);
    case 'sweet-potato': return .1 + ellipse(.46, .27) * (.72 + .16 * Math.sin((point.x + point.y) * 9));
    case 'hotteok': return .18 + ellipse(.39, .36) * .38;
    case 'cheese': return .22 + point.x * .42 + (1 - point.y) * .16;
    case 'leaf': return .05 + ellipse(.45, .35) * .13 + (point.x - point.y + .5) * .035;
    case 'dumpling': return .12 + ellipse(.39, .34, .04) * .78;
    case 'pear': return .1 + ellipse(.35, .39, .08) * (.65 + point.y * .28);
    case 'rice-cake': return .14 + ellipse(.42, .35) * .48;
    default: return 1;
  }
}

function clipHalfPlane(points: SlicePoint[], start: SlicePoint, end: SlicePoint, keepPositive: boolean) {
  const clipped: SlicePoint[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const currentSide = side(current, start, end) * (keepPositive ? 1 : -1);
    const nextSide = side(next, start, end) * (keepPositive ? 1 : -1);
    if (currentSide >= 0) clipped.push(current);
    if ((currentSide >= 0) !== (nextSide >= 0)) {
      const mix = currentSide / (currentSide - nextSide);
      clipped.push({ x: current.x + (next.x - current.x) * mix, y: current.y + (next.y - current.y) * mix });
    }
  }
  return clipped;
}

export function splitPolygon(points: SlicePoint[], start: SlicePoint, end: SlicePoint) {
  return {
    first: clipHalfPlane(points, start, end, true),
    second: clipHalfPlane(points, start, end, false),
  };
}

function random(seed: number) {
  let value = seed | 0;
  return () => {
    value |= 0;
    value = value + 0x6d2b79f5 | 0;
    let mixed = Math.imul(value ^ value >>> 15, 1 | value);
    mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

export function makeSliceChallenges(players: number, seed: number): SliceChallenge[] {
  const next = random(seed);
  const shuffled = [...SLICE_SHAPES].sort(() => next() - .5);
  return Array.from({ length: players }, (_, index) => {
    const shape = shuffled[index % shuffled.length];
    const rotation = (next() - .5) * .65;
    const mirrored = next() > .5;
    const viewSkew = (next() > .5 ? 1 : -1) * (.05 + next() * .06);
    const viewTilt = .78 + next() * .1;
    const viewPerspective = .12 + next() * .1;
    const challengeTransform = { rotation, mirrored };
    const transformed = shape.points.map((point) => transformSlicePoint(point, challengeTransform));
    return { ...shape, rotation, mirrored, viewSkew, viewTilt, viewPerspective, transformed };
  });
}

export function transformSlicePoint(point: SlicePoint, challenge: Pick<SliceChallenge, 'rotation' | 'mirrored'>): SlicePoint {
  const x = (challenge.mirrored ? 1 - point.x : point.x) - .5;
  const y = point.y - .5;
  return {
    x: .5 + x * Math.cos(challenge.rotation) - y * Math.sin(challenge.rotation),
    y: .5 + x * Math.sin(challenge.rotation) + y * Math.cos(challenge.rotation),
  };
}

export function projectSlicePoint(point: SlicePoint, view: SliceView): SlicePoint {
  const x = point.x - .5;
  const y = point.y - .5;
  return {
    x: .5 + x * (1 + y * view.viewPerspective) + y * view.viewSkew,
    y: .5 + y * view.viewTilt,
  };
}

export function unprojectSlicePoint(point: SlicePoint, view: SliceView): SlicePoint {
  const y = (point.y - .5) / view.viewTilt;
  return {
    x: .5 + ((point.x - .5) - y * view.viewSkew) / (1 + y * view.viewPerspective),
    y: .5 + y,
  };
}

export function scoreSlice(player: number, challenge: SliceChallenge, start: SlicePoint, end: SlicePoint): SliceOutcome | null {
  if (Math.hypot(end.x - start.x, end.y - start.y) < .22) return null;
  let firstVolume = 0;
  let secondVolume = 0;
  const cells = 72;
  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      const point = { x: (column + .5) / cells, y: (row + .5) / cells };
      if (!pointInPolygon(point, challenge.points)) continue;
      const transformed = transformSlicePoint(point, challenge);
      const volume = sliceSurfaceHeight(challenge.id, point);
      if (side(transformed, start, end) >= 0) firstVolume += volume;
      else secondVolume += volume;
    }
  }
  const total = firstVolume + secondVolume;
  if (!total || Math.min(firstVolume, secondVolume) / total < .04) return null;
  const left = firstVolume / total * 100;
  const right = 100 - left;
  const error = Math.abs(left - 50);
  return {
    player,
    shapeId: challenge.id,
    shapeName: challenge.name,
    score: Math.max(0, Math.round(1000 - error ** 1.12 * 24)),
    left,
    right,
    error,
    start,
    end,
  };
}

export function rankSlices(results: SliceOutcome[]) {
  return [...results].sort((a, b) => b.score - a.score || a.player - b.player);
}
