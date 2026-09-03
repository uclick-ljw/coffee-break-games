import assert from 'node:assert/strict';
import { GAME_CATEGORIES, GAMES, pickRandomGame } from '../app/game-catalog.ts';

assert.ok(GAMES.length > 0, '게임 목록이 비어 있습니다.');
assert.equal(new Set(GAMES.map((game) => game.id)).size, GAMES.length, '게임 ID가 중복되었습니다.');

for (const game of GAMES) {
  assert.ok(game.title && game.description && game.players && game.time, `${game.id}: 기본 정보가 빠졌습니다.`);
  assert.ok(game.goal && game.controls && game.result, `${game.id}: 게임 설명이 빠졌습니다.`);
}

for (const category of GAME_CATEGORIES) {
  assert.ok(GAMES.some((game) => game.category === category.id), `${category.id}: 게임이 없는 분류입니다.`);
}

assert.equal(pickRandomGame(undefined, () => 0).id, GAMES[0].id, '랜덤 목록의 시작값이 잘못되었습니다.');
assert.equal(pickRandomGame(undefined, () => 1).id, GAMES.at(-1)?.id, '랜덤 목록의 끝값이 잘못되었습니다.');
assert.notEqual(pickRandomGame(GAMES[0].id, () => 0).id, GAMES[0].id, '다시 뽑기에서 같은 게임이 나왔습니다.');

console.log(`게임 목록 ${GAMES.length}개와 랜덤 선택 규칙을 확인했습니다.`);
