import assert from 'node:assert/strict';
import { hash, makeIce, resolveHit, ROULETTE_RESULTS } from '../app/game.ts';

const expectedCounts = new Map([[2, 19], [3, 37], [4, 61]]);

for (const [players, expected] of expectedCounts) {
  const lengths: number[] = [];
  const spinLengths: number[] = [];
  for (let seed = 1; seed <= 120; seed += 1) {
    let ice = makeIce(players, seed);
    assert.equal(ice.length, expected);
    assert.ok(ice.every((tile) => tile.links.length >= 2 && tile.links.length <= 3));
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
      if (move <= players * 2) assert.equal(ice.find((tile) => tile.id === '0:0')?.state, 'solid');
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
  const [minimum, maximum] = players === 2 ? [6, 10] : players === 3 ? [9, 15] : [12, 20];
  assert.ok(average >= minimum && average <= maximum, `${players}인 평균 타격 수가 목표 범위를 벗어났습니다.`);
  assert.ok(averageSpins <= (players === 2 ? 12 : players === 3 ? 20 : 28), `${players}인 룰렛 횟수가 너무 많습니다.`);
  assert.ok(Math.min(...lengths) > players * 2, '첫 두 바퀴 안에 간접 패배가 발생했습니다.');
  console.log(`${players}인: 평균 ${average.toFixed(1)}타격·룰렛 ${averageSpins.toFixed(1)}회, 90%가 ${p90}타격 이내, 범위 ${Math.min(...lengths)}-${Math.max(...lengths)}`);
  assert.ok(p90 <= maximum, `${players}인 게임의 상위 10%가 너무 오래 지속됩니다.`);
}

const sample = makeIce(2, 42);
assert.deepEqual(resolveHit(sample, '-2:0', 1, 2), resolveHit(sample, '-2:0', 1, 2));

console.log('게임 규칙 검사 통과');
