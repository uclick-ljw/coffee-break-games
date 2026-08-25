import assert from 'node:assert/strict';
import { BOARD_CONFIGS, canPlacePeg, FIXED_PEGS, LAUNCHER, makeHoles, makePlacementOrder, shuffledScores, stepBall, type BallState, type Peg } from '../app/peg-game.ts';

for (let players = 2; players <= 6; players += 1) {
  const config = BOARD_CONFIGS[players];
  const holes = makeHoles(players);
  const order = makePlacementOrder(players);
  assert.equal(holes.length, config.cols * config.rows);
  assert.equal(order.length, config.pegs);
  assert.deepEqual([...new Set(order)].sort(), Array.from({ length: players }, (_, index) => index));
  assert.ok(order.every((player) => order.filter((item) => item === player).length === 5));
}

assert.deepEqual([...shuffledScores(42)].sort((a, b) => a - b), [10, 10, 30, 30, 50, 50, 100]);

const firstRow = makeHoles(2).filter((hole) => hole.row === 0);
const crowdedRow = firstRow.slice(0, 3).map((hole) => ({ ...hole, owner: 0 } satisfies Peg));
assert.ok(canPlacePeg(crowdedRow, firstRow[3]), '한 줄의 마지막 빈칸에도 돌기를 놓을 수 있어야 합니다.');

let weak: BallState = { ...LAUNCHER, vx: 0, vy: -580, age: 0, stage: 'lane', guide: 0, bias: 0 };
let misfire = false;
for (let step = 0; step < 500 && !misfire; step += 1) {
  const result = stepBall(weak, FIXED_PEGS, 1 / 120);
  weak = result.ball;
  misfire = result.misfire;
}
assert.ok(misfire, '약한 발사는 점수칸으로 우회하지 않고 발사 통로로 돌아와야 합니다.');

let ball: BallState = { ...LAUNCHER, vx: 0, vy: -820, age: 0, stage: 'lane', guide: 0, bias: 0 };
let settled = false;
let enteredField = false;
for (let step = 0; step < 700 && !settled; step += 1) {
  const result = stepBall(ball, FIXED_PEGS, 1 / 120);
  ball = result.ball;
  enteredField ||= ball.stage === 'field';
  settled = result.settled;
}
assert.ok(enteredField, '정상 발사는 상단 곡선 통로를 거쳐 중앙 게임판에 들어와야 합니다.');
assert.ok(settled, '구슬은 제한 시간 안에 점수칸에 멈춰야 합니다.');
console.log('peg game checks passed');
