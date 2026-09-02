import assert from 'node:assert/strict';
import { DART_GAP_DEG, DART_STARTING_ANGLES, advanceDartAngle, canPlaceDart, dartAngleDistance, dartImpactAngle, dartMotionSpeed, rankDartResults } from '../app/dart-game.ts';

assert.equal(dartAngleDistance(355, 5), 10);
assert.equal(dartImpactAngle(190), 350);
assert.equal(canPlaceDart([0, 90], 45), true);
assert(DART_GAP_DEG > 8 && DART_GAP_DEG < 9, '히트박스는 보이는 다트 폭과 비슷해야 한다');
assert.equal(canPlaceDart([0], DART_GAP_DEG - .01), false);
assert.equal(canPlaceDart([0], DART_GAP_DEG + .01), true);
assert.equal(advanceDartAngle(358, 100, .04), 2);
assert(dartMotionSpeed(2, .62) > 250, '마지막 라운드에는 고속 구간이 있어야 한다');
assert(dartMotionSpeed(2, 1.75) < -180, '마지막 라운드에는 역회전이 있어야 한다');
assert(Math.abs(dartMotionSpeed(1, 5.8) - dartMotionSpeed(1, 0)) < .001, '회전 주기는 끊김 없이 이어져야 한다');
assert.deepEqual(DART_STARTING_ANGLES.map((angles) => angles.length), [3, 5, 7]);
for (const angles of DART_STARTING_ANGLES) {
  assert(angles.every((angle, index) => canPlaceDart(angles.filter((_, other) => other !== index), angle)), '초기 다트끼리는 겹치지 않아야 한다');
}

const ranked = rankDartResults([
  { player: 0, round: 0, hits: 4, misses: 1, duration: 7000 },
  { player: 0, round: 1, hits: 3, misses: 2, duration: 6000 },
  { player: 1, round: 0, hits: 3, misses: 2, duration: 4000 },
  { player: 1, round: 1, hits: 3, misses: 2, duration: 4000 },
], 2);
assert.deepEqual(ranked.map((entry) => entry.player), [0, 1]);
assert.equal(ranked[0].hits, 7);

console.log('dart checks passed: motion, collision, angle wrapping and ranking');
