import assert from 'node:assert/strict';
import { formatTiming, makeTimingTarget, rankTimingResults, scoreTimingAttempt } from '../app/timing-game.ts';

assert.equal(makeTimingTarget(() => 0), 2500);
assert.equal(makeTimingTarget(() => 0.999999), 5000);
assert.equal(makeTimingTarget(() => 0.5), 3750);
assert.equal(formatTiming(3756), '3.76');

const results = [
  scoreTimingAttempt(0, 3800, 4000),
  scoreTimingAttempt(1, 4010, 4000),
  scoreTimingAttempt(2, 4500, 4000),
];
assert.deepEqual(rankTimingResults(results).map((result) => result.player), [1, 0, 2]);
assert.equal(rankTimingResults(results).at(-1)?.error, 500);
console.log('timing checks passed');
