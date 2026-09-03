export const BALLOON_START_LEVEL = 20;
export const BALLOON_MIN_THRESHOLD = 78;
export const BALLOON_MAX_THRESHOLD = 100;
export const BALLOON_HOLD_MS = 1200;

const clampPlayers = (players: number) => Math.max(2, Math.min(6, players));

export function balloonTurnBounds(players: number) {
  const count = clampPlayers(players);
  return { min: 18 / count, max: 46 / count };
}

export function balloonTurnGrowth(players: number, elapsedMs: number) {
  const { min, max } = balloonTurnBounds(players);
  const elapsed = Math.max(0, elapsedMs);
  return Math.min(max, Math.max(min * Math.min(1, elapsed / 180), max * Math.min(1, elapsed / BALLOON_HOLD_MS)));
}

export function makeBalloonThreshold(random = Math.random()) {
  const value = Math.max(0, Math.min(1, random));
  return BALLOON_MIN_THRESHOLD + (BALLOON_MAX_THRESHOLD - BALLOON_MIN_THRESHOLD) * value;
}

export function pickBalloonStarter(players: number, random = Math.random()) {
  const count = clampPlayers(players);
  return Math.min(count - 1, Math.floor(Math.max(0, Math.min(1, random)) * count));
}
