import RAPIER, { type RigidBody, type World } from '@dimforge/rapier3d-deterministic-compat';

export const TOWER_WIDTH = 360;
export const TOWER_HEIGHT = 500;
export const TOWER_RADIUS = 1.42;
export const TOWER_BOTTOM = -0.6;
export const TOWER_TOP = 5;
export const BALL_RADIUS = 0.18;
export const PIN_RADIUS = 0.062;
export const PIXELS_PER_UNIT = 82;
export const VIEW_DEPTH_TILT = 20;
export const WALL_LEFT = TOWER_WIDTH / 2 - TOWER_RADIUS * PIXELS_PER_UNIT;
export const WALL_RIGHT = TOWER_WIDTH / 2 + TOWER_RADIUS * PIXELS_PER_UNIT;
export const BALL_RADIUS_PX = BALL_RADIUS * PIXELS_PER_UNIT;
export const PIN_WIDTH_PX = PIN_RADIUS * 2 * PIXELS_PER_UNIT;

export type Face = 0 | 1 | 2 | 3;
export const FACE_LABELS = ['앞면', '오른쪽 면', '뒷면', '왼쪽 면'] as const;

type Vector3 = { x: number; y: number; z: number };

export type Ball = Vector3 & {
  id: number;
  color: string;
  fallen: boolean;
};

export type Pin = {
  id: number;
  entry: Vector3;
  exit: Vector3;
  axis: Vector3;
  center: Vector3;
  length: number;
  face: Face;
  color: string;
  progress: number;
  removing: boolean;
  gone: boolean;
};

type BallBody = {
  id: number;
  color: string;
  fallen: boolean;
  body: RigidBody | null;
};

type PinBody = Pin & {
  initialCenter: Vector3;
  body: RigidBody | null;
};

const BALL_COLORS = ['#ef476f', '#ff9f1c', '#ffd166', '#06d6a0', '#3a86ff', '#8b5cf6'];
const PIN_COLORS = ['#ec6b56', '#f3b63f', '#54a8d8', '#6a78c8'];
const STEP = 1 / 120;
const FALL_Y = -0.78;
const PULL_SECONDS = 0.3;
const WALL_SEGMENTS = 28;
let rapierReady: Promise<unknown> | undefined;

function readyRapier() {
  rapierReady ??= RAPIER.init();
  return rapierReady;
}

function random(seed: number, index: number) {
  let value = Math.imul(seed ^ (index + 1), 2654435761);
  value ^= value >>> 15;
  value = Math.imul(value, 2246822519);
  return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
}

function normalize(vector: Vector3): Vector3 {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function rotationFromUp(direction: Vector3) {
  const axis = { x: direction.z, y: 0, z: -direction.x };
  const w = 1 + direction.y;
  if (w < 0.00001) return { x: 1, y: 0, z: 0, w: 0 };
  const length = Math.hypot(axis.x, axis.y, axis.z, w) || 1;
  return { x: axis.x / length, y: axis.y / length, z: axis.z / length, w: w / length };
}

export function towerCounts(players: number) {
  return { pins: 48, balls: 15 + players * 3 };
}

function createWalls(world: World) {
  const height = (TOWER_TOP - TOWER_BOTTOM) / 2;
  const centerY = (TOWER_TOP + TOWER_BOTTOM) / 2;
  const thickness = 0.055;
  const halfWidth = TOWER_RADIUS * Math.tan(Math.PI / WALL_SEGMENTS) * 1.04;
  for (let index = 0; index < WALL_SEGMENTS; index += 1) {
    const angle = (index / WALL_SEGMENTS) * Math.PI * 2;
    const yaw = Math.PI / 2 - angle;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfWidth, height, thickness / 2)
        .setTranslation(
          Math.cos(angle) * (TOWER_RADIUS + thickness / 2),
          centerY,
          Math.sin(angle) * (TOWER_RADIUS + thickness / 2),
        )
        .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
        .setFriction(0.38)
        .setRestitution(0.04),
    );
  }
}

