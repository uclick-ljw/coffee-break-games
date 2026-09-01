import { SLICE_SHAPES, pointInPolygon, transformSlicePoint, type SlicePoint, type SliceShape } from './slice-game.ts';

export const CENTER_ROUNDS = 3;
export const CENTER_SURFACE_SEGMENTS = 56;
export const CENTER_SURFACE_RINGS = 32;

export type CenterPoint3D = { x: number; y: number; z: number };
type CenterDeformation = { bulgeX: number; bulgeY: number; zBias: number; bendX: number; bendY: number };

export type CenterChallenge = {
  id: string;
  name: string;
  color: string;
  accent: string;
  points: SlicePoint[];
  center: SlicePoint;
  massCenter: CenterPoint3D;
  deformation: CenterDeformation;
  depth: number;
  targetYaw: number;
  targetPitch: number;
};

export type CenterAngles = { yaw: number; pitch: number };
export type CenterFace = { points: SlicePoint[]; depth: number; light: number };

export type CenterOutcome = {
  player: number;
  round: number;
  challenge: CenterChallenge;
  guess: SlicePoint;
  error: number;
  score: number;
};

export type CenterPlayerResult = {
  player: number;
  outcomes: CenterOutcome[];
  averageError: number;
  score: number;
};

const CENTER_NAMES: Record<string, string> = {
  'sweet-potato': '휘어진 원석',
  cheese: '쐐기 조각',
  leaf: '날개 조각',
  dumpling: '부채 조각',
  pear: '물방울 조각',
  'rice-cake': '비뚤어진 타일',
  'comet-core': '꼬리 달린 핵',
  'three-prong': '세 갈래 덩어리',
  'bent-horn': '굽은 뿔 조각',
  'crooked-branch': '삐뚤어진 가지',
  'lumpy-cluster': '혹 달린 덩어리',
  'one-wing': '한쪽 날개 조각',
};

const ASYMMETRIC_SHAPES: SliceShape[] = [
  { id: 'comet-core', name: '', hint: '', color: '#ef6f78', accent: '#8e3248', points: [{ x: .08, y: .48 }, { x: .17, y: .25 }, { x: .39, y: .12 }, { x: .57, y: .24 }, { x: .91, y: .15 }, { x: .7, y: .42 }, { x: .92, y: .59 }, { x: .58, y: .61 }, { x: .45, y: .86 }, { x: .2, y: .76 }] },
  { id: 'three-prong', name: '', hint: '', color: '#6e9ee8', accent: '#345489', points: [{ x: .09, y: .54 }, { x: .17, y: .29 }, { x: .36, y: .36 }, { x: .32, y: .08 }, { x: .52, y: .23 }, { x: .7, y: .07 }, { x: .72, y: .35 }, { x: .92, y: .29 }, { x: .83, y: .57 }, { x: .67, y: .65 }, { x: .59, y: .91 }, { x: .4, y: .75 }, { x: .2, y: .83 }] },
  { id: 'bent-horn', name: '', hint: '', color: '#db8e54', accent: '#82472b', points: [{ x: .09, y: .25 }, { x: .37, y: .08 }, { x: .65, y: .17 }, { x: .56, y: .37 }, { x: .81, y: .41 }, { x: .93, y: .65 }, { x: .75, y: .9 }, { x: .49, y: .76 }, { x: .38, y: .56 }, { x: .16, y: .68 }, { x: .07, y: .47 }] },
  { id: 'crooked-branch', name: '', hint: '', color: '#54b589', accent: '#27654c', points: [{ x: .09, y: .31 }, { x: .38, y: .34 }, { x: .31, y: .07 }, { x: .55, y: .16 }, { x: .63, y: .36 }, { x: .92, y: .24 }, { x: .86, y: .54 }, { x: .65, y: .6 }, { x: .79, y: .89 }, { x: .47, y: .78 }, { x: .37, y: .59 }, { x: .11, y: .73 }] },
  { id: 'lumpy-cluster', name: '', hint: '', color: '#a77bdd', accent: '#5a3a89', points: [{ x: .08, y: .47 }, { x: .2, y: .24 }, { x: .38, y: .29 }, { x: .44, y: .06 }, { x: .61, y: .2 }, { x: .69, y: .42 }, { x: .92, y: .47 }, { x: .77, y: .65 }, { x: .84, y: .89 }, { x: .57, y: .8 }, { x: .4, y: .67 }, { x: .15, y: .77 }] },
  { id: 'one-wing', name: '', hint: '', color: '#4eb3c7', accent: '#236477', points: [{ x: .07, y: .56 }, { x: .17, y: .32 }, { x: .38, y: .2 }, { x: .57, y: .07 }, { x: .49, y: .39 }, { x: .93, y: .33 }, { x: .82, y: .56 }, { x: .55, y: .6 }, { x: .63, y: .88 }, { x: .35, y: .79 }, { x: .19, y: .7 }] },
];

