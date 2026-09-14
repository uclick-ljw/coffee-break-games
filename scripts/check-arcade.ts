import assert from 'node:assert/strict';
import { ARCADE_STEP, HOLE_SPEED, TOYS, arcadeRandom, canSwallow, holeGrowth, makeHoleWorld, moveHole, rankArcade, steerHole, stepHole, type HoleWorld } from '../app/hole-game.ts';

const total = 32 * 10 + 24 * 30 + 14 * 80 + 6 * 180;
function run(seed: number, strategy: 'idle' | 'random' | 'sweep' | 'imperfect' | 'nearest', player = 0) {
  const w = makeHoleWorld(seed, player), random = arcadeRandom(seed + 999);
  let firstGrowth = 30;
  for (let n = 0; !w.done && n < 4000; n++) {
    if (strategy === 'random' && n % 60 === 0) moveHole(w, { x: random() * 400, y: random() * 480 });
    if (strategy === 'sweep') { const row = Math.floor(w.elapsed / 2.7); moveHole(w, { x: row % 2 ? 20 : 380, y: 450 - (row % 10) * 44 }); }
    if (strategy === 'nearest' || (strategy === 'imperfect' && n % 66 === 0)) {
      const toys = w.toys.filter((toy) => !toy.eaten && !toy.sinking && canSwallow(w, toy));
      toys.sort((a, b) => Math.hypot(a.x - w.hole.x, a.y - w.hole.y) - Math.hypot(b.x - w.hole.x, b.y - w.hole.y));
      if (toys[0]) {
        const noise = strategy === 'imperfect' ? 20 : 0;
        moveHole(w, { x: toys[0].x + (random() - .5) * noise, y: toys[0].y + (random() - .5) * noise });
      }
    }
    stepHole(w);
    if (firstGrowth === 30 && holeGrowth(w).tier > 0) firstGrowth = w.elapsed;
  }
  assert.ok(w.done, 'turn never ends');
  assert.ok(w.elapsed <= 30.4, 'pending swallow must be brief');
  assert.equal(w.score, w.toys.filter((toy) => toy.eaten).reduce((sum, toy) => sum + TOYS[toy.tier].points, 0));
  assert.equal(w.count, w.toys.filter((toy) => toy.eaten).length);
  assert.ok(w.score <= total);
  const score = w.score; stepHole(w); assert.equal(w.score, score);
  return { score, firstGrowth, tier: holeGrowth(w).tier };
}

