import assert from 'node:assert/strict';
import { makeMeasureResult, makeMeasureTargets, makeWaterDrop, measureScore, pourRate, pourStep, rankMeasureResults, settleFlow, stepWaterDrop, waterDropLanded, waterImpact, waterLevel, waterSurfaceY } from '../app/measure-game.ts';

const targets = makeMeasureTargets(6, 20260901);
assert.equal(targets.length, 3);
assert(targets.every((round) => round.length === 6 && round.every((target) => target >= .34 && target <= .72)));
assert.deepEqual(targets, makeMeasureTargets(6, 20260901));

assert.equal(waterLevel('tall', .5), .5);
assert(waterLevel('bowl', .5) > .5);
assert(waterLevel('carafe', .5) < .5);
assert(pourRate(2, 2) > pourRate(0, 0));
assert.equal(pourStep(.4, .2, .5), .5);
assert(settleFlow(.3, .5, 0) < .3);
assert(settleFlow(.3, .5, 2) > settleFlow(.3, .5, 0), '카라페의 잔류 물줄기가 더 오래가야 한다');
assert(waterSurfaceY('tall', .15) > waterSurfaceY('tall', .8), '수위가 낮으면 물방울이 더 깊게 떨어져야 한다');
assert(waterImpact('tall', .15) > waterImpact('tall', .8), '수위가 낮으면 충돌 효과가 더 커야 한다');
for (const vessel of ['tall', 'bowl', 'carafe'] as const) {
  let drop = makeWaterDrop(vessel, .004);
  let landed = false;
  for (let frame = 0; frame < 50; frame += 1) {
    const next = stepWaterDrop(vessel, drop, .035);
    if (waterDropLanded(vessel, next, .15)) { landed = true; break; }
    drop = next;
  }
  assert(landed, `${vessel} 물방울이 현재 수면에 떨어져야 한다`);
}
assert.equal(measureScore(.5, .5), 100);
assert.equal(measureScore(.5, .6), 78);

const ranked = rankMeasureResults([
  makeMeasureResult(0, 0, .5, .55), makeMeasureResult(0, 1, .5, .55), makeMeasureResult(0, 2, .5, .55),
  makeMeasureResult(1, 0, .5, .7), makeMeasureResult(1, 1, .5, .7), makeMeasureResult(1, 2, .5, .7),
], 2);
assert.deepEqual(ranked.map((entry) => entry.player), [0, 1]);
assert.equal(ranked[0].score, 267);
assert.equal(ranked[1].score, 168);

console.log('measure checks passed: vessels, accelerating pour, residual stream, scoring and ranking');
