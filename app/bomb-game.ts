export const BOMB_MIN = 1;
export const BOMB_MAX = 100;
export const BOMB_TURN_MS = 6000;

export type BombState = { bomb: number; low: number; high: number };
export type BombPick = { hit: boolean; direction: 'UP' | 'DOWN' | null; low: number; high: number };

function hash(seed: number) {
  let value = seed | 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return (value ^ value >>> 16) >>> 0;
}

export function makeBombRound(players: number, seed: number) {
  return {
    bomb: BOMB_MIN + hash(seed) % (BOMB_MAX - BOMB_MIN + 1),
    starter: hash(seed + 91) % players,
  };
}

export function playableBounds(low: number, high: number) {
  const size = high - low + 1;
  if (size <= 5) return { low, high };
  const padding = Math.floor(size * .2);
  return { low: low + padding, high: high - padding };
}

export function resolveBombPick(state: BombState, choice: number): BombPick {
  const playable = playableBounds(state.low, state.high);
  if (choice < playable.low || choice > playable.high) throw new RangeError('선택 가능한 숫자가 아닙니다.');
  if (choice === state.bomb) return { hit: true, direction: null, low: state.low, high: state.high };
  if (choice < state.bomb) return { hit: false, direction: 'UP', low: choice + 1, high: state.high };
  return { hit: false, direction: 'DOWN', low: state.low, high: choice - 1 };
}
