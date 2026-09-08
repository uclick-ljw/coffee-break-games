import assert from 'node:assert/strict';
import { CAT_PUZZLES, POP_COLS, POP_ROWS, THREAD_EDGES, THREAD_SLOTS, catEscaped, comparePuzzle, hasPopMove, makePopBoard, makeThreads, moveThread, popGroup, rankPuzzles, removePopGroup, slideCat, solveCat, threadConflicts, threadRequiresThreeNodes, validCatBoard, variantCat, variantPop, variantThreads, type PopTile } from '../app/puzzle-game.ts';

let seed = 73;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
const diagonal = [{ id: 0, x: 0, y: 0, color: 0 }, { id: 1, x: 1, y: 1, color: 0 }];
assert.deepEqual(popGroup(diagonal, 0), []);
assert.equal(removePopGroup(diagonal, 0), diagonal);
const sample: PopTile[] = [{ id: 0, x: 0, y: 6, color: 0 }, { id: 1, x: 1, y: 6, color: 0 }, { id: 2, x: 0, y: 5, color: 1 }, { id: 3, x: 0, y: 4, color: 2 }];
assert.deepEqual(removePopGroup(sample, 0).map(({ id, y }) => [id, y]), [[2, 6], [3, 5]]);
for (let trial = 0; trial < 80; trial++) {
  let board = makePopBoard(random);
  assert.equal(board.length, POP_COLS * POP_ROWS);
  assert.ok(hasPopMove(board));
  const variants = Array.from({ length: 6 }, (_, player) => variantPop(board, player));
  for (let move = 0; move < 3 && hasPopMove(board); move++) {
    const id = board.find((tile) => popGroup(board, tile.id).length)!.id;
    const removed = popGroup(board, id).length;
    const before = board.length;
    board = removePopGroup(board, id);
    assert.equal(before - board.length, removed);
    for (let player = 0; player < 6; player++) {
      variants[player] = removePopGroup(variants[player], id);
      assert.equal(variants[player].length, board.length, '모든 참가자의 같은 선택은 같은 점수');
      assert.deepEqual(variants[player].sort((a, b) => a.id - b.id), variantPop(board, player).sort((a, b) => a.id - b.id));
    }
    assert.equal(new Set(board.map(({ x, y }) => `${x},${y}`)).size, board.length);
  }
}
const threadSolution = [{ x: 200, y: 30 }, { x: 370, y: 200 }, { x: 200, y: 370 }, { x: 30, y: 200 }, { x: 200, y: 120 }, { x: 280, y: 200 }, { x: 200, y: 280 }, { x: 120, y: 200 }];
assert.equal(THREAD_EDGES.length, 14);
assert.equal(THREAD_SLOTS.length, 8);
assert.equal(threadConflicts(threadSolution).length, 0, '안쪽·바깥쪽 배치로 해결 가능');
assert.equal(threadRequiresThreeNodes(threadSolution), false, '완성된 판을 어려운 시작 판으로 선택하지 않음');
for (let player = 0; player < 6; player++) {
  const solution = variantThreads(threadSolution, player);
  assert.equal(threadConflicts(solution).length, 0, '모든 참가자에게 해결 가능한 배치가 있음');
  for (let i = 0; i < solution.length; i++) {
    assert.ok(solution[i].x >= 26 && solution[i].x <= 374 && solution[i].y >= 26 && solution[i].y <= 374);
    assert.deepEqual(moveThread(solution, i, solution[i]), solution, '정답의 점 간격이 실제 드래그 제한을 충족');
  }
}
for (let i = 0; i < 200; i++) {
  const points = makeThreads(random);
  const count = threadConflicts(points).length;
  assert.equal(points.length, 8);
  assert.ok(count >= 16 && count <= 22);
  assert.ok(threadRequiresThreeNodes(points), '한두 점만 움직여서는 풀 수 없는 시작 배치');
  for (let player = 0; player < 6; player++) {
    const rotated = variantThreads(points, player);
    assert.equal(threadConflicts(rotated).length, count);
    assert.ok(threadRequiresThreeNodes(rotated), '참가자별 방향을 바꾸어도 난이도 유지');
  }
  assert.equal(moveThread(points, 0, points[1]), points, '점을 겹쳐서 해결할 수 없음');
}
const fallbackThreads = makeThreads(() => 0);
assert.ok(threadConflicts(fallbackThreads).length >= 16 && threadConflicts(fallbackThreads).length <= 22);
assert.ok(threadRequiresThreeNodes(fallbackThreads), '재시도 한도에 도달해도 쉬운 판으로 퇴행하지 않음');
assert.ok(threadConflicts(Array.from({ length: 8 }, (_, i) => ({ x: 30 + i * 45, y: 200 }))).length > 0, '일렬로 포개는 편법 방지');
assert.equal(threadConflicts([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 100, y: 0 }], [[0, 1], [2, 3]]).length, 1);
assert.equal(threadConflicts([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }], [[0, 1], [2, 3]]).length, 1, '점 위로 선을 겹쳐도 교차');
for (const [index, board] of CAT_PUZZLES.entries()) {
  assert.ok(validCatBoard(board));
  const solution = solveCat(board);
  assert.ok(solution, '풀 수 있는 고양이 퍼즐');
  assert.equal(solution.length, index === 0 ? 3 : 6, '최단 해법으로 단계 난이도 확인');
  let current = board;
  for (const move of solution) { current = slideCat(current, move.id, move.delta); assert.ok(validCatBoard(current)); }
  assert.ok(catEscaped(current));
  assert.equal(solveCat(variantCat(board, true))?.length, solution.length, '뒤집어도 같은 난이도');
  assert.equal(slideCat(board, 'cat', 5), board, '긴 드래그로 다른 상자를 뚫지 못함');
  assert.equal(slideCat(board, 'cat', -5), board, '벽 통과 불가');
  assert.equal(slideCat(board, 'cat', NaN), board);
}
const a = { player: 0, primary: 1, moves: 4, elapsedMs: 5000 };
const b = { player: 1, primary: 2, moves: 12, elapsedMs: 24000 };
assert.ok(comparePuzzle('cat', b, a) < 0, '구출 수가 이동 수보다 우선');
assert.ok(comparePuzzle('cat', a, { ...a, moves: 5, elapsedMs: 4000 }) < 0);
assert.equal(comparePuzzle('cat', { ...a, primary: 0 }, { ...b, primary: 0 }), 0, '미구출 시 아무것도 안 한 사람이 유리하지 않음');
assert.equal(comparePuzzle('untangle', a, { ...a, elapsedMs: 25000 }), 0);
assert.ok(comparePuzzle('untangle', { ...a, primary: 0 }, { ...a, primary: 0, elapsedMs: 6000 }) < 0);
for (const players of [2, 3, 4, 5, 6]) {
  const results = Array.from({ length: players }, (_, player) => ({ ...a, player }));
  const ranks = rankPuzzles('pop', results);
  assert.equal(ranks.length, players);
  assert.ok(ranks.every((item) => item.rank === 1), '완전 동점은 공동 순위');
  assert.equal(results[0].player, 0, '순위 계산은 원본 기록을 변경하지 않음');
}
console.log('퍼즐 3종: 블록 낙하·동일 난이도·교차/겹침 판정·3수/6수 구출·2~6인 순위 검사 통과');
