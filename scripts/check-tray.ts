import assert from 'node:assert/strict';
import {
  clampTrayX,
  createTrayEngine,
  makeTrayQueue,
  TRAY_ITEMS,
  TRAY_DROP_DRAG,
  TRAY_MAX_ANGLE,
  TRAY_ROTATION_STEP,
  TRAY_X_LIMIT,
  trayNextPlayer,
  trayGestureAction,
  trayTurnReady,
  type TrayItemKind,
} from '../app/tray-game.ts';

const kinds = Object.keys(TRAY_ITEMS) as TrayItemKind[];
const queue = makeTrayQueue(112233, 24);
for (let offset = 0; offset < queue.length; offset += kinds.length) {
  assert.deepEqual(new Set(queue.slice(offset, offset + kinds.length)), new Set(kinds), '한 묶음에는 물건 6종이 한 번씩 들어가야 합니다.');
}

assert.equal(clampTrayX(-99), -TRAY_X_LIMIT);
assert.equal(clampTrayX(99), TRAY_X_LIMIT);
assert.equal(trayNextPlayer(1, 2), 0);
assert.equal(trayNextPlayer(4, 6), 5);
assert.equal(trayNextPlayer(5, 6), 0);
assert.equal(TRAY_ROTATION_STEP, Math.PI / 6);
assert.equal(trayGestureAction(3, 4), 'rotate', '짧게 누르면 회전해야 합니다.');
assert.equal(trayGestureAction(45, 4), 'move', '좌우로 움직였다 놓으면 위치만 바뀌어야 합니다.');
assert.equal(trayGestureAction(18, TRAY_DROP_DRAG - 1), 'move', '낙하 거리 전에는 떨어지면 안 됩니다.');
assert.equal(trayGestureAction(18, TRAY_DROP_DRAG), 'drop', '아래로 충분히 끌면 낙하해야 합니다.');
assert.equal(trayTurnReady(10, 0), false, '움직임이 남아 있으면 시간이 지나도 차례를 넘기면 안 됩니다.');
assert.equal(trayTurnReady(1.49, 1), false, '최소 관찰 시간 전에는 차례를 넘기면 안 됩니다.');
assert.equal(trayTurnReady(1.5, 0.49), false, '충분히 멈추기 전에는 차례를 넘기면 안 됩니다.');
assert.equal(trayTurnReady(1.5, 0.5), true, '고정 바닥에서 충분히 멈춘 뒤에만 차례를 넘겨야 합니다.');

function advance(engine: Awaited<ReturnType<typeof createTrayEngine>>, frames = 900) {
  let stable = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    engine.step(1 / 60);
    stable = engine.settled() ? stable + 1 : 0;
    if (engine.failed() || stable >= 12) break;
  }
}

for (const kind of kinds) {
  const engine = await createTrayEngine();
  engine.drop(kind, 0, 0);
  advance(engine);
  assert.equal(engine.pieces.length, 1);
  assert.equal(engine.failed(), false, `${TRAY_ITEMS[kind].name}을 중앙에 놓았을 때 바로 무너지면 안 됩니다.`);
  assert.ok(Math.abs(engine.trayAngle) <= TRAY_MAX_ANGLE + 0.01, '시소가 관절 제한을 넘어가면 안 됩니다.');
  engine.dispose();
}

const tiltedTray = await createTrayEngine();
tiltedTray.drop('cake', 2.25, 0);
advance(tiltedTray, 1200);
assert.equal(tiltedTray.failed(), false, '한쪽에 놓아 시소가 기울어져도 물건이 판 위에 있으면 살아야 합니다.');
assert.ok(Math.abs(tiltedTray.trayAngle) > 0.08, '한쪽 무게는 실제 관절을 따라 시소를 기울여야 합니다.');
assert.ok(Math.abs(tiltedTray.trayAngle) <= TRAY_MAX_ANGLE + 0.01, '시소는 최대 기울기에서 멈춰야 합니다.');
tiltedTray.dispose();

const recoveredTray = await createTrayEngine();
recoveredTray.drop('cake', 2.25, 0);
advance(recoveredTray, 1200);
recoveredTray.drop('cake', -2.25, 0);
advance(recoveredTray, 1200);
assert.equal(recoveredTray.failed(), false, '반대편에 물건을 놓아 기울어진 시소를 되살릴 수 있어야 합니다.');
assert.ok(Math.abs(recoveredTray.trayAngle) < 0.2, '반대편 무게를 더하면 최대 기울기에서 벗어나야 합니다.');
recoveredTray.dispose();

const falling = await createTrayEngine();
falling.drop('macaron', TRAY_X_LIMIT, 0);
advance(falling, 1800);
assert.equal(falling.failed(), true, '가장자리의 둥근 물건은 기울어진 시소 밖으로 굴러 떨어져야 합니다.');
falling.dispose();

console.log('아슬아슬 트레이의 물체 구성, 차례, 실제 낙하 물리 검사 통과');
