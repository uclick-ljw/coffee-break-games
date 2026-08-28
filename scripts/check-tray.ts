import assert from 'node:assert/strict';
import {
  clampTrayX,
  createTrayEngine,
  makeTrayQueue,
  TRAY_ITEMS,
  TRAY_DROP_DRAG,
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
assert.equal(trayTurnReady(10, 0, 0), false, '움직임이 남아 있으면 시간이 지나도 차례를 넘기면 안 됩니다.');
assert.equal(trayTurnReady(1.59, 1, 0), false, '안전해 보여도 최소 관찰 시간 전에는 기다려야 합니다.');
assert.equal(trayTurnReady(1.6, 0.45, 0), true, '안정된 일반 배치는 차례를 넘겨야 합니다.');
assert.equal(trayTurnReady(2.9, 1, 0.3), false, '위험하게 기운 쟁반은 더 오래 관찰해야 합니다.');
assert.equal(trayTurnReady(3, 0.9, 0.3), true, '위험한 상태도 충분히 멈춘 뒤에는 진행할 수 있어야 합니다.');

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
  assert.ok(Math.abs(engine.trayAngle) < 0.3, '중앙 배치는 쟁반의 균형을 유지해야 합니다.');
  engine.dispose();
}

const falling = await createTrayEngine();
falling.drop('macaron', TRAY_X_LIMIT, 0);
advance(falling, 1200);
assert.equal(falling.failed(), true, '가장자리에 둔 둥근 물체는 결국 떨어져야 합니다.');
falling.dispose();

console.log('아슬아슬 트레이의 물체 구성, 차례, 실제 낙하 물리 검사 통과');
