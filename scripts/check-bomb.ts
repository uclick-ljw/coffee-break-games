import assert from 'node:assert/strict';
import { BOMB_MAX, BOMB_MIN, makeBombRound, playableBounds, resolveBombPick } from '../app/bomb-game.ts';

const round = makeBombRound(6, 20260901);
assert(round.bomb >= BOMB_MIN && round.bomb <= BOMB_MAX);
assert(round.starter >= 0 && round.starter < 6);
assert.deepEqual(playableBounds(1, 100), { low: 21, high: 80 });
assert.deepEqual(playableBounds(44, 48), { low: 44, high: 48 });
assert.throws(() => resolveBombPick({ bomb: 67, low: 1, high: 100 }, 1), RangeError);
assert.deepEqual(resolveBombPick({ bomb: 67, low: 1, high: 100 }, 50), { hit: false, direction: 'UP', low: 51, high: 100 });
assert.deepEqual(resolveBombPick({ bomb: 67, low: 51, high: 80 }, 70), { hit: false, direction: 'DOWN', low: 51, high: 69 });
assert.equal(resolveBombPick({ bomb: 67, low: 65, high: 69 }, 67).hit, true);

for (let bomb = BOMB_MIN; bomb <= BOMB_MAX; bomb++) {
  let low = BOMB_MIN;
  let high = BOMB_MAX;
  for (let turn = 0; turn < 40; turn++) {
    const playable = playableBounds(low, high);
    const choice = bomb <= playable.low ? playable.low : bomb >= playable.high ? playable.high : bomb;
    const result = resolveBombPick({ bomb, low, high }, choice);
    if (result.hit) break;
    ({ low, high } = result);
    assert(turn < 39, `bomb ${bomb} did not terminate`);
  }
}

console.log('bomb checks passed: seeded round, playable band, range narrowing and termination');