function makePin(world: World, id: number, total: number, seed: number): PinBody {
  const face = (id % 4) as Face;
  const layer = Math.floor(id / 12);
  const layerCount = Math.ceil(total / 12);
  const variant = Math.floor((id % 12) / 4);
  const layerShift = layer % 2 === 0 ? -0.25 : 0.25;
  const sideOffset = [-0.76, 0, 0.76][variant] + layerShift + (random(seed, id * 7 + 1) - 0.5) * 0.08;
  const edge = Math.sqrt(TOWER_RADIUS ** 2 - sideOffset ** 2);
  let wallX = sideOffset;
  let wallZ = -edge;
  if (face === 1) {
    wallX = edge;
    wallZ = sideOffset;
  } else if (face === 2) {
    wallX = -sideOffset;
    wallZ = edge;
  } else if (face === 3) {
    wallX = -edge;
    wallZ = -sideOffset;
  }
  const entryAngle = Math.atan2(wallZ, wallX);
  const skew = (random(seed, id * 7 + 2) - 0.5) * 0.32;
  const slope = (random(seed, id * 7 + 3) - 0.5) * 0.075;
  const entryOnWall = {
    x: Math.cos(entryAngle) * TOWER_RADIUS,
    y: 0.58 + layer * (1.86 / Math.max(1, layerCount - 1)) + (random(seed, id * 7 + 4) - 0.5) * 0.022,
    z: Math.sin(entryAngle) * TOWER_RADIUS,
  };
  const inward = { x: -Math.cos(entryAngle), y: 0, z: -Math.sin(entryAngle) };
  const tangent = { x: -Math.sin(entryAngle), y: 0, z: Math.cos(entryAngle) };
  const horizontal = normalize({
    x: inward.x * Math.cos(skew) + tangent.x * Math.sin(skew),
    y: 0,
    z: inward.z * Math.cos(skew) + tangent.z * Math.sin(skew),
  });
  const exitDistance = -2 * (entryOnWall.x * horizontal.x + entryOnWall.z * horizontal.z);
  const extension = 0.16;
  const entry = {
    x: entryOnWall.x - horizontal.x * extension,
    y: entryOnWall.y - slope * extension,
    z: entryOnWall.z - horizontal.z * extension,
  };
  const exit = {
    x: entryOnWall.x + horizontal.x * (exitDistance + extension),
    y: entryOnWall.y + slope * (exitDistance + extension),
    z: entryOnWall.z + horizontal.z * (exitDistance + extension),
  };
  const delta = { x: entry.x - exit.x, y: entry.y - exit.y, z: entry.z - exit.z };
  const length = Math.hypot(delta.x, delta.y, delta.z);
  const axis = normalize(delta);
  const center = {
    x: (entry.x + exit.x) / 2,
    y: (entry.y + exit.y) / 2,
    z: (entry.z + exit.z) / 2,
  };
  const direction = normalize({ x: exit.x - entry.x, y: exit.y - entry.y, z: exit.z - entry.z });
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(center.x, center.y, center.z)
      .setRotation(rotationFromUp(direction)),
  );
  world.createCollider(
    RAPIER.ColliderDesc.capsule(length / 2, PIN_RADIUS)
        .setFriction(0.62)
      .setRestitution(0.02),
    body,
  );
  return {
    id,
    entry,
    exit,
    axis,
    center,
    initialCenter: center,
    length,
    face,
    color: PIN_COLORS[layer % PIN_COLORS.length],
    progress: 0,
    removing: false,
    gone: false,
    body,
  };
}

function makeBalls(world: World, count: number, seed: number): BallBody[] {
  const positions = [
    [-0.42, -0.42], [0, -0.42], [0.42, -0.42],
    [-0.42, 0], [0, 0], [0.42, 0],
    [-0.42, 0.42], [0, 0.42], [0.42, 0.42],
  ];
  return Array.from({ length: count }, (_, id) => {
    const layer = Math.floor(id / positions.length);
    const [baseX, baseZ] = positions[id % positions.length];
    const x = baseX + (random(seed, 500 + id) - 0.5) * 0.045;
    const z = baseZ + (random(seed, 700 + id) - 0.5) * 0.045;
    const y = 3.12 + layer * (BALL_RADIUS * 2.18) + (random(seed, 900 + id) - 0.5) * 0.018;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setLinearDamping(0.55)
        .setAngularDamping(0.65)
        .setCcdEnabled(true),
    );
    world.createCollider(
      RAPIER.ColliderDesc.ball(BALL_RADIUS)
        .setDensity(1)
        .setFriction(0.5)
        .setRestitution(0.035),
      body,
    );
    return { id, color: BALL_COLORS[id % BALL_COLORS.length], fallen: false, body };
  });
}

export class TowerEngine {
  private accumulator = 0;
  private disposed = false;
  private world: World;
  private ballBodies: BallBody[];
  private pinBodies: PinBody[];

  constructor(world: World, ballBodies: BallBody[], pinBodies: PinBody[]) {
    this.world = world;
    this.ballBodies = ballBodies;
    this.pinBodies = pinBodies;
  }

  get balls(): Ball[] {
    return this.ballBodies.map((ball) => {
      const position = ball.body?.translation() ?? { x: 0, y: FALL_Y, z: 0 };
      return { id: ball.id, color: ball.color, fallen: ball.fallen, ...position };
    });
  }

  get pins(): Pin[] {
    return this.pinBodies.map((pin) => {
      const center = pin.body?.translation() ?? pin.center;
      const half = pin.length / 2;
      return {
        id: pin.id,
        axis: pin.axis,
        center: { ...center },
        entry: {
          x: center.x + pin.axis.x * half,
          y: center.y + pin.axis.y * half,
          z: center.z + pin.axis.z * half,
        },
        exit: {
          x: center.x - pin.axis.x * half,
          y: center.y - pin.axis.y * half,
          z: center.z - pin.axis.z * half,
        },
        length: pin.length,
        face: pin.face,
        color: pin.color,
        progress: pin.progress,
        removing: pin.removing,
        gone: pin.gone,
      };
    });
  }

