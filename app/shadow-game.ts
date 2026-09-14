import { rankResults } from './ranking.ts';

export type ShadowPoint = { x: number; y: number };
export type ShadowVec3 = { x: number; y: number; z: number };
export type ShadowBox = ShadowVec3 & { width: number; height: number; depth: number };

export type ShadowModel = {
  id: string;
  name: string;
  hue: number;
  boxes: ShadowBox[];
};

export type ShadowFace = {
  points: ShadowPoint[];
  depth: number;
  light: number;
};

export type ShadowChallenge = {
  model: ShadowModel;
  targetYaw: number;
  targetPitch: number;
  startYaw: number;
  startPitch: number;
};

export type ShadowResult = {
  player: number;
  modelName: string;
  score: number;
  elapsed: number;
  yaw: number;
  pitch: number;
};

export const SHADOW_MODELS: ShadowModel[] = [
  {
    id: 'chair', name: '비밀 의자', hue: 276, boxes: [
      { x: 0, y: -.05, z: 0, width: 1.05, height: .24, depth: .78 },
      { x: 0, y: .58, z: .31, width: 1.05, height: 1.05, depth: .18 },
      { x: -.37, y: -.57, z: -.25, width: .18, height: .85, depth: .18 },
      { x: .37, y: -.57, z: -.25, width: .18, height: .85, depth: .18 },
    ],
  },
  {
    id: 'stairs', name: '도둑 계단', hue: 193, boxes: [
      { x: -.58, y: -.58, z: .18, width: .58, height: .38, depth: .72 },
      { x: -.16, y: -.3, z: .05, width: .58, height: .66, depth: .72 },
      { x: .26, y: 0, z: -.08, width: .58, height: .96, depth: .72 },
      { x: .68, y: .32, z: -.2, width: .58, height: 1.28, depth: .72 },
    ],
  },
  {
    id: 'hook', name: '달빛 갈고리', hue: 338, boxes: [
      { x: -.42, y: 0, z: 0, width: .35, height: 1.55, depth: .42 },
      { x: .02, y: .6, z: 0, width: 1.15, height: .35, depth: .42 },
      { x: .48, y: .28, z: .18, width: .35, height: .68, depth: .68 },
      { x: -.05, y: -.67, z: -.18, width: .96, height: .26, depth: .36 },
    ],
  },
  {
    id: 'satellite', name: '쌍둥이 날개', hue: 42, boxes: [
      { x: 0, y: 0, z: 0, width: .62, height: .74, depth: .62 },
      { x: -.78, y: .15, z: .12, width: .94, height: .2, depth: .48 },
      { x: .78, y: -.15, z: -.12, width: .94, height: .2, depth: .48 },
      { x: .15, y: .72, z: -.25, width: .22, height: .72, depth: .24 },
    ],
  },
  {
    id: 'arch', name: '검은 아치', hue: 153, boxes: [
      { x: -.52, y: -.2, z: 0, width: .36, height: 1.35, depth: .5 },
      { x: .52, y: -.2, z: 0, width: .36, height: 1.35, depth: .5 },
      { x: 0, y: .56, z: 0, width: 1.38, height: .28, depth: .5 },
      { x: .15, y: -.68, z: -.46, width: .72, height: .24, depth: .72 },
    ],
  },
  {
    id: 'fork', name: '뒤틀린 열쇠', hue: 222, boxes: [
      { x: 0, y: -.24, z: 0, width: .3, height: 1.32, depth: .34 },
      { x: -.38, y: .48, z: .08, width: .82, height: .27, depth: .5 },
      { x: .4, y: .67, z: -.08, width: .86, height: .27, depth: .5 },
      { x: .36, y: -.73, z: .3, width: .9, height: .25, depth: .34 },
    ],
  },
];

const FACE_LAYOUTS = [
  { normal: { x: 1, y: 0, z: 0 }, corners: [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]] },
  { normal: { x: -1, y: 0, z: 0 }, corners: [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1]] },
  { normal: { x: 0, y: 1, z: 0 }, corners: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]] },
  { normal: { x: 0, y: -1, z: 0 }, corners: [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]] },
  { normal: { x: 0, y: 0, z: 1 }, corners: [[-1, -1, 1], [-1, 1, 1], [1, 1, 1], [1, -1, 1]] },
  { normal: { x: 0, y: 0, z: -1 }, corners: [[1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, -1]] },
] as const;

