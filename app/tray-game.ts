import RAPIER, { type RigidBody, type World } from '@dimforge/rapier3d-deterministic-compat';

export const TRAY_WIDTH = 420;
export const TRAY_HEIGHT = 440;
export const TRAY_SCALE = 53;
export const TRAY_CENTER_Y = -1.35;
export const TRAY_HALF_WIDTH = 3.45;
export const TRAY_DROP_Y = 3.05;
export const TRAY_X_LIMIT = 3.15;
export const TRAY_ROTATION_STEP = Math.PI / 6;

export type TrayItemKind = 'cake' | 'cup' | 'mug' | 'macaron' | 'croissant' | 'tumbler';

export type TrayPart =
  | { kind: 'box'; x: number; y: number; halfWidth: number; halfHeight: number; color: string; radius?: number }
  | { kind: 'ball'; x: number; y: number; radius: number; color: string };

export type TrayItemDefinition = {
  kind: TrayItemKind;
  name: string;
  shortName: string;
  hint: string;
  density: number;
  width: number;
  height: number;
  parts: TrayPart[];
};

export const TRAY_ITEMS: Record<TrayItemKind, TrayItemDefinition> = {
  cake: {
    kind: 'cake', name: '케이크 상자', shortName: 'CAKE', hint: '넓고 안정적인 받침', density: 0.85, width: 1.5, height: 0.64,
    parts: [{ kind: 'box', x: 0, y: 0, halfWidth: 0.75, halfHeight: 0.32, color: '#f7b7c9', radius: 0.08 }],
  },
  cup: {
    kind: 'cup', name: '종이컵', shortName: 'CUP', hint: '가볍지만 밑면이 좁음', density: 0.62, width: 0.84, height: 0.82,
    parts: [
      { kind: 'box', x: 0, y: -0.24, halfWidth: 0.29, halfHeight: 0.17, color: '#f1eadb', radius: 0.07 },
      { kind: 'box', x: 0, y: 0.02, halfWidth: 0.35, halfHeight: 0.13, color: '#f7f1e4', radius: 0.07 },
      { kind: 'box', x: 0, y: 0.27, halfWidth: 0.42, halfHeight: 0.14, color: '#fff9ec', radius: 0.07 },
    ],
  },
  mug: {
    kind: 'mug', name: '머그잔', shortName: 'MUG', hint: '손잡이 쪽으로 무게가 쏠림', density: 0.82, width: 1.14, height: 0.78,
    parts: [
      { kind: 'box', x: -0.12, y: 0, halfWidth: 0.39, halfHeight: 0.39, color: '#73c7bc', radius: 0.1 },
      { kind: 'box', x: 0.39, y: 0.2, halfWidth: 0.18, halfHeight: 0.08, color: '#4b9f99', radius: 0.06 },
      { kind: 'box', x: 0.49, y: 0, halfWidth: 0.08, halfHeight: 0.24, color: '#4b9f99', radius: 0.06 },
      { kind: 'box', x: 0.39, y: -0.2, halfWidth: 0.18, halfHeight: 0.08, color: '#4b9f99', radius: 0.06 },
    ],
  },
  macaron: {
    kind: 'macaron', name: '마카롱', shortName: 'MACARON', hint: '작고 둥글어 쉽게 구름', density: 0.7, width: 0.72, height: 0.72,
    parts: [{ kind: 'ball', x: 0, y: 0, radius: 0.36, color: '#bda2ed' }],
  },
  croissant: {
    kind: 'croissant', name: '크루아상', shortName: 'CROISSANT', hint: '곡선이 다른 물체를 밀어냄', density: 0.5, width: 1.25, height: 0.75,
    parts: [
      { kind: 'ball', x: -0.37, y: -0.04, radius: 0.25, color: '#d99645' },
      { kind: 'ball', x: 0, y: 0.12, radius: 0.34, color: '#efb85f' },
      { kind: 'ball', x: 0.37, y: -0.04, radius: 0.25, color: '#d99645' },
    ],
  },
  tumbler: {
    kind: 'tumbler', name: '텀블러', shortName: 'TUMBLER', hint: '키가 크고 묵직해 위험', density: 1.05, width: 0.72, height: 1.5,
    parts: [
      { kind: 'box', x: 0, y: 0, halfWidth: 0.27, halfHeight: 0.65, color: '#50779b', radius: 0.09 },
      { kind: 'box', x: 0, y: 0.69, halfWidth: 0.36, halfHeight: 0.06, color: '#2d506f', radius: 0.04 },
      { kind: 'box', x: 0, y: -0.68, halfWidth: 0.31, halfHeight: 0.07, color: '#294861', radius: 0.04 },
    ],
  },
};

