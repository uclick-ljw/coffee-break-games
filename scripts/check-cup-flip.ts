import assert from 'node:assert/strict';
import {
  CUP_BOTTOM_WIDTH,
  CUP_TOP_WIDTH,
  FLIP_MAX_SECONDS,
  cupFlipOutcome,
  launchCupFromGesture,
  makeCupFlipState,
  stepCupFlip,
} from '../app/cup-flip-game.ts';

function simulate(dx: number, dy: number, duration: number, contact = 0) {
  const state = makeCupFlipState();
  assert.equal(launchCupFromGesture(state, dx, dy, duration, contact), true);
  let result = cupFlipOutcome(state);
  while (!result) {
    stepCupFlip(state, 1 / 240);
    result = cupFlipOutcome(state);
  }
  return { state, result };
}

assert.ok(CUP_TOP_WIDTH > CUP_BOTTOM_WIDTH, '컵은 윗부분이 바닥보다 넓어야 합니다.');
assert.equal(launchCupFromGesture(makeCupFlipState(), 0, -30, 0.2), false, '짧은 터치는 발사로 처리하지 않아야 합니다.');

const trials = [];
for (let upward = 70; upward <= 185; upward += 5) {
  for (let duration = 0.14; duration <= 0.38; duration += 0.02) {
    trials.push(simulate(0, -upward, duration));
  }
}
const success = trials.find(({ result }) => result.upright);
assert.ok(success, '적절하게 위로 튕기면 실제로 컵을 세울 수 있어야 합니다.');
const successRate = trials.filter(({ result }) => result.upright).length / trials.length;
assert.ok(successRate >= 0.05 && successRate <= 0.25, '성공 구간은 찾을 수 있지만 너무 넓지는 않아야 합니다.');
assert.ok(success.result.score >= 600);
assert.ok(success.result.rotations >= 0.7 && success.result.rotations <= 1.4, '한 바퀴 안팎의 회전이 성공 범위여야 합니다.');
assert.ok(success.state.elapsed < FLIP_MAX_SECONDS);

const weak = simulate(0, -55, 0.45);
assert.equal(weak.result.upright, false, '너무 약하게 밀면 성공하면 안 됩니다.');
assert.ok(weak.result.score < success.result.score);
const sideways = simulate(180, -105, 0.18);
assert.equal(sideways.result.upright, false, '옆으로 과하게 밀면 테이블에서 벗어나야 합니다.');

console.log('컵 플립의 제스처, 중력, 회전 관성, 테이블 충돌과 착지 판정 검사 통과');
