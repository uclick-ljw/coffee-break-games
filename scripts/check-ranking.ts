import assert from 'node:assert/strict';
import { rankResults, lastPlace } from '../app/ranking.ts';
import { rankTimingResults, scoreTimingAttempt, formatTiming } from '../app/timing-game.ts';
import { rankCurves, scoreCurve, curveTemplate } from '../app/circle-game.ts';
import { rankSlices } from '../app/slice-game.ts';
import { rankShadowResults } from '../app/shadow-game.ts';
import { rankLunchResults, lunchResult } from '../app/lunch-game.ts';
import { rankCupResults } from '../app/cup-game.ts';
import { rankDartResults } from '../app/dart-game.ts';
import { makeCenterChallenges, scoreCenterGuess, rankCenterPlayers } from '../app/center-game.ts';
import { makeMeasureResult, rankMeasureResults } from '../app/measure-game.ts';
import { rankPathResults } from '../app/path-game.ts';

assert.deepEqual(rankResults([], () => 0), []);
assert.deepEqual(lastPlace([]), []);
const input = [{ player: 0, score: 10 }, { player: 1, score: 20 }, { player: 2, score: 10 }];
const ordered = rankResults(input, (a, b) => b.score - a.score);
assert.deepEqual(ordered.map((r) => [r.player, r.rank]), [[1, 1], [0, 2], [2, 2]]);
assert.deepEqual(input.map((r) => r.player), [0, 1, 2], 'ranking must not mutate turn order');
assert.deepEqual(lastPlace(ordered).map((r) => r.player), [0, 2]);
assert.deepEqual(rankResults([10, 20, 20, 5].map((score) => ({ score })), (a, b) => b.score - a.score).map((r) => r.rank), [1, 1, 3, 4]);

const challenge = makeCenterChallenges(2, 127)[0][0];
for (let count = 2; count <= 6; count++) {
  const ids = Array.from({ length: count }, (_, i) => count - 1 - i);
  const sameRank = (results: { player: number; rank: number }[]) => {
    assert.equal(results.length, count);
    assert(results.every((r) => r.rank === 1), 'identical records must all share first place');
    assert.equal(lastPlace(results).length, count, 'no arbitrary single payer on a tie');
  };
  sameRank(rankResults(ids.map((player) => ({ player, score: 0 })), (a, b) => b.score - a.score)); // landing and parking
  sameRank(rankResults(ids.map((player) => ({ player, milliseconds: 20_000 })), (a, b) => Math.round(b.milliseconds / 10) - Math.round(a.milliseconds / 10)));
  sameRank(rankTimingResults(ids.map((player) => scoreTimingAttempt(player, 9990, 3250))));
  sameRank(rankCurves(ids.map((player) => scoreCurve(player, 'circle', curveTemplate('circle', 121)))));
  sameRank(rankSlices(ids.map((player) => ({ player, shapeId: 'pear', shapeName: '배', score: 900, left: 45, right: 55, error: 5, start: { x: 0, y: .5 }, end: { x: 1, y: .5 } }))));
  sameRank(rankShadowResults(ids.map((player) => ({ player, modelName: 'test', score: 500, elapsed: 8, yaw: 0, pitch: 0 }))));
  sameRank(rankLunchResults(ids.map((player) => lunchResult(player, [], 25_000))));
  sameRank(rankCupResults(ids.map((player) => ({ player, score: 0, correct: 0, decisionMs: 500 + player * 200 }))));
  sameRank(rankDartResults(ids.map((player) => ({ player, round: 0, hits: 3, misses: 0, duration: 1000 })), count));
  sameRank(rankCenterPlayers(ids.map((player) => scoreCenterGuess(player, 0, challenge, challenge.center)), count));
  sameRank(rankMeasureResults(ids.map((player) => makeMeasureResult(player, 0, .5, .4)), count));
  sameRank(rankPathResults(ids.map((player) => ({ player, success: false, elapsed: 3 + player, rotations: player, optimalRotations: 3, progress: 50, remainingSteps: 2 }))));
}

const a = scoreTimingAttempt(0, 3981, 4000), b = scoreTimingAttempt(1, 4019, 4000);
assert.equal(formatTiming(a.error), formatTiming(b.error));
assert.deepEqual(rankTimingResults([a, b]).map((r) => r.rank), [1, 1], 'equidistant early/late stops tie');
assert.deepEqual(rankTimingResults([scoreTimingAttempt(0, 3981, 4000), scoreTimingAttempt(1, 3984, 4000)]).map((r) => r.rank), [1, 1], 'hidden milliseconds must not decide a displayed tie');
assert.deepEqual(rankCupResults([{ player: 0, correct: 1, score: 120, decisionMs: 1600 }, { player: 1, correct: 1, score: 120, decisionMs: 1100 }]).map((r) => r.player), [1, 0], 'declared non-tied speed criteria still apply');
assert.deepEqual(rankLunchResults([lunchResult(0, [], 5000), lunchResult(1, [], 5100)]).map((r) => r.rank), [1, 2]);
console.log('ranking regression checks passed: 2–6 players, exact/visible ties, shared last place, no mutation and normal winners');
