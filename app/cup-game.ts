import { rankResults } from './ranking.ts';

export const CUP_ROUNDS = 3;

export type CupSwap = readonly [number, number];

export type CupChallenge = {
  cupCount: number;
  targetCup: number;
  swaps: CupSwap[];
  speedMs: number;
  level: number;
};

export type CupResult = {
  player: number;
  score: number;
  correct: number;
  decisionMs: number;
};

function random(seed: number) {
  let value = seed | 0;
  return () => {
    value = value + 0x6d2b79f5 | 0;
    let mixed = Math.imul(value ^ value >>> 15, 1 | value);
    mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

export function finalCupSlot(challenge: CupChallenge) {
  let slot = challenge.targetCup;
  for (const [a, b] of challenge.swaps) {
    if (slot === a) slot = b;
    else if (slot === b) slot = a;
  }
  return slot;
}

export function makeCupChallenge(seed: number, level: number): CupChallenge {
  const next = random(seed);
  const cupCount = [3, 4, 5][level];
  const swapCount = [7, 9, 11][level];
  const speedMs = [480, 350, 280][level];
  const targetCup = Math.floor(next() * cupCount);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const swaps: CupSwap[] = [];
    let targetSlot = targetCup;
    let targetMoves = 0;
    let previous = '';
    while (swaps.length < swapCount) {
      const a = Math.floor(next() * cupCount);
      let b = Math.floor(next() * (cupCount - 1));
      if (b >= a) b += 1;
      const pair = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (pair === previous) continue;
      swaps.push([a, b]);
      previous = pair;
      if (targetSlot === a) { targetSlot = b; targetMoves += 1; }
      else if (targetSlot === b) { targetSlot = a; targetMoves += 1; }
    }
    if (targetMoves >= 2 && targetSlot !== targetCup) return { cupCount, targetCup, swaps, speedMs, level };
  }
  throw new Error('컵 셔플 생성에 실패했습니다.');
}

export function makeCupChallenges(players: number, seed: number) {
  return Array.from({ length: players }, (_, player) => Array.from(
    { length: CUP_ROUNDS },
    (_, level) => makeCupChallenge(seed + player * 104729 + level * 7919, level),
  ));
}

export function cupRoundScore(correct: boolean, decisionMs: number, level: number) {
  if (!correct) return 0;
  return 100 + level * 20 + Math.max(0, 30 - Math.floor(decisionMs / 100));
}

export function rankCupResults(results: CupResult[]) {
  return rankResults(results, (a, b) => b.correct - a.correct || b.score - a.score || (a.correct > 0 ? Math.round(a.decisionMs / 100) - Math.round(b.decisionMs / 100) : 0));
}
