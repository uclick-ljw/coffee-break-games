export type Ice = {
  id: string;
  q: number;
  r: number;
  x: number;
  y: number;
  strength: number;
  stress: number;
  links: string[];
  color: 'blue' | 'white';
  state: 'solid' | 'gone';
};

export type ResolutionStep = {
  affected: string[];
  falling: string[];
};

export const PLAYER_NAMES = ['파랑', '주황', '보라', '초록', '분홍', '노랑'];
export const ROULETTE_RESULTS = ['blue', 'white', 'any', 'pass'] as const;
export type RouletteResult = typeof ROULETTE_RESULTS[number];
export const iceSize = (radius: number) => 48 / (radius + 0.5);
export const boardRadius = (players: number) => Math.min(4, players);

const directions = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

export function hash(q: number, r: number, seed: number) {
  let value = Math.imul(q + 31, 73856093) ^ Math.imul(r + 47, 19349663) ^ seed;
  value ^= value >>> 13;
  return Math.abs(value);
}

function neighbors(tile: Ice, all: Ice[]) {
  return directions
    .map(([dq, dr]) => all.find((item) => item.q === tile.q + dq && item.r === tile.r + dr))
    .filter((item): item is Ice => Boolean(item));
}

export function makeIce(players: number, seed: number): Ice[] {
  const radius = boardRadius(players);
  const size = iceSize(radius);
  const ice: Ice[] = [];
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      if (Math.abs(q + r) > radius) continue;
      ice.push({
        id: `${q}:${r}`,
        q,
        r,
        x: 50 + (q + r / 2) * size,
        y: 50 + r * size * Math.sqrt(3) / 2,
        strength: 3 + (hash(q, r, seed) % 2) + (players >= 5 ? 1 : 0),
        stress: 0,
        links: [],
        color: 'white',
        state: 'solid',
      });
    }
  }

  const blueIds = new Set([...ice]
    .sort((a, b) => hash(a.q, a.r, seed + 41) - hash(b.q, b.r, seed + 41))
    .slice(0, Math.floor(ice.length / 2))
    .map((tile) => tile.id));

  const linkMap = new Map(ice.map((tile) => [tile.id, new Set<string>()]));
  const edges = ice.flatMap((tile) => neighbors(tile, ice)
    .filter((other) => tile.id < other.id)
    .map((other) => ({
      a: tile,
      b: other,
      score: hash(tile.q * 11 + other.q * 17, tile.r * 13 + other.r * 19, seed),
    })))
    .sort((a, b) => a.score - b.score);
  const connect = (a: Ice, b: Ice) => {
    linkMap.get(a.id)!.add(b.id);
    linkMap.get(b.id)!.add(a.id);
  };

  for (const edge of edges) {
    if (edge.score % 100 < 45 && linkMap.get(edge.a.id)!.size < 3 && linkMap.get(edge.b.id)!.size < 3) connect(edge.a, edge.b);
  }
  for (const tile of ice) {
    const candidates = edges.filter((edge) => edge.a.id === tile.id || edge.b.id === tile.id);
    for (const edge of candidates) {
      if (linkMap.get(tile.id)!.size >= Math.min(2, candidates.length)) break;
      const other = edge.a.id === tile.id ? edge.b : edge.a;
      if (linkMap.get(other.id)!.size < 4) connect(tile, other);
    }
  }

  return ice.map((tile) => ({
    ...tile,
    color: blueIds.has(tile.id) ? 'blue' : 'white',
    links: [...linkMap.get(tile.id)!],
  }));
}

export function structurallyUnsupportedIds(all: Ice[]) {
  const radius = Math.max(...all.map((tile) => Math.max(Math.abs(tile.q), Math.abs(tile.r), Math.abs(tile.q + tile.r))));
  const stable = new Set(all
    .filter((tile) => tile.state === 'solid' && Math.max(Math.abs(tile.q), Math.abs(tile.r), Math.abs(tile.q + tile.r)) === radius)
    .map((tile) => tile.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const tile of all) {
      if (tile.state === 'gone' || stable.has(tile.id)) continue;
      const requiredSupports = 2;
      if (neighbors(tile, all).filter((neighbor) => neighbor.state === 'solid' && stable.has(neighbor.id)).length >= requiredSupports) {
        stable.add(tile.id);
        changed = true;
      }
    }
  }
  return all.filter((tile) => tile.state === 'solid' && !stable.has(tile.id)).map((tile) => tile.id);
}

export function resolveHit(all: Ice[], targetId: string, move: number, players: number) {
  const target = all.find((tile) => tile.id === targetId && tile.state === 'solid');
  if (!target) return { final: all, steps: [] as ResolutionStep[] };

  let next = all.map((tile) => tile.id === targetId ? { ...tile, state: 'gone' as const } : { ...tile });
  const steps: ResolutionStep[] = [];
  const coldPenalty = Math.floor((Math.floor((move - 1) / players) * 3) / 4);
  let frontier = [targetId];

  for (let depth = 0; depth < 2 && frontier.length; depth += 1) {
    const affected = [...new Set(frontier.flatMap((id) => next.find((tile) => tile.id === id)?.links ?? []))]
      .filter((id) => next.find((tile) => tile.id === id)?.state === 'solid');
    if (!affected.length) break;

    const affectedSet = new Set(affected);
    next = next.map((tile) => affectedSet.has(tile.id) ? { ...tile, stress: tile.stress + 1 } : tile);
    const falling = affected.filter((id) => {
      const tile = next.find((item) => item.id === id)!;
      return tile.stress >= Math.max(1, tile.strength - coldPenalty);
    });
    const fallingSet = new Set(falling);
    next = next.map((tile) => fallingSet.has(tile.id) ? { ...tile, state: 'gone' as const } : tile);
    steps.push({ affected, falling });
    frontier = falling;
  }

  const unsupported = structurallyUnsupportedIds(next);
  if (unsupported.length) {
    const unsupportedSet = new Set(unsupported);
    next = next.map((tile) => unsupportedSet.has(tile.id) ? { ...tile, state: 'gone' as const } : tile);
    steps.push({ affected: unsupported, falling: unsupported });
  }

  return { final: next, steps };
}
