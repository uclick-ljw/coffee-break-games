import { rankResults } from './ranking.ts';

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
  const recorded = Math.round(elapsed / 10) * 10;
  return { player, elapsed: recorded, error: Math.abs(recorded - target) };
}

export function rankTimingResults(results: TimingResult[]) {
  return rankResults(results, (a, b) => Math.round(a.error / 10) - Math.round(b.error / 10));
}

export function formatTiming(ms: number) {
  return (ms / 1000).toFixed(2);
}
