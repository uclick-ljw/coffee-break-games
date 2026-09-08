import assert from 'node:assert/strict';
import { canPlaceDomino, createDominoEngine, dominoOverlap, makeDominoBoard, placedDominoes, rankDominoes, type Domino, type DominoPlacement } from '../app/domino-game.ts';

async function run(pieces: Domino[], frame = 1 / 60) {
  const engine = await createDominoEngine(pieces);
  try {
    assert.ok(engine.snapshot().every((p) => Math.abs(p.q.x) + Math.abs(p.q.z) < .01), 'A domino moved before the first push');
    engine.start();
    let maxSecondTilt = 0;
    while (!engine.settled && engine.elapsed < 25) {
      engine.step(frame);
      const q = engine.snapshot()[1]?.q;
      if (q) maxSecondTilt = Math.max(maxSecondTilt, Math.acos(Math.min(1, 1 - 2 * (q.x * q.x + q.z * q.z))));
    }
    assert.ok(engine.settled, 'Simulation did not settle');
    assert.ok(engine.snapshot().every((p) => [p.x, p.y, p.z, ...Object.values(p.q)].every(Number.isFinite)), 'Non-finite physics state');
    const count = engine.fallen;
    for (let i = 0; i < 180; i++) engine.step(1 / 60);
    assert.equal(engine.fallen, count, 'Score changed after settlement');
    return { count, maxSecondTilt, seconds: engine.elapsed };
  } finally { engine.dispose(); }
}
const line = (gap: number) => Array.from({ length: 8 }, (_, id) => ({ id, x: 0, z: id ? gap + (id - 1) * .7 : 0, yaw: 0, color: '#fff' }));
assert.equal((await run(line(.7))).count, 8, 'Straight chain must propagate through contact');
assert.equal((await run(line(1.4))).count, 1, 'A real gap must stop the chain');
const near = await run(line(1.27));
assert.equal(near.count, 1, 'A grazing contact must not auto-topple the neighbor');
assert.ok(near.maxSecondTilt > .03 && near.maxSecondTilt < .3, 'Near miss should visibly wobble and remain upright');
assert.equal((await run(line(1.25))).count, 8, 'A slightly closer contact must transfer enough energy');

const board = makeDominoBoard();
assert.equal(board.slots.length, 12);
for (const [i, piece] of board.pieces.entries()) assert.ok(board.pieces.slice(i + 1).every((other) => !dominoOverlap(piece, other)), 'Fixed starting dominoes overlap');
const good = [0, 1, 3].map((slot) => ({ slot, yaw: Math.round(board.slots[slot].yaw / (Math.PI / 12)) * Math.PI / 12 }));
assert.ok(good.every((p, i) => canPlaceDomino(board, good.slice(0, i), i, p)));
assert.equal(canPlaceDomino(board, [good[0]], 1, good[0]), false, 'Duplicate slot');
assert.equal(canPlaceDomino(board, [], 0, { slot: 99, yaw: 0 }), false);
assert.equal(canPlaceDomino(board, [], 0, { slot: 1, yaw: NaN }), false);
assert.equal(canPlaceDomino(board, [], 0, { slot: 0, yaw: 0 }), true);
const empty = await run(board.pieces), connected = await run(placedDominoes(board, good));
assert.ok(connected.count > empty.count + 10, 'Placement must make a meaningful difference');
assert.ok((await run(placedDominoes(board, good.map((p) => ({ ...p, yaw: p.yaw + Math.PI / 2 }))))).count < connected.count, 'Contact orientation must matter');
assert.equal((await run(placedDominoes(makeDominoBoard(true), good.map((p) => ({ ...p, yaw: -p.yaw }))))).count, connected.count, 'Mirrored players must get equivalent physics');
for (const frame of [1 / 30, 1 / 144]) assert.equal((await run(placedDominoes(board, good), frame)).count, connected.count, 'Frame rate changed score');

// Exercise reachable, isolated, side-offset and edge-on placements with UI's 15° rotation steps.
const scores = new Set<number>();
const configurations = new Set<string>();
for (let trial = 0; trial < 40; trial++) {
  const placements: DominoPlacement[] = [];
  for (let i = 0; i < 3; i++) {
    const candidate = { slot: (trial * 7 + i * (3 + Math.floor(trial / 12))) % 12, yaw: ((trial * 5 + i * 2 + Math.floor(trial / 8)) % 12) * Math.PI / 12 };
    if (canPlaceDomino(board, placements, placements.length, candidate)) placements.push(candidate);
  }
  configurations.add(JSON.stringify(placements));
  const score = (await run(placedDominoes(board, placements))).count;
  scores.add(score);
  assert.equal((await run(placedDominoes(makeDominoBoard(true), placements.map((p) => ({ ...p, yaw: -p.yaw }))))).count, score, `Mirrored fairness failed for layout ${trial}`);
}
assert.ok(scores.size >= 5, 'Placement choices need more than binary success/failure');
assert.ok(configurations.size >= 32, 'Exercise distinct configurations, not repeated trials');
assert.deepEqual(rankDominoes([{ player: 0, fallen: 12, elapsedMs: 4000 }, { player: 1, fallen: 14, elapsedMs: 9000 }, { player: 2, fallen: 14, elapsedMs: 9000 }, { player: 3, fallen: 12, elapsedMs: 3000 }]).map((s) => [s.player, s.rank]), [[1, 1], [2, 1], [3, 3], [0, 4]]);
console.log(`Domino checks passed: straight / curved / grazing / non-contact / 40 layouts / mirrored fairness / frame rates / ranking. ${scores.size} distinct scores; baseline ${empty.count}, connected ${connected.count}.`);
