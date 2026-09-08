export type PuzzleKind = 'pop' | 'untangle' | 'cat';
export const PUZZLE_MS = 25_000;
export const POP_COLS = 6;
export const POP_ROWS = 7;
export type PopTile = { id: number; color: number; x: number; y: number };

export function makePopBoard(random = Math.random): PopTile[] {
  return Array.from({ length: POP_COLS * POP_ROWS }, (_, id) => ({ id, color: Math.floor(random() * 4), x: id % POP_COLS, y: Math.floor(id / POP_COLS) }));
}

// Mirroring and renaming colors preserve every possible three-move score.
export function variantPop(board: PopTile[], player: number): PopTile[] {
  return board.map((tile) => ({ ...tile, x: player % 2 ? POP_COLS - 1 - tile.x : tile.x, color: (tile.color + player) % 4 }));
}

export function popGroup(board: PopTile[], id: number): number[] {
  const start = board.find((tile) => tile.id === id);
  if (!start) return [];
  const found = new Set([id]);
  const queue = [start];
  for (const tile of queue) {
    for (const other of board) {
      if (other.color === start.color && !found.has(other.id) && Math.abs(tile.x - other.x) + Math.abs(tile.y - other.y) === 1) {
        found.add(other.id);
        queue.push(other);
      }
    }
  }
  return queue.length >= 2 ? [...found] : [];
}

export function removePopGroup(board: PopTile[], id: number): PopTile[] {
  const removed = new Set(popGroup(board, id));
  if (!removed.size) return board;
  // Keep empty columns in place: gravity is vertical, with no hidden side-shift.
  return Array.from({ length: POP_COLS }, (_, x) => board.filter((tile) => tile.x === x && !removed.has(tile.id))
    .sort((a, b) => b.y - a.y).map((tile, index) => ({ ...tile, y: POP_ROWS - 1 - index }))).flat();
}

export function hasPopMove(board: PopTile[]) { return board.some((tile) => popGroup(board, tile.id).length > 0); }

export type Point = { x: number; y: number };
export type Edge = readonly [number, number];
// Two nested four-node loops with bridges and two face diagonals. Unlike the
// old outer-only graph, arranging every node around a circle cannot solve it.
export const THREAD_EDGES: readonly Edge[] = [
  [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7], [4, 6], [0, 5],
];
export const THREAD_SLOTS: Point[] = Array.from({ length: 8 }, (_, i) => ({ x: 200 + Math.cos(i * Math.PI / 4) * 155, y: 200 + Math.sin(i * Math.PI / 4) * 155 }));

function cross(a: Point, b: Point, c: Point) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function segmentDistance(point: Point, a: Point, b: Point) {
  const length = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length)) : 0;
  return Math.hypot(point.x - a.x - t * (b.x - a.x), point.y - a.y - t * (b.y - a.y));
}

export function threadConflicts(points: Point[], edges = THREAD_EDGES): [number, number][] {
  const conflicts: [number, number][] = [];
  edges.forEach(([a, b], i) => {
    edges.slice(i + 1).forEach(([c, d], offset) => {
      const shared = [a, b].find((id) => id === c || id === d);
      let conflict: boolean;
      if (shared !== undefined) {
        const u = a === shared ? b : a;
        const v = c === shared ? d : c;
        // Sharing a node is allowed; folding two ropes onto each other is not.
        conflict = segmentDistance(points[u], points[shared], points[v]) < 12 || segmentDistance(points[v], points[shared], points[u]) < 12;
      } else {
        const [p, q, r, s] = [points[a], points[b], points[c], points[d]];
        conflict = (cross(p, q, r) * cross(p, q, s) < 0 && cross(r, s, p) * cross(r, s, q) < 0)
          || Math.min(segmentDistance(p, r, s), segmentDistance(q, r, s), segmentDistance(r, p, q), segmentDistance(s, p, q)) < 12;
      }
      if (conflict) conflicts.push([i, i + 1 + offset]);
    });
  });
  return conflicts;
}

export function threadRequiresThreeNodes(points: Point[]): boolean {
  const masks = threadConflicts(points).map(([i, j]) => [...THREAD_EDGES[i], ...THREAD_EDGES[j]].reduce((mask, id) => mask | (1 << id), 0));
  // A crossing cannot disappear unless one of its endpoints moves. Reject any
  // layout whose initial conflicts could all be affected by just one/two nodes.
  for (let a = 0; a < points.length; a++) {
    for (let b = a; b < points.length; b++) {
      if (masks.every((mask) => mask & ((1 << a) | (1 << b)))) return false;
    }
  }
  return true;
}

export function makeThreads(random = Math.random): Point[] {
  for (let attempt = 0; attempt < 100; attempt++) {
    const points = THREAD_SLOTS.map((point) => ({ ...point }));
    for (let i = points.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [points[i], points[j]] = [points[j], points[i]];
    }
    const count = threadConflicts(points).length;
    if (count >= 16 && count <= 22 && threadRequiresThreeNodes(points)) return points;
  }
  return [5, 4, 0, 2, 6, 7, 3, 1].map((i) => ({ ...THREAD_SLOTS[i] }));
}

export function variantThreads(points: Point[], player: number): Point[] {
  const angle = player * Math.PI / 3;
  return points.map(({ x, y }) => ({ x: 200 + (x - 200) * Math.cos(angle) - (y - 200) * Math.sin(angle), y: 200 + (x - 200) * Math.sin(angle) + (y - 200) * Math.cos(angle) }));
}

