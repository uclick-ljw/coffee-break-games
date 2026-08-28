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
  engine.dispose();
}

const stableStack = await createTrayEngine();
stableStack.drop('cake', 0, 0);
advance(stableStack);
stableStack.drop('cake', 0, 0);
advance(stableStack);
assert.equal(stableStack.failed(), false, '무게중심이 맞는 중앙 쌓기는 유지되어야 합니다.');
stableStack.dispose();

const collapsedStack = await createTrayEngine();
collapsedStack.drop('cake', 0, 0);
advance(collapsedStack);
collapsedStack.drop('tumbler', 1.05, 0);
advance(collapsedStack, 1200);
assert.equal(collapsedStack.failed(), true, '무게중심이 받침을 벗어난 물건은 넘어져 바닥에 닿아야 합니다.');
collapsedStack.dispose();

console.log('아슬아슬 트레이의 물체 구성, 차례, 실제 낙하 물리 검사 통과');
