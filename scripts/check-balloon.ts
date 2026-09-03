import assert from 'node:assert/strict';
import { BALLOON_HOLD_MS, BALLOON_MAX_THRESHOLD, BALLOON_MIN_THRESHOLD, BALLOON_START_LEVEL, balloonTurnBounds, balloonTurnGrowth, makeBalloonThreshold, pickBalloonStarter } from '../app/balloon-game.ts';

assert.equal(makeBalloonThreshold(0), BALLOON_MIN_THRESHOLD);
assert.equal(makeBalloonThreshold(1), BALLOON_MAX_THRESHOLD);
for (const players of [2, 3, 4, 5, 6]) {
  const bounds = balloonTurnBounds(players);
  assert(BALLOON_START_LEVEL + bounds.max * players < BALLOON_MIN_THRESHOLD, `${players}명 첫 바퀴는 안전해야 한다`);
  assert.equal(balloonTurnGrowth(players, BALLOON_HOLD_MS), bounds.max);
  assert(balloonTurnGrowth(players, 180) >= bounds.min);
}
assert.equal(pickBalloonStarter(6, 0), 0);
assert.equal(pickBalloonStarter(6, 1), 5);
assert.equal(pickBalloonStarter(3, .5), 1);

console.log('balloon checks passed: random threshold and starter, safe first lap, scaled growth');