export const CENTER_ASYMMETRIC_IDS = new Set(ASYMMETRIC_SHAPES.map((shape) => shape.id));
const CLASSIC_CENTER_SHAPES = SLICE_SHAPES.filter((shape) => shape.id in CENTER_NAMES);
const CENTER_SHAPES = [...CLASSIC_CENTER_SHAPES, ...ASYMMETRIC_SHAPES];
export const CENTER_SHAPE_COUNT = CENTER_SHAPES.length;
// ponytail: 56×32 소프트웨어 메시로 충분하다. 실제 측정에서 회전이 끊길 때만 WebGL로 옮긴다.
const CENTER_DEPTHS: Record<string, number> = { 'sweet-potato': .78, cheese: .54, leaf: .28, dumpling: .72, pear: .64, 'rice-cake': .42, 'comet-core': .66, 'three-prong': .48, 'bent-horn': .58, 'crooked-branch': .44, 'lumpy-cluster': .74, 'one-wing': .36 };

function random(seed: number) {
  let value = seed | 0;
  return () => {
    value = value + 0x6d2b79f5 | 0;
    let mixed = Math.imul(value ^ value >>> 15, 1 | value);
    mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], next: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(next() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function polygonCenter(points: SlicePoint[]): SlicePoint {
  let area = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index++) {
    const next = points[(index + 1) % points.length];
    const cross = points[index].x * next.y - next.x * points[index].y;
    area += cross;
    x += (points[index].x + next.x) * cross;
    y += (points[index].y + next.y) * cross;
  }
  return { x: x / (3 * area), y: y / (3 * area) };
}

function smoothBoundary(points: SlicePoint[]) {
  let smooth = points;
  for (let round = 0; round < 2; round++) {
    smooth = smooth.flatMap((point, index) => {
      const next = smooth[(index + 1) % smooth.length];
      return [
        { x: point.x * .75 + next.x * .25, y: point.y * .75 + next.y * .25 },
        { x: point.x * .25 + next.x * .75, y: point.y * .25 + next.y * .75 },
      ];
    });
  }
  const edges = smooth.map((point, index) => Math.hypot(smooth[(index + 1) % smooth.length].x - point.x, smooth[(index + 1) % smooth.length].y - point.y));
  const perimeter = edges.reduce((sum, edge) => sum + edge, 0);
  const samples: SlicePoint[] = [];
  let edgeIndex = 0;
  let edgeStart = 0;
  for (let index = 0; index < CENTER_SURFACE_SEGMENTS; index++) {
    const distance = index / CENTER_SURFACE_SEGMENTS * perimeter;
    while (edgeStart + edges[edgeIndex] < distance) {
      edgeStart += edges[edgeIndex];
      edgeIndex = (edgeIndex + 1) % smooth.length;
    }
    const point = smooth[edgeIndex];
    const next = smooth[(edgeIndex + 1) % smooth.length];
    const mix = (distance - edgeStart) / edges[edgeIndex];
    samples.push({ x: point.x + (next.x - point.x) * mix, y: point.y + (next.y - point.y) * mix });
  }
  return samples;
}

function modelPoint(point: SlicePoint, z: number): CenterPoint3D {
  return { x: (point.x - .5) * 1.72, y: (.5 - point.y) * 1.72, z };
}

function rotatePoint(point: CenterPoint3D, yaw: number, pitch: number): CenterPoint3D {
  const x = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
  const z = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
  return { x, y: point.y * Math.cos(pitch) - z * Math.sin(pitch), z: point.y * Math.sin(pitch) + z * Math.cos(pitch) };
}

function projectRotated(point: CenterPoint3D): SlicePoint {
  const perspective = 1 / (1 - point.z / 4.2);
  return { x: .5 + point.x * .45 * perspective, y: .5 - point.y * .45 * perspective };
}

export function projectCenterPoint(point: SlicePoint, z: number, yaw: number, pitch: number) {
  return projectRotated(rotatePoint(modelPoint(point, z), yaw, pitch));
}

function modelSlice(challenge: CenterChallenge, height: number) {
  const center = polygonCenter(challenge.points);
  const radius = Math.sqrt(Math.max(0, 1 - height ** 2));
  const rangeX = Math.max(...challenge.points.map((point) => Math.abs(point.x - center.x))) || 1;
  const rangeY = Math.max(...challenge.points.map((point) => Math.abs(point.y - center.y))) || 1;
  return challenge.points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const direction = challenge.deformation.bulgeX * dx / rangeX + challenge.deformation.bulgeY * dy / rangeY;
    const polar = Math.atan2(dy / rangeY, dx / rangeX);
    const ripple = Math.sin(polar * 2 + Math.atan2(challenge.deformation.bulgeY, challenge.deformation.bulgeX) + height * .9);
    const lobe = 1 + direction * .4 * (.55 + radius * .45) + ripple * .15 * (.45 + radius * .55);
    const taper = 1 + challenge.deformation.zBias * height * .28;
    return modelPoint({
      x: center.x + dx * radius * lobe * taper + challenge.deformation.bendX * height * (1 - radius * .35),
      y: center.y + dy * radius * lobe * taper + challenge.deformation.bendY * height * (1 - radius * .35),
    }, height * challenge.depth / 2);
  });
}

