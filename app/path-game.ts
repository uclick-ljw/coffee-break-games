export const PATH_BOARD_SIZE = 5;
export const PATH_MAX_ROTATIONS = 8;
export const PATH_HEAD_START_SECONDS = 5;
export const PATH_TURN_SECONDS = 13;
export const PATH_STEP_MS = 600;

export type PathDirection = 0 | 1 | 2 | 3;
export type PathFailure = 'guard' | 'wall' | 'loop' | 'timeout';

export type PathChallenge = {
  directions: PathDirection[];
  hazards: number[];
  start: number;
  exitCell: number;
  exitDirection: PathDirection;
  solution: number[];
  optimalRotations: number;
};

export type PathResult = {
  player: number;
  success: boolean;
  elapsed: number;
  rotations: number;
  optimalRotations: number;
  progress: number;
  pathLength: number;
  failure?: PathFailure;
};

const DELTAS = [[-1, 0], [0, 1], [1, 0], [0, -1]] as const;
const indexOf = (row: number, column: number) => row * PATH_BOARD_SIZE + column;
const pointOf = (index: number) => ({ row: Math.floor(index / PATH_BOARD_SIZE), column: index % PATH_BOARD_SIZE });

export function pathTurnCost(from: PathDirection, to: PathDirection) {
  return (to - from + 4) % 4;
}

function directionBetween(from: number, to: number): PathDirection {
  const a = pointOf(from);
  const b = pointOf(to);
  if (b.row < a.row) return 0;
  if (b.column > a.column) return 1;
  if (b.row > a.row) return 2;
  return 3;
}

function better(a: [number, number], b: [number, number] | null) {
  return !b || a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
}

export function solvePathChallenge(
  directions: PathDirection[],
  hazards: number[],
  start: number,
  exitCell: number,
  exitDirection: PathDirection,
) {
  const terminal = PATH_BOARD_SIZE ** 2;
  const hazardSet = new Set(hazards);
  const distance: Array<[number, number] | null> = Array(terminal + 1).fill(null);
  const previous = Array<number>(terminal + 1).fill(-1);
  const open = new Set<number>([start]);
  distance[start] = [0, 0];

  while (open.size) {
    let current = -1;
    for (const candidate of open) {
      if (current < 0 || better(distance[candidate]!, distance[current])) current = candidate;
    }
    open.delete(current);
    if (current === terminal) break;

    const point = pointOf(current);
    const targets: Array<{ index: number; direction: PathDirection }> = [];
    if (current === exitCell) targets.push({ index: terminal, direction: exitDirection });
    for (let direction = 0; direction < DELTAS.length; direction += 1) {
      const row = point.row + DELTAS[direction][0];
      const column = point.column + DELTAS[direction][1];
      if (row < 0 || row >= PATH_BOARD_SIZE || column < 0 || column >= PATH_BOARD_SIZE) continue;
      const next = indexOf(row, column);
      if (!hazardSet.has(next)) targets.push({ index: next, direction: direction as PathDirection });
    }

    for (const target of targets) {
      const candidate: [number, number] = [
        distance[current]![0] + pathTurnCost(directions[current], target.direction),
        distance[current]![1] + 1,
      ];
      if (!better(candidate, distance[target.index])) continue;
      distance[target.index] = candidate;
      previous[target.index] = current;
      open.add(target.index);
    }
  }

  if (!distance[terminal]) return null;
  const path: number[] = [];
  for (let current = previous[terminal]; current >= 0; current = previous[current]) path.push(current);
  path.reverse();
  return { rotations: distance[terminal]![0], steps: distance[terminal]![1], path };
}