  removePin(id: number) {
    const pin = this.pinBodies.find((item) => item.id === id);
    if (!pin || pin.gone || pin.removing || !pin.body) return false;
    pin.removing = true;
    for (const ball of this.ballBodies) ball.body?.wakeUp();
    return true;
  }

  step(elapsed = STEP) {
    const newlyFallen: number[] = [];
    this.accumulator = Math.min(this.accumulator + elapsed, STEP * 6);
    while (this.accumulator >= STEP) {
      for (const pin of this.pinBodies) {
        if (!pin.removing || pin.gone || !pin.body) continue;
        pin.progress = Math.min(1, pin.progress + STEP / PULL_SECONDS);
        const distance = (pin.length + 0.35) * pin.progress;
        pin.body.setNextKinematicTranslation({
          x: pin.initialCenter.x + pin.axis.x * distance,
          y: pin.initialCenter.y + pin.axis.y * distance,
          z: pin.initialCenter.z + pin.axis.z * distance,
        });
      }
      this.world.timestep = STEP;
      this.world.step();
      for (const pin of this.pinBodies) {
        if (pin.progress < 1 || pin.gone || !pin.body) continue;
        this.world.removeRigidBody(pin.body);
        pin.body = null;
        pin.gone = true;
        pin.removing = false;
      }
      for (const ball of this.ballBodies) {
        if (ball.fallen || !ball.body || ball.body.translation().y > FALL_Y) continue;
        ball.fallen = true;
        newlyFallen.push(ball.id);
        this.world.removeRigidBody(ball.body);
        ball.body = null;
      }
      this.accumulator -= STEP;
    }
    return newlyFallen;
  }

  settled() {
    if (this.pinBodies.some((pin) => pin.removing)) return false;
    return this.ballBodies.every((ball) => {
      if (ball.fallen || !ball.body || ball.body.isSleeping()) return true;
      const velocity = ball.body.linvel();
      const angular = ball.body.angvel();
      return Math.hypot(velocity.x, velocity.y, velocity.z) < 0.075
        && Math.hypot(angular.x, angular.y, angular.z) < 0.32;
    });
  }

  forceSleep() {
    for (const ball of this.ballBodies) if (!ball.fallen) ball.body?.sleep();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.world.free();
  }
}

function buildTower(players: number, seed: number) {
  const counts = towerCounts(players);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  world.numSolverIterations = 8;
  createWalls(world);
  const pins = Array.from({ length: counts.pins }, (_, id) => makePin(world, id, counts.pins, seed));
  const balls = makeBalls(world, counts.balls, seed);
  return new TowerEngine(world, balls, pins);
}

export async function createTower(players: number, seed: number) {
  await readyRapier();
  const failures: string[] = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const tower = buildTower(players, seed + attempt * 7919);
    let stableFrames = 0;
    for (let frame = 0; frame < 2400 && stableFrames < 90; frame += 1) {
      tower.step(STEP);
      stableFrames = tower.settled() ? stableFrames + 1 : 0;
      if (tower.balls.some((ball) => ball.fallen)) break;
    }
    if (!tower.balls.some((ball) => ball.fallen) && stableFrames >= 90) {
      tower.forceSleep();
      return tower;
    }
    failures.push(`${tower.balls.filter((ball) => ball.fallen).length}/${stableFrames}`);
    tower.dispose();
  }
  throw new Error(`안정적인 구슬 타워를 만들지 못했습니다. (${failures.join(', ')})`);
}

export function projectPoint(point: Vector3, face: Face) {
  let horizontal = point.x;
  let depth = point.z;
  if (face === 1) {
    horizontal = point.z;
    depth = -point.x;
  } else if (face === 2) {
    horizontal = -point.x;
    depth = -point.z;
  } else if (face === 3) {
    horizontal = -point.z;
    depth = point.x;
  }
  return {
    x: TOWER_WIDTH / 2 + horizontal * PIXELS_PER_UNIT,
    y: TOWER_HEIGHT - 12 - (point.y - TOWER_BOTTOM) * PIXELS_PER_UNIT - depth * VIEW_DEPTH_TILT,
    depth,
  };
}

export function visibleSegment(pin: Pin, face: Face) {
  const start = projectPoint(pin.entry, face);
  const end = projectPoint(pin.exit, face);
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y, depth: (start.depth + end.depth) / 2 };
}

export function losingPlayer(scores: number[], lastDropTurn: number[]) {
  const highest = Math.max(...scores);
  return scores.reduce((loser, score, index) => (
    score === highest && lastDropTurn[index] > lastDropTurn[loser] ? index : loser
  ), scores.findIndex((score) => score === highest));
}
