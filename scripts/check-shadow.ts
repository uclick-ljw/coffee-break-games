import assert from 'node:assert/strict';
import { buildShadowFaces, makeShadowChallenges, rankShadowResults, SHADOW_MODELS, shadowSimilarity } from '../app/shadow-game.ts';

assert.equal(SHADOW_MODELS.length, 6);
for (const model of SHADOW_MODELS) {
  assert(model.boxes.length >= 4);
  assert.equal(buildShadowFaces(model, .4, -.2).length, model.boxes.length * 6);
  assert.equal(shadowSimilarity(model, .7, -.35, .7, -.35), 1000, `${model.name} must perfectly match itself`);
}

const challenges = makeShadowChallenges(6, 20260831);
assert.equal(new Set(challenges.map((challenge) => challenge.model.id)).size, 1, 'all players need the same sculpture for fairness');
for (const challenge of challenges) {
  const startScore = shadowSimilarity(challenge.model, challenge.targetYaw, challenge.targetPitch, challenge.startYaw, challenge.startPitch);
  assert(startScore < 850, 'the starting angle must need a meaningful rotation');
}

const ranked = rankShadowResults([
  { player: 0, modelName: 'test', score: 620, elapsed: 4, yaw: 0, pitch: 0 },
  { player: 1, modelName: 'test', score: 910, elapsed: 7, yaw: 0, pitch: 0 },
]);
assert.deepEqual(ranked.map((result) => result.player), [1, 0]);

console.log('shadow thief checks passed: six 3D sculptures, fair rounds, silhouette scoring');
