import assert from 'node:assert/strict';
import { LUNCH_FOODS, LUNCH_HEIGHT, LUNCH_LAYOUTS, LUNCH_PICK_COUNT, LUNCH_TURN_MS, LUNCH_WIDTH, isValidLunchPlacement, lunchResult, pickLunchFoods, pickLunchLayout, rankLunchResults } from '../app/lunch-game.ts';

assert.equal(LUNCH_FOODS.length, 20);
assert.equal(LUNCH_PICK_COUNT, 15);
assert.equal(LUNCH_LAYOUTS.length, 4);
assert.equal(LUNCH_TURN_MS, 25_000);
const smallestPossiblePool = [...LUNCH_FOODS].sort((a, b) => a.width * a.height - b.width * b.height).slice(0, LUNCH_PICK_COUNT);
assert(smallestPossiblePool.reduce((sum, food) => sum + food.width * food.height, 0) > LUNCH_WIDTH * LUNCH_HEIGHT);
const picked = pickLunchFoods(() => .42);
assert.equal(picked.length, LUNCH_PICK_COUNT);
assert.equal(new Set(picked.map((food) => food.id)).size, LUNCH_PICK_COUNT);
assert.equal(pickLunchLayout(() => .99), LUNCH_LAYOUTS.at(-1));
for (const layout of LUNCH_LAYOUTS) {
  for (const food of LUNCH_FOODS) {
    let fits = false;
    for (const rotated of [false, true]) {
      for (let y = 2; y < LUNCH_HEIGHT && !fits; y++) {
        for (let x = 2; x < LUNCH_WIDTH && !fits; x++) fits = isValidLunchPlacement({ id: food.id, x, y, rotated }, [], layout.dividers);
      }
    }
    assert(fits, `${food.name} must fit ${layout.name}`);
  }
}
assert(isValidLunchPlacement({ id: 'gimbap-a', x: 10, y: 10, rotated: false }, []));
assert(!isValidLunchPlacement({ id: 'gimbap-a', x: 190, y: 20, rotated: false }, []));
assert(!isValidLunchPlacement({ id: 'gimbap-b', x: 30, y: 30, rotated: false }, [{ id: 'gimbap-a', x: 10, y: 10, rotated: false }]));

const one = lunchResult(0, [{ id: 'gimbap-a', x: 10, y: 10, rotated: false }], 10_000);
const two = lunchResult(1, [{ id: 'egg', x: 10, y: 10, rotated: false }], 20_000);
assert(two.area > one.area);
assert.equal(one.score, Math.round(one.area / (LUNCH_WIDTH * LUNCH_HEIGHT) * 1000));
assert.deepEqual(rankLunchResults([one, two]).map((result) => result.player), [1, 0]);
assert.deepEqual(rankLunchResults([one, { ...one, player: 2, placed: 99, elapsedMs: 20_000 }]).map((result) => result.player), [0, 2]);

console.log('lunch packing checks passed: random layouts, oversized food pools, boundaries, overlap, scoring and ranking');
