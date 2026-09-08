import RAPIER, { type RigidBody } from '@dimforge/rapier3d-deterministic-compat';

export const DOMINO = { width: 0.56, height: 1.1, thickness: 0.18 };
export const DOMINO_MS = 30000;
export const DOMINO_STEP = 1 / 120;
export type Domino = { id: number; x: number; z: number; yaw: number; color: string; added?: boolean };
export type DominoSlot = { id: number; x: number; z: number; yaw: number; group: string };
export type DominoBoard = { pieces: Domino[]; slots: DominoSlot[] };
export type DominoPlacement = { slot: number; yaw: number };
export type DominoPose = Domino & { y: number; q: { x: number; y: number; z: number; w: number }; fallen: boolean };
export type DominoScore = { player: number; fallen: number; elapsedMs: number };
const COLORS = ['#30b9b0', '#faad45', '#a991f7'];
let ready: Promise<unknown> | undefined;

// Y is up. Local +Z is the thin face's outward normal / intended fall direction.
export function dominoYaw(yaw: number) { return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }; }

export function makeDominoBoard(mirror = false): DominoBoard {
  const pieces: Domino[] = [];
  const slots: DominoSlot[] = [];
  function add(x: number, z: number, yaw: number, color: string) { pieces.push({ id: pieces.length, x, z, yaw, color }); }
  function slot(x: number, z: number, yaw: number, group: string) { slots.push({ id: slots.length, x, z, yaw, group }); }
  // Unbroken central spine feeds four physical Y junctions, not scripted triggers.
  for (let i = 0; i < 14; i++) add(0, .6 + i * .7, 0, COLORS[0]);
  for (let branch = 0; branch < 4; branch++) {
    const side = branch % 2 ? 1 : -1;
    const baseZ = 1.3 + branch * 2.1;
    const group = ['A', 'B', 'C', 'D'][branch];
    const color = COLORS[1 + branch % 2];
    // Smooth 90-degree bend; adjacent normals rotate only 18 degrees.
    const points: { x: number; z: number; yaw: number }[] = [];
    for (let i = 1; i <= 5; i++) {
      const angle = i * Math.PI / 10;
      points.push({ x: side * (.38 + 2.2 * (1 - Math.cos(angle))), z: baseZ + 2.2 * Math.sin(angle), yaw: side * angle });
    }
    points[0] = { x: side * .43, z: baseZ + .35, yaw: side * Math.PI / 6 };
    for (let i = 1; i <= 5; i++) points.push({ x: side * (2.58 + i * .7), z: baseZ + 2.2, yaw: side * Math.PI / 2 });
    points.forEach((point, i) => {
      if (i === 2 || i === 6) slot(point.x, point.z, point.yaw, group);
      else add(point.x, point.z, point.yaw, color);
    });
    if (branch === 0 || branch === 2) {
      const last = points.at(-1)!;
      for (let i = 1; i <= (branch === 0 ? 4 : 2); i++) {
        const angle = i * Math.PI / 6;
        add(last.x + side * 1.3 * Math.sin(angle), last.z - 1.3 * (1 - Math.cos(angle)), side * (Math.PI / 2 + angle), color);
      }
    }
    // A lateral alternative at the entrance changes the contact point and turn angle.
    const gate = points[2];
    slot(gate.x + side * .22, gate.z - .22, gate.yaw, group);
  }
  if (mirror) {
    for (const item of [...pieces, ...slots]) { item.x *= -1; item.yaw *= -1; }
  }
  return { pieces, slots };
}

export function placedDominoes(board: DominoBoard, placements: DominoPlacement[]): Domino[] {
  return [...board.pieces, ...placements.slice(0, 3).flatMap((placement, i) => {
    const slot = board.slots.find((item) => item.id === placement.slot);
    if (!slot || !Number.isFinite(placement.yaw)) return [];
    return [{ id: board.pieces.length + i, x: slot.x, z: slot.z, yaw: placement.yaw, color: '#ff537c', added: true }];
  })];
}

export function dominoOverlap(a: Pick<Domino, 'x' | 'z' | 'yaw'>, b: Pick<Domino, 'x' | 'z' | 'yaw'>) {
  const axes = (yaw: number) => [{ x: Math.cos(yaw), z: -Math.sin(yaw) }, { x: Math.sin(yaw), z: Math.cos(yaw) }];
  const aa = axes(a.yaw), bb = axes(b.yaw);
  const half = [DOMINO.width / 2 + .015, DOMINO.thickness / 2 + .015];
  return [...aa, ...bb].every((axis) => {
    const radius = (basis: typeof aa) => basis.reduce((sum, v, i) => sum + Math.abs(v.x * axis.x + v.z * axis.z) * half[i], 0);
    return Math.abs((b.x - a.x) * axis.x + (b.z - a.z) * axis.z) < radius(aa) + radius(bb);
  });
}

