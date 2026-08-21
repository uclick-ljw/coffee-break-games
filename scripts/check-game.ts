import assert from 'node:assert/strict';
import { boardRadius, hash, iceSize, makeIce, resolveHit, ROULETTE_RESULTS, structurallyUnsupportedIds } from '../app/game.ts';

const expectedCounts = new Map([[2, 19], [3, 37], [4, 61], [5, 61], [6, 61]]);

for (const [players, expected] of expectedCounts) {
  const lengths: number[] = [];
  const spinLengths: number[] = [];
  for (let seed = 1; seed <= 120; seed += 1) {
    let ice = makeIce(players, seed);
    assert.equal(ice.length, expected);
    assert.ok(ice.every((tile) => tile.links.length >= 2 && tile.links.length <= 4));
    assert.ok(ice.every((tile) => tile.links.every((id) => ice.find((other) => other.id === id)?.links.includes(tile.id))), '물리 연결은 양방향이어야 합니다.');
    const size = iceSize(boardRadius(players));
    const height = size / (Math.sqrt(3) / 2);
    assert.ok(ice.every((tile) => tile.x - size / 2 >= 0 && tile.x + size / 2 <= 100 && tile.y - height / 2 >= 0 && tile.y + height / 2 <= 100), '육각형이 게임판을 벗어났습니다.');
    assert.deepEqual(structurallyUnsupportedIds(ice), [], '온전한 게임판은 모두 지지되어야 합니다.');
    assert.ok(Math.abs(ice.filter((tile) => tile.color === 'blue').length - ice.filter((tile) => tile.color === 'white').length) <= 1);

    let move = 1;
    let spin = 1;
    while (ice.find((tile) => tile.id === '0:0')?.state === 'solid' && move <= expected * 2 && spin <= expected * 20) {
      const roulette = ROULETTE_RESULTS[hash(spin, seed, players) % ROULETTE_RESULTS.length];
      spin += 1;
      if (roulette === 'pass') continue;
      const choices = ice.filter((tile) => tile.state === 'solid' && tile.id !== '0:0' && (roulette === 'any' || tile.color === roulette));
      if (!choices.length) continue;
      assert.ok(choices.length, '중앙 얼음만 남기 전에 판이 끝나야 합니다.');
      const target = choices[hash(move, seed, players) % choices.length];
      const result = resolveHit(ice, target.id, move, players);
      assert.ok(result.steps.every((step) => step.affected.length <= expected));
      ice = result.final;
      move += 1;
    }
    assert.equal(ice.find((tile) => tile.id === '0:0')?.state, 'gone');
    lengths.push(move - 1);
    spinLengths.push(spin - 1);
  }
  const average = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
  const averageSpins = spinLengths.reduce((sum, value) => sum + value, 0) / spinLengths.length;
  const sorted = [...lengths].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const [minimum, maximum] = players === 2 ? [6, 10] : players === 3 ? [9, 15] : players === 4 ? [12, 20] : players === 5 ? [12, 28] : [12, 30];
  console.log(`${players}인: 평균 ${average.toFixed(1)}타격·룰렛 ${averageSpins.toFixed(1)}회, 90%가 ${p90}타격 이내, 범위 ${Math.min(...lengths)}-${Math.max(...lengths)}`);
  assert.ok(average >= minimum && average <= maximum, `${players}인 평균 타격 수가 목표 범위를 벗어났습니다.`);
  assert.ok(averageSpins <= (players === 2 ? 12 : players === 3 ? 20 : players === 4 ? 28 : 36), `${players}인 룰렛 횟수가 너무 많습니다.`);
  assert.ok(Math.min(...lengths) >= players, '모든 플레이어가 최소 한 번은 선택해야 합니다.');
  assert.ok(p90 <= maximum, `${players}인 게임의 상위 10%가 너무 오래 지속됩니다.`);
}

const sample = makeIce(2, 42);
assert.deepEqual(resolveHit(sample, '-2:0', 1, 2), resolveHit(sample, '-2:0', 1, 2));
const thinBridge = sample.map((tile) => ({ ...tile, state: ['2:0', '1:0', '0:0'].includes(tile.id) ? 'solid' as const : 'gone' as const }));
assert.deepEqual(new Set(structurallyUnsupportedIds(thinBridge)), new Set(['1:0', '0:0']), '한 줄짜리 연결부가 안쪽 얼음을 지탱하면 안 됩니다.');

console.log('게임 규칙 검사 통과');