export function moveThread(points: Point[], index: number, point: Point): Point[] {
  const next = { x: Math.max(26, Math.min(374, point.x)), y: Math.max(26, Math.min(374, point.y)) };
  if (points.some((other, i) => i !== index && Math.hypot(next.x - other.x, next.y - other.y) < 60)) return points;
  return points.map((other, i) => i === index ? next : other);
}

export type CatPiece = { id: string; x: number; y: number; size: number; axis: 'x' | 'y' };
export const CAT_SIZE = 6;
export const CAT_PUZZLES: readonly CatPiece[][] = [
  [
    { id: 'cat', x: 0, y: 2, size: 2, axis: 'x' },
    { id: 'A', x: 2, y: 0, size: 3, axis: 'y' },
    { id: 'B', x: 1, y: 3, size: 2, axis: 'x' },
    { id: 'C', x: 0, y: 3, size: 2, axis: 'y' },
    { id: 'D', x: 3, y: 4, size: 2, axis: 'x' },
    { id: 'E', x: 5, y: 0, size: 2, axis: 'y' },
  ],
  [
    { id: 'cat', x: 0, y: 2, size: 2, axis: 'x' },
    { id: 'A', x: 2, y: 0, size: 3, axis: 'y' },
    { id: 'B', x: 1, y: 3, size: 2, axis: 'x' },
    { id: 'C', x: 0, y: 3, size: 2, axis: 'y' },
    { id: 'D', x: 3, y: 4, size: 2, axis: 'x' },
    { id: 'E', x: 5, y: 0, size: 2, axis: 'y' },
    { id: 'F', x: 3, y: 1, size: 2, axis: 'x' },
    { id: 'G', x: 4, y: 2, size: 2, axis: 'y' },
  ],
];

export function variantCat(board: CatPiece[], flip: boolean): CatPiece[] {
  return board.map((piece) => ({ ...piece, y: flip ? CAT_SIZE - piece.y - (piece.axis === 'y' ? piece.size : 1) : piece.y }));
}

export function validCatBoard(board: CatPiece[]): boolean {
  const occupied = new Set<number>();
  for (const piece of board) {
    for (let i = 0; i < piece.size; i++) {
      const x = piece.x + (piece.axis === 'x' ? i : 0);
      const y = piece.y + (piece.axis === 'y' ? i : 0);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= CAT_SIZE || y >= CAT_SIZE || occupied.has(y * CAT_SIZE + x)) return false;
      occupied.add(y * CAT_SIZE + x);
    }
  }
  return true;
}

export function slideCat(board: CatPiece[], id: string, delta: number): CatPiece[] {
  const piece = board.find((item) => item.id === id);
  if (!piece || !Number.isFinite(delta)) return board;
  const direction = Math.sign(delta);
  let result = board;
  // Check every cell along the path: a long swipe cannot tunnel through a box.
  for (let step = 1; step <= Math.min(CAT_SIZE, Math.abs(Math.round(delta))); step++) {
    const next = board.map((item) => item.id === id ? { ...item, [piece.axis]: piece[piece.axis] + direction * step } : item);
    if (!validCatBoard(next)) break;
    result = next;
  }
  return result;
}

export function catEscaped(board: CatPiece[]) { return board.some((piece) => piece.id === 'cat' && piece.x + piece.size === CAT_SIZE); }

// ponytail: bounded BFS for these two small fixed puzzles; no general-purpose puzzle solver dependency.
export function solveCat(board: CatPiece[]): { id: string; delta: number }[] | null {
  type Move = { id: string; delta: number };
  const key = (items: CatPiece[]) => items.map((piece) => piece[piece.axis]).join(',');
  const seen = new Set([key(board)]);
  const queue: { board: CatPiece[]; path: Move[] }[] = [{ board, path: [] }];
  for (let i = 0; i < queue.length && i < 25_000; i++) {
    const current = queue[i];
    if (catEscaped(current.board)) return current.path;
    for (const piece of current.board) {
      for (const direction of [-1, 1]) {
        for (let steps = 1; steps < CAT_SIZE; steps++) {
          const delta = direction * steps;
          const next = slideCat(current.board, piece.id, delta);
          if (next.find((item) => item.id === piece.id)![piece.axis] !== piece[piece.axis] + delta) break;
          const id = key(next);
          if (!seen.has(id)) { seen.add(id); queue.push({ board: next, path: [...current.path, { id: piece.id, delta }] }); }
        }
      }
    }
  }
  return null;
}

export type PuzzleScore = { player: number; primary: number; moves: number; elapsedMs: number };
export function comparePuzzle(kind: PuzzleKind, a: PuzzleScore, b: PuzzleScore): number {
  const main = kind === 'untangle' ? a.primary - b.primary : b.primary - a.primary;
  if (main) return main;
  if (kind === 'cat' && a.primary > 0 && a.moves !== b.moves) return a.moves - b.moves;
  // An unfinished attempt never wins by submitting early or by making no moves.
  if ((kind === 'untangle' && a.primary > 0) || (kind === 'cat' && a.primary === 0)) return 0;
  return Math.round(a.elapsedMs / 100) - Math.round(b.elapsedMs / 100);
}

export function rankPuzzles(kind: PuzzleKind, results: PuzzleScore[]) {
  const sorted = [...results].sort((a, b) => comparePuzzle(kind, a, b));
  let rank = 1;
  return sorted.map((result, index) => {
    if (index > 0 && comparePuzzle(kind, result, sorted[index - 1]) !== 0) rank = index + 1;
    return { ...result, rank };
  });
}
