import assert from 'node:assert/strict';
import { ARCADE_STEP, TOYS, arcadeRandom, canSwallow, makeHoleWorld, moveHole, rankArcade, stepHole, type Point } from '../app/hole-game.ts';
import { makeDemolition, shotVelocity, type DemoEngine } from '../app/demolition-game.ts';

function holeRun(seed: number, strategy: 'idle' | 'random' | 'sweep' | 'nearest') {
  const w = makeHoleWorld(seed), random = arcadeRandom(seed + 999);
  for (let n = 0; !w.done && n < 4000; n++) {
    if (strategy === 'random' && n % 60 === 0) moveHole(w, { x: random() * 400, y: random() * 480 });
    if (strategy === 'sweep') { const row = Math.floor(w.elapsed / 2.7); moveHole(w, { x: row % 2 ? 20 : 380, y: 450 - (row % 10) * 44 }); }
    if (strategy === 'nearest') {
      const toys = w.toys.filter((toy) => !toy.eaten && !toy.sinking && canSwallow(w, toy));
      toys.sort((a, b) => Math.hypot(a.x - w.hole.x, a.y - w.hole.y) - Math.hypot(b.x - w.hole.x, b.y - w.hole.y));
      if (toys[0]) moveHole(w, toys[0]);
    }
    stepHole(w);
  }
  assert.ok(w.done, 'hole turn never ends');
  assert.ok(w.elapsed <= 30.4, 'pending swallow must be brief');
  assert.equal(w.score, w.toys.filter((toy) => toy.eaten).reduce((sum, toy) => sum + TOYS[toy.tier].points, 0));
  const score = w.score; stepHole(w); assert.equal(w.score, score);
  return w.score;
}

for (let seed = 0; seed < 100; seed++) {
  const w = makeHoleWorld(seed);
  assert.equal(w.toys.length, 84);
  for (let i = 0; i < w.toys.length; i++) for (let j = i + 1; j < w.toys.length; j++) assert.ok(Math.hypot(w.toys[i].x - w.toys[j].x, w.toys[i].y - w.toys[j].y) > TOYS[w.toys[i].tier].radius + TOYS[w.toys[j].tier].radius);
  assert.equal(holeRun(seed, 'idle'), 0);
}
assert.deepEqual(makeHoleWorld(12), makeHoleWorld(12));
const bad = makeHoleWorld(3); moveHole(bad, { x: NaN, y: Infinity }); assert.deepEqual(bad.target, { x: 200, y: 438 });
for (const n of [2, 3, 4, 5, 6]) {
  const ranks = rankArcade(Array.from({ length: n }, (_, player) => ({ player, score: player < 2 ? 10 : 0, count: 1 })));
  assert.equal(ranks.length, n); assert.equal(ranks[0].rank, 1); assert.equal(ranks[1].rank, 1);
  if (n > 2) assert.equal(ranks[2].rank, 3);
}
const holeScores = ['random', 'sweep', 'nearest'].map((strategy) => {
  const scores = Array.from({ length: 20 }, (_, seed) => holeRun(seed, strategy as 'random' | 'sweep' | 'nearest'));
  return { strategy, min: Math.min(...scores), max: Math.max(...scores), mean: Math.round(scores.reduce((a, b) => a + b) / scores.length) };
});
console.log('HOLE difficulty:', holeScores);
assert.ok(holeScores[2].mean > holeScores[0].mean * 1.5, 'deliberate collecting should beat aimless movement');
assert.ok(holeScores[2].max < 3320, 'nearest route must not trivially clear the board');

function settle(game: DemoEngine) {
  for (let step = 0; step < 2400 && game.phase === 'flight'; step++) game.step();
  assert.notEqual(game.phase, 'flight', 'collapse never settles after 20s');
  for (const block of game.blocks) { const p = block.body.translation(); assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y)); assert.ok(Math.abs(p.z) < 1e-5); }
}
async function demoRun(seed: number, shots: Point[] | null) {
  const game = await makeDemolition(seed);
  for (let i = 0; i < 600; i++) game.step();
  assert.equal(game.score, 0, 'untouched structure must be stable');
  if (shots) {
    assert.equal(game.fire({ x: NaN, y: Infinity }), false);
    assert.equal(game.fire({ x: 0, y: 0 }), false);
    for (const shot of shots) { assert.equal(game.fire(shot), true); assert.equal(game.fire(shot), false, 'no extra shot during flight'); settle(game); }
  } else for (let i = 0; i < 9000 && game.phase !== 'done'; i++) game.step();
  assert.equal(game.phase, 'done'); assert.equal(game.shots, 3);
  assert.equal(game.score, game.blocks.filter((block) => block.scored).reduce((sum, block) => sum + block.points, 0));
  assert.equal(game.fire({ x: -60, y: 50 }), false);
  const result = { score: game.score, count: game.count, seconds: Math.round(game.elapsed * 10) / 10 }; game.dispose(); return result;
}
assert.ok(Math.hypot(...Object.values(shotVelocity({ x: -10000, y: 10000 }))) <= 82 * .23 + 1e-8);
const demoScores: Record<string, { score: number; seconds: number }[]> = {};
for (const [name, shots] of Object.entries({ idle: null, weak: [{ x: -10, y: 8 }, { x: -10, y: 8 }, { x: -10, y: 8 }], low: [{ x: -75, y: 8 }, { x: -75, y: 8 }, { x: -75, y: 8 }], support: [{ x: -56, y: 52 }, { x: -70, y: 38 }, { x: -60, y: 52 }], high: [{ x: -42, y: 68 }, { x: -50, y: 65 }, { x: -65, y: 48 }] })) {
  demoScores[name] = [];
  for (let seed = 0; seed < 10; seed++) demoScores[name].push(await demoRun(seed, shots));
}
console.log('DEMOLITION difficulty:', Object.entries(demoScores).map(([strategy, rows]) => ({ strategy, min: Math.min(...rows.map((r) => r.score)), max: Math.max(...rows.map((r) => r.score)), mean: Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length), longest: Math.max(...rows.map((r) => r.seconds)) })));
assert.ok(demoScores.idle.every((r) => r.score === 0));
assert.ok(demoScores.support.some((r) => r.score > 0));
console.log('Arcade state, score, fairness, physics and difficulty checks passed. Fixed timestep:', ARCADE_STEP);
