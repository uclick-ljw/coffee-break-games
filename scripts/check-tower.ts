import assert from 'node:assert/strict';
import {
  BALL_RADIUS,
  BALL_RADIUS_PX,
  createTower,
  FACE_LABELS,
  losingPlayer,
  PIN_RADIUS,
  PIN_WIDTH_PX,
  PIXELS_PER_UNIT,
  projectPoint,
  towerCounts,
  TOWER_RADIUS,
  type Face,
} from '../app/tower.ts';

function waitUntilSettled(tower: Awaited<ReturnType<typeof createTower>>) {
  let stable = 0;
  const dropped: number[] = [];
  for (let frame = 0; frame < 3000 && stable < 45; frame += 1) {
    dropped.push(...tower.step(1 / 120));
    stable = tower.settled() ? stable + 1 : 0;
  }
  assert.equal(stable, 45, '막대를 뺀 뒤 물리가 안정되어야 합니다.');
  return dropped;
}

assert.equal(BALL_RADIUS_PX, BALL_RADIUS * PIXELS_PER_UNIT, '구슬의 화면 크기와 충돌 크기가 같아야 합니다.');
assert.equal(PIN_WIDTH_PX, PIN_RADIUS * 2 * PIXELS_PER_UNIT, '막대의 화면 굵기와 충돌 굵기가 같아야 합니다.');
assert.ok(
  projectPoint({ x: 0, y: 1, z: 1 }, 0).y < projectPoint({ x: 0, y: 1, z: -1 }, 0).y,
  '위쪽 시점에서는 멀리 있는 물체가 화면에서 더 위에 보여야 합니다.',
);

for (let players = 2; players <= 6; players += 1) {
  for (const seed of [17, 31021, 90210]) {
    const tower = await createTower(players, seed + players * 101);
    const counts = towerCounts(players);
    assert.equal(tower.pins.length, counts.pins);
    assert.equal(tower.balls.length, counts.balls);
    assert.equal(tower.balls.filter((ball) => ball.fallen).length, 0, '시작 전에 구슬이 떨어지면 안 됩니다.');
    assert.ok(tower.settled(), '게임 시작 시 구슬이 안정되어 있어야 합니다.');

    for (let face = 0; face < FACE_LABELS.length; face += 1) {
      const facePins = tower.pins.filter((pin) => pin.face === face);
      assert.ok(facePins.length >= Math.floor(counts.pins / 4), `${FACE_LABELS[face]} 막대가 부족합니다.`);
      for (const pin of facePins) {
        const radius = Math.hypot(pin.entry.x, pin.entry.z);
        assert.ok(radius > TOWER_RADIUS, '막대 손잡이는 원통 밖에 있어야 합니다.');
        if (face === 0) assert.ok(pin.entry.z < 0);
        if (face === 1) assert.ok(pin.entry.x > 0);
        if (face === 2) assert.ok(pin.entry.z > 0);
        if (face === 3) assert.ok(pin.entry.x < 0);
        assert.ok(Math.abs(Math.hypot(pin.axis.x, pin.axis.y, pin.axis.z) - 1) < 1e-6);
      }
    }

    const angles = new Set(tower.pins.map((pin) => Math.round(Math.atan2(pin.axis.z, pin.axis.x) * 10)));
    assert.ok(angles.size >= 12, '막대가 충분히 다양한 각도로 교차해야 합니다.');
    const before = JSON.stringify({ balls: tower.balls, pins: tower.pins });
    for (let face = 0; face < 4; face += 1) {
      for (const ball of tower.balls) projectPoint(ball, face as Face);
      for (const pin of tower.pins) {
        projectPoint(pin.entry, face as Face);
        projectPoint(pin.exit, face as Face);
      }
    }
    assert.equal(JSON.stringify({ balls: tower.balls, pins: tower.pins }), before, '방향 전환이 3D 물리 상태를 바꾸면 안 됩니다.');
    tower.dispose();
  }

  const tower = await createTower(players, 44000 + players);
  const counts = towerCounts(players);
  const fallen = new Set<number>();
  const scores = Array(players).fill(0) as number[];
  const lastDrop = Array(players).fill(-1) as number[];
  const order = [...tower.pins].sort((a, b) => ((a.id * 17 + players * 13) % counts.pins) - ((b.id * 17 + players * 13) % counts.pins));

  const first = order[0];
  const start = { ...first.center };
  assert.ok(tower.removePin(first.id));
  tower.step(10 / 120);
  const moving = tower.pins.find((pin) => pin.id === first.id)!;
  const delta = {
    x: moving.center.x - start.x,
    y: moving.center.y - start.y,
    z: moving.center.z - start.z,
  };
  const cross = Math.hypot(
    delta.y * first.axis.z - delta.z * first.axis.y,
    delta.z * first.axis.x - delta.x * first.axis.z,
    delta.x * first.axis.y - delta.y * first.axis.x,
  );
  assert.ok(cross < 1e-5, '막대는 자신의 축을 따라서 빠져야 합니다.');
  assert.ok(delta.x * first.axis.x + delta.y * first.axis.y + delta.z * first.axis.z > 0);

  const playOrder = [first, ...order.slice(1)];
  for (let turn = 0; turn < playOrder.length; turn += 1) {
    if (turn > 0) assert.ok(tower.removePin(playOrder[turn].id));
    for (const id of waitUntilSettled(tower)) {
      assert.ok(!fallen.has(id), '구슬을 두 번 집계하면 안 됩니다.');
      fallen.add(id);
      scores[turn % players] += 1;
      lastDrop[turn % players] = turn;
    }
    if (fallen.size === counts.balls) break;
  }
  assert.equal(fallen.size, counts.balls, '막대를 모두 빼면 모든 구슬이 떨어져야 합니다.');
  assert.equal(scores.reduce((sum, score) => sum + score, 0), counts.balls);
  assert.equal(scores[losingPlayer(scores, lastDrop)], Math.max(...scores));
  tower.dispose();
  console.log(`${players}인 실제 3D 구슬 타워 검사 통과`);
}
