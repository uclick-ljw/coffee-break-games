import RAPIER, { type RigidBody } from '@dimforge/rapier3d-deterministic-compat';
import { arcadeRandom, ARCADE_STEP, type Point } from './hole-game.ts';

export const DEMO_W = 400, DEMO_H = 480;
export const DEMO_SCALE = 31;
export const LAUNCH = { x: 84, y: 320 };
export const SHOT_LIMIT = 3;
export const AIM_SECONDS = 12;
export const PULL_LIMIT = 82;
const originY = 345;
export const toBoard = (p: Point): Point => ({ x: p.x * DEMO_SCALE + 200, y: originY - p.y * DEMO_SCALE });
const toWorld = (p: Point): Point => ({ x: (p.x - 200) / DEMO_SCALE, y: (originY - p.y) / DEMO_SCALE });
export type Debris = { id: number; body: RigidBody; w: number; h: number; points: number; scored: boolean; scoredAt: number; color: string };
export type DemoEngine = {
  blocks: Debris[]; balls: RigidBody[]; score: number; count: number; shots: number; elapsed: number;
  phase: 'aim' | 'flight' | 'done'; aimLeft: number; shotAge: number; stable: number;
  fire: (pull: Point) => boolean; step: () => void; dispose: () => void;
};
let ready: Promise<unknown> | undefined;

export function shotVelocity(pull: Point) {
  if (!Number.isFinite(pull.x) || !Number.isFinite(pull.y)) return { x: 0, y: 0 };
  const x = Math.max(0, -pull.x), y = Math.max(0, pull.y);
  const scale = Math.min(1, PULL_LIMIT / (Math.hypot(x, y) || 1));
  return { x: x * scale * .23, y: y * scale * .23 };
}

export async function makeDemolition(seed: number): Promise<DemoEngine> {
  ready ??= RAPIER.init(); await ready;
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = ARCADE_STEP; world.numSolverIterations = 10;
  const random = arcadeRandom(seed);
  const blocks: Debris[] = [], balls: RigidBody[] = [];
  const dynamic = (x: number, y: number) => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, 0).setLinearDamping(.15).setAngularDamping(.24).setCcdEnabled(true));
    body.setEnabledTranslations(true, true, false, true); body.setEnabledRotations(false, false, true, true);
    return body;
  };
  // The raised platform and the lower collection floor are separate, real colliders.
  world.createCollider(RAPIER.ColliderDesc.cuboid(3.1, .17, .7).setTranslation(1.7, -.17, 0).setFriction(.65));
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, .3, .7).setTranslation(0, -2.95, 0).setFriction(.8));
  const add = (x: number, y: number, w: number, h: number, points: number, color: string, density = .8) => {
    const body = dynamic(x, y);
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, .3).setDensity(density).setFriction(.5).setRestitution(.06), body);
    blocks.push({ id: blocks.length, body, w, h, points, color, scored: false, scoredAt: 0 });
  };
  const shift = (random() - .5) * .2;
  for (let tower = 0; tower < 2; tower++) {
    const center = tower === 0 ? -.1 + shift : 3.3 - shift;
    const spread = .62 + random() * .13;
    for (let level = 0; level < 3; level++) {
      const y = level * 1.5;
      add(center - spread, y + .62, .28, 1.24, 40, '#43bbc3');
      add(center + spread, y + .62, .28, 1.24, 40, '#43bbc3');
      add(center, y + 1.37, 2.1, .26, 60, '#ffa43a');
    }
    add(center + (random() - .5) * .4, 4.85, .7, .7, 120, '#ed6284', 1.3);
  }
  // Pre-settle before enabling input. No free points for construction jitter.
  for (let i = 0; i < 180; i++) world.step();
  const game: DemoEngine = {
    blocks, balls, score: 0, count: 0, shots: 0, elapsed: 0, phase: 'aim', aimLeft: AIM_SECONDS, shotAge: 0, stable: 0,
    fire(pull) {
      if (game.phase !== 'aim' || game.shots >= SHOT_LIMIT) return false;
      const velocity = shotVelocity(pull);
      if (Math.hypot(velocity.x, velocity.y) < 1.8) return false;
      for (const block of blocks) { block.body.setLinearDamping(.15); block.body.setAngularDamping(.24); }
      const start = toWorld(LAUNCH), ball = dynamic(start.x, start.y);
      world.createCollider(RAPIER.ColliderDesc.ball(.26).setDensity(9).setFriction(.5).setRestitution(.16), ball);
      ball.setLinvel({ ...velocity, z: 0 }, true); balls.push(ball);
      game.shots++; game.phase = 'flight'; game.shotAge = 0; game.stable = 0;
      return true;
    },
    step() {
      if (game.phase === 'done') return;
      world.step(); game.elapsed += ARCADE_STEP;
      for (const block of blocks) {
        // A center below the platform is unambiguously in the collection area.
        if (!block.scored && block.body.translation().y < -.65) {
          block.scored = true; block.scoredAt = game.elapsed; game.count++; game.score += block.points;
        }
      }
      if (game.phase === 'aim') {
        game.aimLeft -= ARCADE_STEP;
        if (game.aimLeft <= 0) { game.shots++; game.phase = 'flight'; game.shotAge = 0; game.stable = 0; }
      } else {
        game.shotAge += ARCADE_STEP;
        const moving = [...blocks.map((block) => block.body), ...balls].some((body) => {
          const p = body.translation(), v = body.linvel();
          return Math.abs(p.x) < 20 && p.y > -4 && (Math.hypot(v.x, v.y) > .07 || Math.abs(body.angvel().z) > .07);
        });
        game.stable = moving ? 0 : game.stable + ARCADE_STEP;
        if (game.shotAge > 1.3 && game.stable > .5) {
          game.phase = game.shots >= SHOT_LIMIT ? 'done' : 'aim'; game.aimLeft = AIM_SECONDS;
        }
        // ponytail: high damping only after 6s bounds pathological rolling; never awards predicted falls.
        if (game.shotAge > 6) for (const body of [...blocks.map((b) => b.body), ...balls]) { body.setLinearDamping(2); body.setAngularDamping(3); }
      }
    },
    dispose() { world.free(); },
  };
  return game;
}
