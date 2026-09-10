import assert from 'node:assert/strict';
import { BALL_COUNT, BALL_R, BIN_FLOOR, BIN_POINTS, CELL, COLS, DIG_SECONDS, DRAIN_SECONDS, SAND_TOP, STEP, digSand, makeSandWorld, nearestOnSegment, rankSand, stepSand, type Point, type SandWorld } from '../app/sand-game.ts';

function advance(world: SandWorld, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) stepSand(world);
}
function stroke(world: SandWorld, points: Point[]) {
  for (let i = 1; i < points.length; i++) digSand(world, points[i - 1], points[i]);
}
function healthy(world: SandWorld) {
  assert.equal(world.balls.length, BALL_COUNT);
  assert.equal(world.collected, world.balls.filter((b) => b.bin !== null).length);
  assert.equal(world.score, world.bins.reduce((sum, count, i) => sum + count * BIN_POINTS[i], 0));
  for (const ball of world.balls) {
    assert.ok([ball.x, ball.y, ball.vx, ball.vy].every(Number.isFinite));
    assert.ok(ball.x >= 12 + BALL_R - .01 && ball.x <= 388 - BALL_R + .01);
    if (ball.bin !== null) assert.equal(ball.y, BIN_FLOOR - BALL_R);
  }
}

const intact = makeSandWorld(8);
advance(intact, DIG_SECONDS + DRAIN_SECONDS);
assert.equal(intact.score, 0);
assert.ok(intact.done);
assert.ok(intact.balls.every((ball) => ball.y <= SAND_TOP - BALL_R + .05), 'Solid sand must support every ball.');
healthy(intact);

const strokeTest = makeSandWorld(8);
assert.equal(digSand(strokeTest, { x: NaN, y: 0 }, { x: 20, y: 90 }), 0);
digSand(strokeTest, { x: 200, y: 80 }, { x: 200, y: 430 });
for (let y = 80 / CELL; y < 440 / CELL; y++) assert.equal(strokeTest.sand[y * COLS + 50], 0, 'Fast swipes must not leave holes in their stroke.');
const rockBefore = JSON.stringify(strokeTest.rocks);
digSand(strokeTest, { x: -100, y: -100 }, { x: 800, y: 800 });
assert.equal(JSON.stringify(strokeTest.rocks), rockBefore, 'Rocks are not excavatable.');
strokeTest.elapsed = DIG_SECONDS;
assert.equal(digSand(strokeTest, { x: 60, y: 80 }, { x: 60, y: 440 }), 0);

const late = makeSandWorld(8);
late.sand.fill(0); late.rocks = []; late.elapsed = DIG_SECONDS - STEP;
late.balls.forEach((ball, i) => { ball.x = 40 + i % 3 * 18; ball.y = 390 - Math.floor(i / 3) * 15; });
stepSand(late);
assert.equal(late.score, 0, 'Crossing the bin opening must not award points before arrival.');
assert.equal(late.done, false, 'Digging deadline must leave time for falling balls.');
advance(late, DRAIN_SECONDS);
assert.equal(late.collected, BALL_COUNT);
assert.equal(late.score, BALL_COUNT * 10);
const scoreBefore = late.score;
advance(late, 5);
assert.equal(late.score, scoreBefore, 'No double counting after completion.');
healthy(late);

const route = [[155, 80], [200, 115], [243, 142], [246, 212], [215, 270], [215, 334], [273, 350], [273, 402], [202, 454], [200, 495]].map(([x, y]) => ({ x, y }));
const scores: number[] = [];
for (let seed = 1; seed <= 12; seed++) {
  const world = makeSandWorld(seed * 8017);
  stroke(world, route);
  stroke(world, [{ x: 250, y: 80 }, { x: 205, y: 116 }]);
  advance(world, DIG_SECONDS + DRAIN_SECONDS);
  healthy(world);
  scores.push(world.score);
  assert.ok(world.score > 0, `A continuous downhill path should deliver balls (seed ${seed}).`);
  for (const ball of world.balls.filter((b) => b.bin === null)) for (const rock of world.rocks) {
    const p = nearestOnSegment(ball, rock.a, rock.b);
    assert.ok(Math.hypot(ball.x - p.x, ball.y - p.y) >= rock.r + BALL_R - .1, 'Ball penetrated a rock.');
  }
}
const original = makeSandWorld(913);
const mirrored = makeSandWorld(913, true);
assert.deepEqual(mirrored.sand, original.sand);
assert.deepEqual(mirrored.balls.map((b) => b.x), original.balls.map((b) => 400 - b.x));
assert.deepEqual(mirrored.rocks.map((r) => r.a.x), original.rocks.map((r) => 400 - r.a.x));
for (const seed of [1, 1234, 8017]) {
  const pair = [makeSandWorld(seed), makeSandWorld(seed, true)];
  pair.forEach((world, index) => {
    const mirror = (p: Point) => ({ x: index ? 400 - p.x : p.x, y: p.y });
    stroke(world, route.map(mirror));
    stroke(world, [{ x: 250, y: 80 }, { x: 205, y: 116 }].map(mirror));
    advance(world, DIG_SECONDS + DRAIN_SECONDS);
  });
  assert.equal(pair[0].score, pair[1].score, 'Mirrored paths must receive the same points.');
}
const ranked = rankSand([100, 250, 250, 0, 50, 0].map((score, player) => ({ score, player, collected: 0, bins: [0, 0, 0, 0, 0] })));
assert.deepEqual(ranked.map((r) => r.rank), [1, 1, 3, 4, 5, 5]);
console.log('Sand checks passed: solid support, continuous digging, rock contact, arrival-only scoring, timeout drain, mirror maps, 6-player ties.');
console.log('Downhill-route scores across 12 maps:', scores.join(', '));