export function rotateShadowPoint(point: ShadowVec3, yaw: number, pitch: number): ShadowVec3 {
  const yawX = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
  const yawZ = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
  return {
    x: yawX,
    y: point.y * Math.cos(pitch) - yawZ * Math.sin(pitch),
    z: point.y * Math.sin(pitch) + yawZ * Math.cos(pitch),
  };
}

export function buildShadowFaces(model: ShadowModel, yaw: number, pitch: number): ShadowFace[] {
  const light = { x: -.45, y: .72, z: .54 };
  const faces = model.boxes.flatMap((box) => FACE_LAYOUTS.map((layout) => {
    const vertices = layout.corners.map(([x, y, z]) => rotateShadowPoint({
      x: box.x + x * box.width / 2,
      y: box.y + y * box.height / 2,
      z: box.z + z * box.depth / 2,
    }, yaw, pitch));
    const normal = rotateShadowPoint(layout.normal, yaw, pitch);
    return {
      points: vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })),
      depth: vertices.reduce((sum, vertex) => sum + vertex.z, 0) / vertices.length,
      light: Math.max(.12, Math.min(1, .44 + (normal.x * light.x + normal.y * light.y + normal.z * light.z) * .55)),
    };
  }));
  return faces.sort((a, b) => a.depth - b.depth);
}

function pointInFace(point: ShadowPoint, face: ShadowFace) {
  let sign = 0;
  for (let index = 0; index < face.points.length; index += 1) {
    const a = face.points[index];
    const b = face.points[(index + 1) % face.points.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) < 1e-8) continue;
    if (sign && Math.sign(cross) !== sign) return false;
    sign = Math.sign(cross);
  }
  return true;
}

export function shadowSimilarity(model: ShadowModel, targetYaw: number, targetPitch: number, yaw: number, pitch: number) {
  const target = buildShadowFaces(model, targetYaw, targetPitch);
  const current = buildShadowFaces(model, yaw, pitch);
  let union = 0;
  let overlap = 0;
  const samples = 56;
  for (let row = 0; row < samples; row += 1) {
    for (let column = 0; column < samples; column += 1) {
      const point = { x: (column + .5) / samples * 3.6 - 1.8, y: (row + .5) / samples * 3.6 - 1.8 };
      const inTarget = target.some((face) => pointInFace(point, face));
      const inCurrent = current.some((face) => pointInFace(point, face));
      if (inTarget || inCurrent) union += 1;
      if (inTarget && inCurrent) overlap += 1;
    }
  }
  return union ? Math.round(overlap / union * 1000) : 0;
}

function random(seed: number) {
  let value = seed | 0;
  return () => {
    value = value + 0x6d2b79f5 | 0;
    let mixed = Math.imul(value ^ value >>> 15, 1 | value);
    mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

export function makeShadowChallenges(players: number, seed: number): ShadowChallenge[] {
  const next = random(seed);
  const model = SHADOW_MODELS[Math.floor(next() * SHADOW_MODELS.length)];
  return Array.from({ length: players }, () => {
    const targetYaw = next() * Math.PI * 2 - Math.PI;
    const targetPitch = (next() - .5) * 1.3;
    let startYaw = targetYaw + (next() > .5 ? 1 : -1) * (1 + next() * 1.35);
    let startPitch = Math.max(-1.15, Math.min(1.15, targetPitch + (next() > .5 ? 1 : -1) * (.45 + next() * .55)));
    if (shadowSimilarity(model, targetYaw, targetPitch, startYaw, startPitch) > 720) {
      startYaw += 1.35;
      startPitch = -targetPitch;
    }
    return { model, targetYaw, targetPitch, startYaw, startPitch };
  });
}

export function rankShadowResults(results: ShadowResult[]) {
  return rankResults(results, (a, b) => b.score - a.score || Math.round(a.elapsed * 10) - Math.round(b.elapsed * 10));
}
