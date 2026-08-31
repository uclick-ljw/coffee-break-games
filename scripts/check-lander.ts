import assert from 'node:assert/strict';
import {
  LANDER_GROUND_Y,
  LANDER_MAX_SECONDS,
  LANDER_PAD_WIDTH,
  LANDER_START_FUEL,
  landerOutcome,
  makeLanderState,
  makeLandingPad,
  stepLander,
} from '../app/lander-game.ts';

for (let seed = 1; seed <= 30; seed += 1) {
  const pad = makeLandingPad(seed);
  assert.ok(pad >= 112 && pad <= 278, '착륙장은 화면 안쪽에 있어야 합니다.');
}

const falling = makeLanderState();
while (!landerOutcome(falling, makeLandingPad(9))) stepLander(falling, { thrusting: false, direction: 0 }, 1 / 120, 9);
assert.ok(falling.elapsed < 4, '조작하지 않으면 빠르게 추락해야 합니다.');
assert.equal(landerOutcome(falling, makeLandingPad(9))?.success, false);

const pad = makeLandingPad(17);
const guided = makeLanderState();
let result = landerOutcome(guided, pad);
while (!result) {
  const altitude = LANDER_GROUND_Y - 29 - guided.y;
  const targetSpeed = altitude > 200 ? 74 : altitude > 90 ? 48 : 27;
  const direction = Math.max(-1, Math.min(1, (pad - guided.x) * 0.025 - guided.vx * 0.022));
  stepLander(guided, { thrusting: guided.vy > targetSpeed, direction }, 1 / 120, 17);
  result = landerOutcome(guided, pad);
}
assert.equal(result.success, true, '연료를 조절하면 실제로 안전 착륙할 수 있어야 합니다.');
assert.ok(result.score >= 500);
assert.ok(guided.fuel > 0 && guided.fuel < LANDER_START_FUEL);
assert.ok(guided.elapsed < LANDER_MAX_SECONDS);

const hardLanding = { ...makeLanderState(), x: pad, y: LANDER_GROUND_Y - 28, vy: 90, vx: 0, elapsed: 3 };
const crash = landerOutcome(hardLanding, pad);
assert.equal(crash?.success, false, '착륙장에 닿아도 너무 빠르면 충돌해야 합니다.');
assert.ok((crash?.score ?? 0) < result.score);
assert.ok(LANDER_PAD_WIDTH >= 100, '모바일에서 착륙장이 지나치게 좁으면 안 됩니다.');

console.log('아슬아슬 착륙의 중력, 연료, 조종, 안전 착륙과 충돌 검사 통과');
