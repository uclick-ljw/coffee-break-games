import assert from 'node:assert/strict';
import { PATH_HEAD_START_SECONDS, PATH_STEP_MS, PATH_TURN_SECONDS, adjustedPathTime, makePathChallenges, pathProgress, pathTurnCost, rankPathResults, solvedPathDirections, solvePathChallenge, tracePath } from '../app/path-game.ts';

assert.equal(PATH_HEAD_START_SECONDS, 5);
assert.equal(PATH_TURN_SECONDS, 13);
assert.equal(PATH_STEP_MS, 600);

for (let seed = 1; seed <= 80; seed += 1) {
  const challenges = makePathChallenges(6, seed);
  assert.equal(challenges.length, 6);
  for (const challenge of challenges) {
    const solved = solvePathChallenge(challenge.directions, challenge.hazards, challenge.start, challenge.exitCell)!;
    assert(solved.rotations >= 3 && solved.rotations <= 4, 'every board needs three to four optimal turns');
    assert.equal(solved.rotations, challenge.optimalRotations);
    assert(solved.path.length >= 6 && solved.path.length <= 9);
    assert.equal(challenge.hazards.length, 4);
    const directions = solvedPathDirections(challenge);
    assert.equal(tracePath(challenge, directions).success, true);
    const usedTurns = challenge.solution.slice(0, -1).reduce((sum, cell) => sum + pathTurnCost(challenge.directions[cell], directions[cell]), 0);
    assert.equal(usedTurns, challenge.optimalRotations);
    directions[challenge.exitCell] = (directions[challenge.exitCell] + 1) % 4 as 0 | 1 | 2 | 3;
    assert.equal(tracePath(challenge, directions).success, true, 'the exit succeeds without an arrow direction');
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

const guardBoard = makePathChallenges(2, 991)[0];
const guardDirections = [...guardBoard.directions];
const guard = guardBoard.hazards[0];
const guardRow = Math.floor(guard / 5);
const guardColumn = guard % 5;
const neighbor = [[guardRow - 1, guardColumn, 2], [guardRow, guardColumn + 1, 3], [guardRow + 1, guardColumn, 0], [guardRow, guardColumn - 1, 1]]
  .find(([row, column]) => row >= 0 && row < 5 && column >= 0 && column < 5 && !guardBoard.hazards.includes(row * 5 + column))!;
guardBoard.start = neighbor[0] * 5 + neighbor[1];
guardDirections[guardBoard.start] = neighbor[2] as 0 | 1 | 2 | 3;
assert.equal(tracePath(guardBoard, guardDirections).failure, 'guard');

console.log('path game checks passed: verified difficulty, transformed fairness, routing and ranking');
