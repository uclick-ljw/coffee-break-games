import assert from 'node:assert/strict';
import { createTower, losingPlayer, removePin, stepTower, towerCounts, towerSettled } from '../app/tower.ts';

for (let players = 2; players <= 6; players += 1) {
  for (let seed = 1; seed <= 16; seed += 1) {
    const tower = createTower(players, seed);
    const counts = towerCounts(players);
    assert.equal(tower.pins.length, counts.pins);
    assert.equal(tower.balls.length, counts.balls);
    assert.equal(tower.balls.filter((ball) => ball.fallen).length, 0, '시작 전에 구슬이 떨어지면 안 됩니다.');

    const fallen = new Set<number>();
    const scores = Array(players).fill(0) as number[];
    const lastDrop = Array(players).fill(-1) as number[];
    const order = [...tower.pins].sort((a, b) => ((a.id * 17 + seed * 13) % counts.pins) - ((b.id * 17 + seed * 13) % counts.pins));
    for (let turn = 0; turn < order.length; turn += 1) {
      assert.ok(removePin(tower, order[turn].id));
      let stable = 0;
      for (let frame = 0; frame < 3000 && stable < 30; frame += 1) {
        const dropped = stepTower(tower, 1 / 120);
        for (const id of dropped) {
          assert.ok(!fallen.has(id), '구슬을 두 번 집계하면 안 됩니다.');
          fallen.add(id);
          scores[turn % players] += 1;
          lastDrop[turn % players] = turn;
        }
        stable = towerSettled(tower) ? stable + 1 : 0;
      }
    }
    assert.equal(fallen.size, counts.balls, '막대를 모두 빼면 모든 구슬이 떨어져야 합니다.');
    assert.equal(scores.reduce((sum, score) => sum + score, 0), counts.balls);
    assert.equal(scores[losingPlayer(scores, lastDrop)], Math.max(...scores));
  }
  console.log(`${players}인 구슬 타워 검사 통과`);
}
