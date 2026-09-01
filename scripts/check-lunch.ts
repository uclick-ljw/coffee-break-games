import assert from 'node:assert/strict';
import { LUNCH_FOODS, LUNCH_TURN_MS, isValidLunchPlacement, lunchResult, rankLunchResults } from '../app/lunch-game.ts';

assert.equal(LUNCH_FOODS.length, 11);
assert.equal(LUNCH_TURN_MS, 25_000);
assert(isValidLunchPlacement({ id: 'gimbap-a', x: 10, y: 10, rotated: false }, []));
assert(!isValidLunchPlacement({ id: 'gimbap-a', x: 190, y: 20, rotated: false }, []));
assert(!isValidLunchPlacement({ id: 'gimbap-b', x: 30, y: 30, rotated: false }, [{ id: 'gimbap-a', x: 10, y: 10, rotated: false }]));

const one = lunchResult(0, [{ id: 'gimbap-a', x: 10, y: 10, rotated: false }], 10_000);
const two = lunchResult(1, [{ id: 'egg', x: 10, y: 10, rotated: false }], 20_000);
assert(two.area > one.area);
assert.deepEqual(rankLunchResults([one, two]).map((result) => result.player), [1, 0]);

console.log('lunch packing checks passed: boundaries, dividers, overlap, scoring and ranking');
