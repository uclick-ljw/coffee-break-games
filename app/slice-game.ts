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
  depth: number;
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

export const SLICE_SHAPES: SliceShape[] = [
  { id: 'hotteok', name: '삐뚤한 호떡', hint: '둥글어 보여도 한쪽이 더 두툼해요', color: '#d9903f', accent: '#7e4326', points: radialPoints([.94, 1, .92, 1.04, .9, 1, .95, 1.06, .9, .98, .92, 1.02]) },
  { id: 'sweet-potato', name: '고구마', hint: '길고 휜 몸통의 넓이를 읽어보세요', color: '#8f4e7a', accent: '#522447', points: [{ x: .16, y: .5 }, { x: .21, y: .31 }, { x: .38, y: .17 }, { x: .59, y: .13 }, { x: .78, y: .23 }, { x: .87, y: .4 }, { x: .82, y: .58 }, { x: .67, y: .75 }, { x: .45, y: .84 }, { x: .25, y: .74 }] },
  { id: 'cheese', name: '치즈 조각', hint: '뾰족한 쪽보다 넓은 쪽이 훨씬 무거워요', color: '#f1c84b', accent: '#a76c20', points: [{ x: .14, y: .3 }, { x: .74, y: .15 }, { x: .88, y: .72 }, { x: .31, y: .84 }, { x: .13, y: .62 }] },
  { id: 'watermelon', name: '수박 조각', hint: '껍질 쪽의 넓은 면적을 놓치지 마세요', color: '#ee5e67', accent: '#277a4e', points: [{ x: .13, y: .75 }, { x: .19, y: .57 }, { x: .32, y: .37 }, { x: .49, y: .15 }, { x: .64, y: .34 }, { x: .79, y: .54 }, { x: .89, y: .76 }, { x: .56, y: .84 }, { x: .3, y: .82 }] },
  { id: 'leaf', name: '나뭇잎', hint: '잎의 끝보다 볼록한 몸통을 살펴보세요', color: '#68ad58', accent: '#285d35', points: [{ x: .1, y: .61 }, { x: .2, y: .38 }, { x: .42, y: .19 }, { x: .7, y: .12 }, { x: .89, y: .27 }, { x: .83, y: .5 }, { x: .64, y: .7 }, { x: .36, y: .84 }, { x: .16, y: .77 }] },
  { id: 'dumpling', name: '왕만두', hint: '주름진 위쪽보다 아랫배가 묵직해요', color: '#f1d6a0', accent: '#a87942', points: [{ x: .13, y: .68 }, { x: .17, y: .45 }, { x: .31, y: .25 }, { x: .51, y: .16 }, { x: .73, y: .24 }, { x: .87, y: .45 }, { x: .88, y: .67 }, { x: .71, y: .81 }, { x: .31, y: .82 }] },
  { id: 'pear', name: '울퉁불퉁 배', hint: '작은 꼭지 쪽보다 둥근 아랫부분이 넓어요', color: '#b9cf59', accent: '#68782c', points: [{ x: .43, y: .11 }, { x: .57, y: .13 }, { x: .68, y: .3 }, { x: .82, y: .52 }, { x: .82, y: .7 }, { x: .68, y: .84 }, { x: .45, y: .88 }, { x: .24, y: .79 }, { x: .15, y: .6 }, { x: .23, y: .39 }] },
  { id: 'rice-cake', name: '비뚤어진 절편', hint: '반듯하지 않은 네 모서리를 함께 보세요', color: '#efb9c1', accent: '#a65d6c', points: [{ x: .16, y: .28 }, { x: .72, y: .14 }, { x: .88, y: .43 }, { x: .77, y: .77 }, { x: .27, y: .85 }, { x: .1, y: .55 }] },
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
    const viewSkew = (next() > .5 ? 1 : -1) * (.12 + next() * .1);
    const viewTilt = .56 + next() * .1;
    const viewPerspective = .38 + next() * .14;
    const depth = 24 + next() * 10;
    const transformed = shape.points.map((point) => {
      const x = (mirrored ? 1 - point.x : point.x) - .5;
      const y = point.y - .5;
      return {
        x: .5 + x * Math.cos(rotation) - y * Math.sin(rotation),
        y: .5 + x * Math.sin(rotation) + y * Math.cos(rotation),
      };
    });
    return { ...shape, rotation, mirrored, viewSkew, viewTilt, viewPerspective, depth, transformed };
  });
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
  const { first, second } = splitPolygon(challenge.transformed, start, end);
  const firstArea = polygonArea(first);
  const secondArea = polygonArea(second);
  const total = firstArea + secondArea;
  if (!total || Math.min(firstArea, secondArea) / total < .04) return null;
  const left = firstArea / total * 100;
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