export function canPlaceDomino(board: DominoBoard, placements: DominoPlacement[], index: number, candidate: DominoPlacement) {
  const slot = board.slots.find((item) => item.id === candidate.slot);
  if (!slot || !Number.isFinite(candidate.yaw) || index < 0 || index > Math.min(2, placements.length)) return false;
  if (placements.some((item, i) => i !== index && item.slot === candidate.slot)) return false;
  const piece = { ...slot, yaw: candidate.yaw };
  return !placedDominoes(board, placements.filter((_, i) => i !== index)).some((item) => dominoOverlap(piece, item));
}

export function rankDominoes(scores: DominoScore[]) {
  const ordered = [...scores].sort((a, b) => b.fallen - a.fallen || a.elapsedMs - b.elapsedMs);
  let rank = 0;
  return ordered.map((item, i) => { if (!i || item.fallen !== ordered[i - 1].fallen || item.elapsedMs !== ordered[i - 1].elapsedMs) rank = i + 1; return { ...item, rank }; });
}

export async function createDominoEngine(pieces: Domino[]) {
  ready ??= RAPIER.init();
  await ready;
  // Reflections use one canonical physics frame: floating-point contact ordering must
  // not give the next player a different score for an equivalent placement.
  const reflected = (pieces.find((p) => Math.abs(p.x) > .001)?.x ?? 0) > 0;
  const physical = reflected ? pieces.map((p) => ({ ...p, x: -p.x, yaw: -p.yaw })) : pieces;
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DOMINO_STEP;
  world.numSolverIterations = 12;
  world.createCollider(RAPIER.ColliderDesc.cuboid(12, .15, 16).setTranslation(0, -.15, 5).setFriction(.72).setRestitution(0));
  const bodies: RigidBody[] = physical.map((piece) => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(piece.x, DOMINO.height / 2 + .001, piece.z).setRotation(dominoYaw(piece.yaw))
      .setLinearDamping(.05).setAngularDamping(.09).setCcdEnabled(true));
    world.createCollider(RAPIER.ColliderDesc.cuboid(DOMINO.width / 2, DOMINO.height / 2, DOMINO.thickness / 2)
      .setDensity(1).setFriction(.65).setRestitution(.015), body);
    return body;
  });
  // Settle the initial floor contacts before applying one real impulse at the top.
  for (let i = 0; i < 90; i++) world.step();
  let accumulator = 0, elapsed = 0, quiet = 0, started = false, disposed = false;
  const fallen = new Set<number>();
  const snapshot = (): DominoPose[] => bodies.map((body, i) => {
    const p = body.translation(), q = body.rotation();
    return { ...pieces[i], x: reflected ? -p.x : p.x, y: p.y, z: p.z, q: reflected ? { x: q.x, y: -q.y, z: -q.z, w: q.w } : q, fallen: fallen.has(pieces[i].id) };
  });
  return {
    start() {
      if (started || disposed || !bodies.length) return;
      started = true;
      const body = bodies[0], p = body.translation(), yaw = physical[0].yaw;
      body.applyImpulseAtPoint({ x: Math.sin(yaw) * .075, y: 0, z: Math.cos(yaw) * .075 }, { x: p.x, y: .96, z: p.z }, true);
    },
    step(seconds: number) {
      if (!started || disposed) return;
      // Catch up in bounded batches without making the physics timestep frame-dependent.
      accumulator += Math.min(.1, Math.max(0, seconds));
      while (accumulator >= DOMINO_STEP) {
        world.step(); accumulator -= DOMINO_STEP; elapsed += DOMINO_STEP;
        let moving = false;
        bodies.forEach((body, i) => {
          const q = body.rotation(), up = 1 - 2 * (q.x * q.x + q.z * q.z);
          if (up < Math.cos(Math.PI / 3)) fallen.add(pieces[i].id);
          const v = body.linvel(), w = body.angvel();
          if (Math.hypot(v.x, v.y, v.z) > .012 || Math.hypot(w.x, w.y, w.z) > .025) moving = true;
        });
        quiet = moving ? 0 : quiet + DOMINO_STEP;
      }
    },
    snapshot,
    get fallen() { return fallen.size; },
    get elapsed() { return elapsed; },
    get settled() { return started && elapsed > 1.5 && quiet > 1.2; },
    dispose() { if (!disposed) { disposed = true; world.free(); } },
  };
}
export type DominoEngine = Awaited<ReturnType<typeof createDominoEngine>>;
