import assert from 'node:assert/strict';
import {
  DODGE_ANIMALS,
  DODGE_HEIGHT,
  DODGE_FIRST_SPAWN,
  DODGE_MAX_SECONDS,
  DODGE_PLAYER_RADIUS,
  DODGE_WIDTH,
  advanceDodgeObstacle,
  assignDodgeAnimals,
  clampDodgePosition,
  dodgeDifficulty,
  dodgeObstacleHits,
  makeDodgeObstacle,
} from '../app/dodge-game.ts';

for (let players = 2; players <= 6; players += 1) {
  const assigned = assignDodgeAnimals(players, 4200 + players);
  assert.equal(assigned.length, players);
  assert.equal(new Set(assigned.map((animal) => animal.id)).size, players, '한 판 안에서는 동물이 겹치면 안 됩니다.');
  assert.ok(assigned.every((animal) => DODGE_ANIMALS.includes(animal)));
}
assert.deepEqual(assignDodgeAnimals(6, 77), assignDodgeAnimals(6, 77), '같은 판은 같은 동물 순서여야 합니다.');

const start = dodgeDifficulty(0);
const middle = dodgeDifficulty(8);
const end = dodgeDifficulty(DODGE_MAX_SECONDS);
assert.ok(start.speed < middle.speed && middle.speed < end.speed, '시간이 갈수록 장애물이 빨라야 합니다.');
assert.ok(start.spawnInterval > middle.spawnInterval && middle.spawnInterval > end.spawnInterval, '시간이 갈수록 장애물이 자주 나와야 합니다.');
assert.ok(end.warningSeconds >= 0.34, '가장 어려울 때도 예고 시간이 있어야 합니다.');
assert.ok(dodgeDifficulty(10).speed > 220, '10초부터는 속도가 한 번 더 가파르게 올라야 합니다.');
assert.ok(dodgeDifficulty(10).spawnInterval < 0.4, '10초에는 장애물이 빠르게 겹쳐야 합니다.');

assert.deepEqual(clampDodgePosition(-20, 999), { x: 28, y: DODGE_HEIGHT - 28 });
assert.deepEqual(clampDodgePosition(999, -20), { x: DODGE_WIDTH - 28, y: 34 });

const first = makeDodgeObstacle(3, 4, 1234);
assert.deepEqual(first, makeDodgeObstacle(3, 4, 1234), '모든 참가자는 같은 장애물 순서를 받아야 합니다.');
assert.ok(first.activeAt > 4, '장애물은 나타나기 전에 반드시 경고해야 합니다.');
const before = { x: first.x, y: first.y };
advanceDodgeObstacle(first, 0.1);
assert.notDeepEqual({ x: first.x, y: first.y }, before);
assert.equal(makeDodgeObstacle(3, 5, 1234).kind, 'block', '중반부터는 다른 모양의 장애물도 섞여야 합니다.');

let spawnAt = DODGE_FIRST_SPAWN;
let spawnCount = 0;
while (spawnAt < DODGE_MAX_SECONDS) {
  spawnCount += 1;
  spawnAt += dodgeDifficulty(spawnAt).spawnInterval;
}
assert.ok(spawnCount >= 45, '후반에는 피하기 어려울 만큼 장애물이 충분히 늘어나야 합니다.');

assert.equal(dodgeObstacleHits({
  id: 1, kind: 'ball', x: 100, y: 100, vx: 0, vy: 0, radius: 18, width: 0, height: 0, activeAt: 0, color: '#fff',
}, 100 + 18 + DODGE_PLAYER_RADIUS - 1, 100), true);
assert.equal(dodgeObstacleHits({
  id: 2, kind: 'block', x: 100, y: 100, vx: 0, vy: 0, radius: 0, width: 60, height: 18, activeAt: 0, color: '#fff',
}, 100, 100 + 9 + DODGE_PLAYER_RADIUS - 1), true);

console.log('말랑말랑 대탈출의 동물 배정, 난이도, 이동과 충돌 검사 통과');