function volumeCenter(challenge: CenterChallenge): CenterPoint3D {
  const samples = 81;
  let volume = 0;
  const center = { x: 0, y: 0, z: 0 };
  for (let index = 0; index < samples; index++) {
    const height = -1 + (index + .5) * 2 / samples;
    const slice = modelSlice(challenge, height);
    const area = Math.abs(slice.reduce((sum, point, pointIndex) => {
      const next = slice[(pointIndex + 1) % slice.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0)) / 2;
    const sliceCenter = polygonCenter(slice);
    volume += area;
    center.x += sliceCenter.x * area;
    center.y += sliceCenter.y * area;
    center.z += slice[0].z * area;
  }
  return { x: center.x / volume, y: center.y / volume, z: center.z / volume };
}

export function projectMassCenter(challenge: CenterChallenge, yaw = challenge.targetYaw, pitch = challenge.targetPitch) {
  return projectRotated(rotatePoint(challenge.massCenter, yaw, pitch));
}

export function buildCenterFaces(challenge: CenterChallenge, yaw = challenge.targetYaw, pitch = challenge.targetPitch): CenterFace[] {
  const rings = Array.from({ length: CENTER_SURFACE_RINGS + 1 }, (_, ring) => {
    const latitude = -Math.PI / 2 + ring / CENTER_SURFACE_RINGS * Math.PI;
    return modelSlice(challenge, Math.sin(latitude));
  });
  const faces: CenterPoint3D[][] = [];
  for (let ring = 0; ring < CENTER_SURFACE_RINGS; ring++) {
    for (let index = 0; index < challenge.points.length; index++) {
      const next = (index + 1) % challenge.points.length;
      if (ring === 0) faces.push([rings[0][0], rings[1][next], rings[1][index]]);
      else if (ring === CENTER_SURFACE_RINGS - 1) faces.push([rings[ring][index], rings[ring][next], rings[ring + 1][0]]);
      else faces.push([rings[ring][index], rings[ring][next], rings[ring + 1][next], rings[ring + 1][index]]);
    }
  }
  const light = { x: -.4, y: .72, z: .56 };
  return faces.map((face) => {
    const rotated = face.map((point) => rotatePoint(point, yaw, pitch));
    const a = rotated[0];
    const b = rotated[1];
    const c = rotated[2];
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const normal = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
    const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
    const brightness = Math.abs(normal.x / length * light.x + normal.y / length * light.y + normal.z / length * light.z);
    return { points: rotated.map(projectRotated), depth: rotated.reduce((sum, point) => sum + point.z, 0) / rotated.length, light: .28 + brightness * .72 };
  }).sort((a, b) => a.depth - b.depth);
}

export function makeCenterChallenges(players: number, seed: number): CenterChallenge[][] {
  const next = random(seed);
  const asymmetric = shuffled(ASYMMETRIC_SHAPES, next);
  const shapes = shuffled([asymmetric[0], asymmetric[1], shuffled(CLASSIC_CENTER_SHAPES, next)[0]], next);
  const selected = shapes.map((shape) => {
    const transform = { rotation: (next() - .5) * Math.PI * 1.35, mirrored: next() > .5 };
    const points = smoothBoundary(shape.points).map((point) => transformSlicePoint(point, transform));
    const flatCenter = polygonCenter(points);
    const targetYaw = (next() - .5) * 1.3;
    const targetPitch = -.2 + (next() - .5) * .65;
    const angle = next() * Math.PI * 2;
    const bendAngle = angle + .8 + next() * 1.4;
    const deformation = {
      bulgeX: Math.cos(angle) * (.72 + next() * .16),
      bulgeY: Math.sin(angle) * (.72 + next() * .16),
      zBias: (next() > .5 ? 1 : -1) * (.48 + next() * .16),
      bendX: Math.cos(bendAngle) * (.045 + next() * .025),
      bendY: Math.sin(bendAngle) * (.045 + next() * .025),
    };
    const challenge: CenterChallenge = { id: shape.id, name: CENTER_NAMES[shape.id], color: shape.color, accent: shape.accent, points, center: flatCenter, massCenter: { x: 0, y: 0, z: 0 }, deformation, depth: CENTER_DEPTHS[shape.id], targetYaw, targetPitch };
    challenge.massCenter = volumeCenter(challenge);
    challenge.center = projectMassCenter(challenge);
    return challenge;
  });
  return Array.from({ length: players }, () => selected.map((challenge) => ({ ...challenge, points: challenge.points.map((point) => ({ ...point })), center: { ...challenge.center }, massCenter: { ...challenge.massCenter }, deformation: { ...challenge.deformation } })));
}

export function isCenterHit(challenge: CenterChallenge, point: SlicePoint) {
  return buildCenterFaces(challenge).some((face) => pointInPolygon(point, face.points));
}

export function scoreCenterGuess(player: number, round: number, challenge: CenterChallenge, guess: SlicePoint): CenterOutcome {
  const error = Math.hypot(guess.x - challenge.center.x, guess.y - challenge.center.y);
  return { player, round, challenge, guess, error, score: Math.max(0, Math.round(100 - error * 450)) };
}

export function rankCenterPlayers(outcomes: CenterOutcome[], players: number): CenterPlayerResult[] {
  return Array.from({ length: players }, (_, player) => {
    const playerOutcomes = outcomes.filter((outcome) => outcome.player === player);
    const averageError = playerOutcomes.reduce((sum, outcome) => sum + outcome.error, 0) / Math.max(1, playerOutcomes.length);
    return { player, outcomes: playerOutcomes, averageError, score: Math.round(playerOutcomes.reduce((sum, outcome) => sum + outcome.score, 0) / Math.max(1, playerOutcomes.length)) };
  }).sort((a, b) => a.averageError - b.averageError || a.player - b.player);
}
