export type TimingMode = 'blind' | 'visible';

export type TimingResult = {
  player: number;
  elapsed: number;
  error: number;
};

const TARGET_MIN = 2500;
const TARGET_STEP = 250;
const TARGET_STEPS = 10;

export function makeTimingTarget(random = Math.random) {
  return TARGET_MIN + Math.floor(random() * (TARGET_STEPS + 1)) * TARGET_STEP;
}

export function scoreTimingAttempt(player: number, elapsed: number, target: number): TimingResult {
  return { player, elapsed, error: Math.abs(elapsed - target) };
}

export function rankTimingResults(results: TimingResult[]) {
  return [...results].sort((a, b) => a.error - b.error || a.player - b.player);
}

export function formatTiming(ms: number) {
  return (ms / 1000).toFixed(2);
}