for (let seed = 0; seed < 150; seed++) {
  const w = makeHoleWorld(seed);
  assert.deepEqual(TOYS.map((_, tier) => w.toys.filter((toy) => toy.tier === tier).length), [32, 24, 14, 6]);
  for (let i = 0; i < w.toys.length; i++) for (let j = i + 1; j < w.toys.length; j++) assert.ok(Math.hypot(w.toys[i].x - w.toys[j].x, w.toys[i].y - w.toys[j].y) > TOYS[w.toys[i].tier].radius + TOYS[w.toys[j].tier].radius);
  assert.equal(run(seed, 'idle').score, 0, 'idle must not collect or grow');
  for (const player of [1, 2, 3, 4, 5]) {
    const mirrored = makeHoleWorld(seed, player);
    for (const [i, toy] of mirrored.toys.entries()) {
      const original = w.toys[i];
      assert.equal(toy.tier, original.tier);
      assert.ok(Math.abs(Math.hypot(toy.x - mirrored.hole.x, toy.y - mirrored.hole.y) - Math.hypot(original.x - w.hole.x, original.y - w.hole.y)) < 1e-8);
    }
  }
}
assert.deepEqual(makeHoleWorld(12), makeHoleWorld(12));
const bad = makeHoleWorld(3); moveHole(bad, { x: NaN, y: Infinity }); steerHole(bad, { x: Infinity, y: 0 }); stepHole(bad, NaN); assert.deepEqual(bad.target, { x: 200, y: 438 });
assert.equal(bad.elapsed, 0);
for (const fps of [30, 60, 120]) {
  const w = makeHoleWorld(0); w.toys = [];
  steerHole(w, { x: 0, y: -100 });
  // Keep one distant oversized object so the empty-board completion rule does not trigger.
  w.toys = [{ ...bad.toys.find((t) => t.tier === 3)!, x: 50, y: 50 }];
  for (let n = 0; n < fps; n++) stepHole(w, 1 / fps);
  assert.ok(Math.abs(w.hole.y - (438 - HOLE_SPEED)) < 1e-7, 'held controls must be framerate independent');
  steerHole(w, { x: 0, y: 0 }); const stopped = { ...w.hole };
  for (let n = 0; n < fps; n++) stepHole(w, 1 / fps);
  assert.deepEqual(w.hole, stopped, 'release/cancel/pause must stop movement');
}
const diagonal = makeHoleWorld(0); steerHole(diagonal, { x: 9, y: -9 }); const start = { ...diagonal.hole }; stepHole(diagonal);
assert.ok(Math.abs(Math.hypot(diagonal.hole.x - start.x, diagonal.hole.y - start.y) - HOLE_SPEED * ARCADE_STEP) < 1e-8);
const practice = makeHoleWorld(17, 0, 10);
while (!practice.done) stepHole(practice);
assert.ok(practice.elapsed >= 10 && practice.elapsed < 10.4);
assert.equal(makeHoleWorld(17).elapsed, 0, 'practice must be independent');
const blocked = makeHoleWorld(19), large = blocked.toys.find((t) => t.tier === 3)!;
blocked.hole = { x: large.x, y: large.y }; blocked.target = { ...blocked.hole }; stepHole(blocked);
assert.equal(large.sinking, 0); assert.ok(blocked.blockedUntil > blocked.elapsed);
for (const [mass, tier] of [[0, 0], [8, 0], [9, 1], [55, 2], [126, 3]]) assert.equal(holeGrowth({ mass, radius: Math.min(43, Math.sqrt(289 + mass * 8)) }).tier, tier);
const late: HoleWorld = makeHoleWorld(9);
late.elapsed = 29.99; late.toys = late.toys.slice(0, 2);
late.toys[0].sinking = .01;
late.toys[1].x = late.hole.x; late.toys[1].y = late.hole.y;
stepHole(late, .02); assert.equal(late.toys[1].sinking, 0, 'no new captures after the deadline');
while (!late.done) stepHole(late);
assert.equal(late.count, 1); assert.equal(late.score, 10);
for (const n of [2, 3, 4, 5, 6]) {
  const ranks = rankArcade(Array.from({ length: n }, (_, player) => ({ player, score: player < 2 ? 10 : 0, count: 1 })));
  assert.equal(ranks.length, n); assert.equal(ranks[0].rank, 1); assert.equal(ranks[1].rank, 1);
  if (n > 2) assert.equal(ranks[2].rank, 3);
}
const rows = (['random', 'sweep', 'imperfect', 'nearest'] as const).map((strategy) => {
  const results = Array.from({ length: 30 }, (_, seed) => run(seed, strategy));
  return { strategy, min: Math.min(...results.map((r) => r.score)), max: Math.max(...results.map((r) => r.score)), mean: Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length), firstGrowth: +(results.reduce((sum, r) => sum + r.firstGrowth, 0) / results.length).toFixed(1), finalTier: +(results.reduce((sum, r) => sum + r.tier + 1, 0) / results.length).toFixed(1) };
});
console.log('HOLE difficulty (simulations, not human play):', rows);
assert.ok(rows[2].mean > rows[0].mean * 2, 'intentional imperfect movement should beat aimless movement');
assert.ok(rows[2].firstGrowth < 8, 'a learner following small items must grow early');
assert.ok(rows[3].max < total, 'nearest route must not trivially clear the whole board');
for (let player = 1; player < 6; player++) assert.equal(run(3, 'nearest', player).score, run(3, 'nearest', 0).score, 'mirrors must preserve collecting opportunities');
console.log('Black hole generation, growth, controls, fairness, deadline and 2–6-player ranking checks passed.');
