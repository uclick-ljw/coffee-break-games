import assert from 'node:assert/strict';
import { buildCenterFaces, CENTER_ASYMMETRIC_IDS, CENTER_ROUNDS, CENTER_SHAPE_COUNT, CENTER_SURFACE_RINGS, CENTER_SURFACE_SEGMENTS, isCenterHit, makeCenterChallenges, polygonCenter, projectCenterPoint, projectMassCenter, rankCenterPlayers, scoreCenterGuess } from '../app/center-game.ts';

const triangle = polygonCenter([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]);
assert(Math.abs(triangle.x - 1 / 3) < 1e-9);
assert(Math.abs(triangle.y - 1 / 3) < 1e-9);

const challenges = makeCenterChallenges(6, 20260901);
assert.equal(challenges.length, 6);
assert(challenges.every((player) => player.length === CENTER_ROUNDS));
assert.equal(challenges[0].filter((challenge) => CENTER_ASYMMETRIC_IDS.has(challenge.id)).length, 2);
for (let round = 0; round < CENTER_ROUNDS; round++) {
  assert.equal(new Set(challenges.map((player) => player[round].id)).size, 1);
  assert.equal(new Set(challenges.map((player) => player[round].targetYaw)).size, 1);
  assert.equal(new Set(challenges.map((player) => player[round].targetPitch)).size, 1);
}
assert(challenges.flat().every((challenge) => isCenterHit(challenge, challenge.center)));
assert(challenges.flat().every((challenge) => challenge.points.length === CENTER_SURFACE_SEGMENTS));
assert(challenges.flat().every((challenge) => buildCenterFaces(challenge).length === CENTER_SURFACE_SEGMENTS * CENTER_SURFACE_RINGS));
assert(challenges[0].every((challenge) => {
  const geometricCenter = projectCenterPoint(polygonCenter(challenge.points), 0, challenge.targetYaw, challenge.targetPitch);
  return Math.hypot(challenge.center.x - geometricCenter.x, challenge.center.y - geometricCenter.y) > .025;
}));

const exact = scoreCenterGuess(0, 0, challenges[0][0], challenges[0][0].center);
const rotatedChallenge = { ...challenges[0][0], targetYaw: challenges[0][0].targetYaw + .82 };
rotatedChallenge.center = projectMassCenter(rotatedChallenge);
assert(isCenterHit(rotatedChallenge, rotatedChallenge.center));
assert.equal(scoreCenterGuess(0, 0, rotatedChallenge, rotatedChallenge.center).score, 100);
const miss = scoreCenterGuess(1, 0, challenges[1][0], { x: 0, y: 0 });
assert.equal(exact.score, 100);
assert(exact.error < miss.error);
assert.deepEqual(rankCenterPlayers([miss, exact], 2).map((result) => result.player), [0, 1]);

const seen = new Set<string>();
for (let seed = 1; seed <= 80; seed++) {
  const rounds = makeCenterChallenges(2, seed)[0];
  assert.equal(rounds.filter((challenge) => CENTER_ASYMMETRIC_IDS.has(challenge.id)).length, 2);
  rounds.forEach((challenge) => {
    seen.add(challenge.id);
    assert(isCenterHit(challenge, challenge.center));
    assert.equal(buildCenterFaces(challenge).length, CENTER_SURFACE_SEGMENTS * CENTER_SURFACE_RINGS);
  });
}
assert.equal(seen.size, CENTER_SHAPE_COUNT);

console.log('center 3D checks passed: centroid, shared view, smooth closed mesh, hit testing, scoring and ranking');