function random(seed: number) {
  let value = seed | 0;
  return () => {
    value = value + 0x6d2b79f5 | 0;
    let mixed = Math.imul(value ^ value >>> 15, 1 | value);
    mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

function makeBaseChallenge(seed: number, targetRotations?: number, targetLength?: number): PathChallenge {
  const next = random(seed);
  const start = indexOf(2, 0);
  const exitCell = indexOf(2, 4);
  const exitDirection: PathDirection = 1;

  for (let attempt = 0; attempt < 20000; attempt += 1) {
    const directions = Array.from({ length: PATH_BOARD_SIZE ** 2 }, () => Math.floor(next() * 4) as PathDirection);
    const candidates = Array.from({ length: PATH_BOARD_SIZE ** 2 }, (_, index) => index)
      .filter((index) => index !== start && index !== exitCell)
      .sort(() => next() - .5);
    const hazards = candidates.slice(0, 5);
    const solved = solvePathChallenge(directions, hazards, start, exitCell, exitDirection);
    if (!solved || solved.rotations < 4 || solved.rotations > 6 || solved.path.length < 7 || solved.path.length > 11) continue;
    if (targetRotations !== undefined && solved.rotations !== targetRotations) continue;
    if (targetLength !== undefined && solved.path.length !== targetLength) continue;
    const hasHalfTurn = solved.path.some((cell, index) => {
      const target = index + 1 < solved.path.length ? directionBetween(cell, solved.path[index + 1]) : exitDirection;
      return pathTurnCost(directions[cell], target) === 2;
    });
    if (hasHalfTurn) return { directions, hazards, start, exitCell, exitDirection, solution: solved.path, optimalRotations: solved.rotations };
  }
  throw new Error('길 퍼즐 생성에 실패했습니다.');
}

function transformDirection(direction: PathDirection, turns: number) {
  return (direction + turns) % 4 as PathDirection;
}

function transformCell(index: number, turns: number) {
  let { row, column } = pointOf(index);
  for (let turn = 0; turn < turns; turn += 1) [row, column] = [column, PATH_BOARD_SIZE - 1 - row];
  return indexOf(row, column);
}

function rotateChallenge(challenge: PathChallenge, turns: number): PathChallenge {
  const directions = Array<PathDirection>(PATH_BOARD_SIZE ** 2);
  challenge.directions.forEach((direction, index) => {
    directions[transformCell(index, turns)] = transformDirection(direction, turns);
  });
  return {
    directions,
    hazards: challenge.hazards.map((cell) => transformCell(cell, turns)),
    start: transformCell(challenge.start, turns),
    exitCell: transformCell(challenge.exitCell, turns),
    exitDirection: transformDirection(challenge.exitDirection, turns),
    solution: challenge.solution.map((cell) => transformCell(cell, turns)),
    optimalRotations: challenge.optimalRotations,
  };
}

export function makePathChallenges(players: number, seed: number) {
  const first = makeBaseChallenge(seed);
  return Array.from({ length: players }, (_, player) => {
    const challenge = player === 0
      ? first
      : makeBaseChallenge(seed + player * 104729, first.optimalRotations, first.solution.length);
    return rotateChallenge(challenge, player % 4);
  });
}

export function solvedPathDirections(challenge: PathChallenge) {
  const directions = [...challenge.directions];
  challenge.solution.forEach((cell, index) => {
    directions[cell] = index + 1 < challenge.solution.length
      ? directionBetween(cell, challenge.solution[index + 1])
      : challenge.exitDirection;
  });
  return directions;
}

export function tracePath(challenge: PathChallenge, directions = challenge.directions, start = challenge.start) {
  const hazardSet = new Set(challenge.hazards);
  const path = [start];
  const seen = new Set(path);
  let current = start;
  for (let step = 0; step < PATH_BOARD_SIZE ** 2; step += 1) {
    const direction = directions[current];
    if (current === challenge.exitCell && direction === challenge.exitDirection) return { success: true as const, path };
    const point = pointOf(current);
    const row = point.row + DELTAS[direction][0];
    const column = point.column + DELTAS[direction][1];
    if (row < 0 || row >= PATH_BOARD_SIZE || column < 0 || column >= PATH_BOARD_SIZE) return { success: false as const, path, failure: 'wall' as const };
    const next = indexOf(row, column);
    if (hazardSet.has(next)) return { success: false as const, path, failure: 'guard' as const };
    if (seen.has(next)) return { success: false as const, path, failure: 'loop' as const };
    path.push(next);
    seen.add(next);
    current = next;
  }
  return { success: false as const, path, failure: 'loop' as const };
}

export function pathProgress(actual: number[], solution: number[]) {
  let progress = 0;
  while (progress + 1 < actual.length && progress + 1 < solution.length && actual[progress + 1] === solution[progress + 1]) progress += 1;
  return progress;
}

export function adjustedPathTime(result: PathResult) {
  return result.elapsed + Math.max(0, result.rotations - result.optimalRotations) * .3;
}

export function rankPathResults(results: PathResult[]) {
  return [...results].sort((a, b) => {
    if (a.success !== b.success) return a.success ? -1 : 1;
    if (a.success) return adjustedPathTime(a) - adjustedPathTime(b) || a.rotations - b.rotations || a.player - b.player;
    return b.progress - a.progress || a.rotations - b.rotations || b.elapsed - a.elapsed || a.player - b.player;
  });
}