const ITEM_KINDS = Object.keys(TRAY_ITEMS) as TrayItemKind[];
const STEP = 1 / 120;
let rapierReady: Promise<unknown> | undefined;

function readyRapier() {
  rapierReady ??= RAPIER.init();
  return rapierReady;
}

function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeTrayQueue(seed: number, length = 60) {
  const nextRandom = random(seed);
  const queue: TrayItemKind[] = [];
  while (queue.length < length) {
    const bag = [...ITEM_KINDS];
    for (let index = bag.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(nextRandom() * (index + 1));
      [bag[index], bag[swap]] = [bag[swap], bag[index]];
    }
    queue.push(...bag);
  }
  return queue.slice(0, length);
}

export function trayNextPlayer(player: number, players: number) {
  return (player + 1) % players;
}

export function clampTrayX(value: number) {
  return Math.max(-TRAY_X_LIMIT, Math.min(TRAY_X_LIMIT, value));
}

export type TrayPiece = {
  id: number;
  kind: TrayItemKind;
  x: number;
  y: number;
  angle: number;
};

type PieceBody = { id: number; kind: TrayItemKind; body: RigidBody };

export type TrayEngine = {
  readonly pieces: TrayPiece[];
  readonly trayAngle: number;
  drop: (kind: TrayItemKind, x: number, angle: number) => number;
  step: (seconds: number) => void;
  settled: () => boolean;
  failed: () => boolean;
  forceSleep: () => void;
  dispose: () => void;
};

function angleOf(body: RigidBody) {
  const rotation = body.rotation();
  return 2 * Math.atan2(rotation.z, rotation.w);
}

function addItemCollider(world: World, body: RigidBody, part: TrayPart, density: number) {
  const desc = part.kind === 'ball'
    ? RAPIER.ColliderDesc.ball(part.radius)
    : RAPIER.ColliderDesc.cuboid(part.halfWidth, part.halfHeight, 0.3);
  desc.setTranslation(part.x, part.y, 0)
    .setDensity(density)
    .setFriction(0.72)
    .setRestitution(0.015);
  world.createCollider(desc, body);
}

export async function createTrayEngine(): Promise<TrayEngine> {
  await readyRapier();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  world.numSolverIterations = 10;

  const tray = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, TRAY_CENTER_Y, 0)
      .setAngularDamping(1.25)
      .setLinearDamping(2)
      .setAdditionalMass(3.2),
  );
  tray.setEnabledTranslations(false, false, false, true);
  tray.setEnabledRotations(false, false, true, true);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(TRAY_HALF_WIDTH, 0.11, 0.36)
      .setDensity(1.1)
      .setFriction(0.78)
      .setRestitution(0.01),
    tray,
  );

  const bodies: PieceBody[] = [];
  let nextId = 1;
  let accumulator = 0;

  function snapshot(): TrayPiece[] {
    return bodies.map(({ id, kind, body }) => {
      const position = body.translation();
      return { id, kind, x: position.x, y: position.y, angle: angleOf(body) };
    });
  }

  const engine: TrayEngine = {
    get pieces() {
      return snapshot();
    },
    get trayAngle() {
      return angleOf(tray);
    },
    drop(kind, x, angle) {
      const id = nextId;
      nextId += 1;
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(clampTrayX(x), TRAY_DROP_Y, 0)
          .setRotation({ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) })
          .setLinearDamping(0.08)
          .setAngularDamping(0.16)
          .setCcdEnabled(true),
      );
      body.setEnabledTranslations(true, true, false, true);
      body.setEnabledRotations(false, false, true, true);
      for (const part of TRAY_ITEMS[kind].parts) addItemCollider(world, body, part, TRAY_ITEMS[kind].density);
      bodies.push({ id, kind, body });
      return id;
    },
    step(seconds) {
      accumulator += Math.min(0.06, Math.max(0, seconds));
      while (accumulator >= STEP) {
        const trayAngle = angleOf(tray);
        const trayVelocity = tray.angvel().z;
        tray.addTorque({ x: 0, y: 0, z: -trayAngle * 7.4 - trayVelocity * 2.25 }, true);
        world.step();
        accumulator -= STEP;
      }
    },
    settled() {
      if (Math.abs(tray.angvel().z) > 0.035) return false;
      return bodies.every(({ body }) => {
        const linear = body.linvel();
        return Math.hypot(linear.x, linear.y) < 0.065 && Math.abs(body.angvel().z) < 0.055;
      });
    },
    failed() {
      if (Math.abs(angleOf(tray)) > 0.68) return true;
      return bodies.some(({ body }) => {
        const position = body.translation();
        return position.y < -3.45 || Math.abs(position.x) > 4.75;
      });
    },
    forceSleep() {
      tray.sleep();
      for (const { body } of bodies) body.sleep();
    },
    dispose() {
      world.free();
    },
  };

  return engine;
}
