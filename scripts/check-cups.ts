import assert from 'node:assert/strict';
import { CUP_ROUNDS, cupRoundScore, finalCupSlot, makeCupChallenges, rankCupResults } from '../app/cup-game.ts';

assert.equal(CUP_ROUNDS, 2);
for (let seed = 1; seed <= 100; seed += 1) {
  const games = makeCupChallenges(6, seed);
  assert.equal(games.length, 6);
  for (const rounds of games) {
    assert.equal(rounds.length, CUP_ROUNDS);
    rounds.forEach((challenge, level) => {
      assert.equal(challenge.cupCount, level === 0 ? 3 : 4);
      assert.equal(challenge.swaps.length, level === 0 ? 5 : 7);
      assert.notEqual(finalCupSlot(challenge), challenge.targetCup);
      assert(challenge.swaps.every(([a, b]) => a !== b && a >= 0 && b < challenge.cupCount));
    });
  }
}

assert(cupRoundScore(true, 500, 1) > cupRoundScore(true, 2500, 1));
assert.equal(cupRoundScore(false, 100, 1), 0);
const ranked = rankCupResults([
  { player: 0, score: 220, correct: 2, decisionMs: 2000 },
  { player: 1, score: 999, correct: 1, decisionMs: 800 },
  { player: 2, score: 220, correct: 2, decisionMs: 1800 },
]);
assert.deepEqual(ranked.map((result) => result.player), [2, 0, 1]);

console.log('cup shuffle checks passed: fair rounds, moving target, scoring and ranking');
