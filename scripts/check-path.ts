import assert from 'node:assert/strict';
import { adjustedPathTime, makePathChallenges, pathProgress, pathTurnCost, rankPathResults, solvedPathDirections, solvePathChallenge, tracePath } from '../app/path-game.ts';

for (let seed = 1; seed <= 80; seed += 1) {
  const challenges = makePathChallenges(6, seed);
  assert.equal(challenges.length, 6);
  for (const challenge of challenges) {
    const solved = solvePathChallenge(challenge.directions, challenge.hazards, challenge.start, challenge.exitCell, challenge.exitDirection)!;
    assert(solved.rotations >= 4 && solved.rotations <= 6, 'every board needs four to six optimal turns');
    assert.equal(solved.rotations, challenge.optimalRotations);
    assert(solved.path.length >= 7 && solved.path.length <= 11);
    const directions = solvedPathDirections(challenge);
    assert.equal(tracePath(challenge, directions).success, true);
    const usedTurns = challenge.solution.reduce((sum, cell) => sum + pathTurnCost(challenge.directions[cell], directions[cell]), 0);
    assert.equal(usedTurns, challenge.optimalRotations);
  }
  assert.equal(new Set(challenges.map((challenge) => challenge.optimalRotations)).size, 1, 'transformed boards must have equal difficulty');
}

assert.equal(pathProgress([10, 11, 12, 7], [10, 11, 12, 13]), 2);
const ranked = rankPathResults([
  { player: 0, success: false, elapsed: 8, rotations: 5, optimalRotations: 5, progress: 4, pathLength: 8 },
  { player: 1, success: true, elapsed: 6.1, rotations: 7, optimalRotations: 5, progress: 8, pathLength: 8 },
  { player: 2, success: true, elapsed: 6.3, rotations: 5, optimalRotations: 5, progress: 8, pathLength: 8 },
]);
assert.deepEqual(ranked.map((result) => result.player), [2, 1, 0]);
assert(Math.abs(adjustedPathTime(ranked[1]) - 6.7) < 1e-9);

console.log('path game checks passed: verified difficulty, transformed fairness, routing and ranking');
