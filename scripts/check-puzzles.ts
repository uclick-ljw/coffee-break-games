import assert from 'node:assert/strict';
import { CAT_PUZZLES, POP_COLS, POP_ROWS, THREAD_SLOTS, catEscaped, comparePuzzle, hasPopMove, makePopBoard, makeThreads, moveThread, popGroup, rankPuzzles, removePopGroup, slideCat, solveCat, threadConflicts, validCatBoard, variantCat, variantPop, variantThreads, type PopTile } from '../app/puzzle-game.ts';

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
assert.equal(threadConflicts(THREAD_SLOTS).length, 0, '정답 배치는 교차 없음');
for (let i = 0; i < 60; i++) {
  const points = makeThreads(random);
  const count = threadConflicts(points).length;
  assert.ok(count >= 6 && count <= 9);
  for (let player = 0; player < 6; player++) assert.equal(threadConflicts(variantThreads(points, player)).length, count);
  assert.equal(moveThread(points, 0, points[1]), points, '점을 겹쳐서 해결할 수 없음');
}
assert.ok(threadConflicts(Array.from({ length: 6 }, (_, i) => ({ x: 30 + i * 55, y: 200 }))).length > 0, '일렬로 포개는 편법 방지');
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
