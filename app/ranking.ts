// Competition ranking: equal results share a place (1, 1, 3), never a player-order tiebreak.
export function rankResults<T extends object>(results: readonly T[], compare: (a: T, b: T) => number) {
  const sorted = [...results].sort(compare);
  let rank = 1;
  return sorted.map((result, index) => {
    if (index > 0 && compare(result, sorted[index - 1]) !== 0) rank = index + 1;
    return { ...result, rank };
  });
}

export function lastPlace<T extends { rank: number }>(results: readonly T[]) {
  return results.filter((result) => result.rank === results.at(-1)?.rank);
}
