export type Ice = {
  id: string;
  q: number;
  r: number;
  x: number;
  y: number;
  strength: number;
  stress: number;
  links: string[];
  state: 'solid' | 'gone';
};

export type ResolutionStep = {
  affected: string[];
  falling: string[];
};

export const PLAYER_NAMES = ['파랑', '주황', '보라', '초록'];

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
  const radius = players;
  const ice: Ice[] = [];
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      if (Math.abs(q + r) > radius) continue;
      ice.push({
        id: `${q}:${r}`,
        q,
        r,
        x: 50 + q * (44 / radius) + r * (22 / radius),
        y: 50 + r * (38 / radius),
        strength: 2 + (hash(q, r, seed) % 2),
        stress: 0,
        links: [],
        state: 'solid',
      });
    }
  }

  return ice.map((tile) => {
    const ordered = neighbors(tile, ice).sort((a, b) =>
      hash(tile.q + a.q * 7, tile.r + a.r * 11, seed) - hash(tile.q + b.q * 7, tile.r + b.r * 11, seed),
    );
    const linked = ordered.filter((item) => hash(tile.q + item.q, tile.r + item.r, seed) % 100 < 55).slice(0, 3);
    for (const item of ordered) {
      if (linked.length >= Math.min(2, ordered.length)) break;
      if (!linked.includes(item)) linked.push(item);
    }
    return { ...tile, links: linked.slice(0, 3).map((item) => item.id) };
  });
}

function detachedIds(all: Ice[]) {
  const reachable = new Set(
    all.filter((tile) => tile.state === 'solid' && Math.max(Math.abs(tile.q), Math.abs(tile.r), Math.abs(tile.q + tile.r)) === Math.max(...all.map((item) => Math.max(Math.abs(item.q), Math.abs(item.r), Math.abs(item.q + item.r)))))
      .map((tile) => tile.id),
  );
  const queue = [...reachable];
  while (queue.length) {
    const currentId = queue.shift();
    const tile = all.find((item) => item.id === currentId);
    if (!tile) continue;
    for (const neighbor of neighbors(tile, all)) {
      if (neighbor.state === 'solid' && !reachable.has(neighbor.id)) {
        reachable.add(neighbor.id);
        queue.push(neighbor.id);
      }
    }
  }
  return all.filter((tile) => tile.state === 'solid' && !reachable.has(tile.id)).map((tile) => tile.id);
}

export function resolveHit(all: Ice[], targetId: string, move: number, players: number) {
  const target = all.find((tile) => tile.id === targetId && tile.state === 'solid');
  if (!target) return { final: all, steps: [] as ResolutionStep[] };

  let next = all.map((tile) => tile.id === targetId ? { ...tile, state: 'gone' as const } : { ...tile });
  const steps: ResolutionStep[] = [];
  const coldPenalty = Math.min(1, Math.floor(Math.floor((move - 1) / players) / 2));
  let frontier = [targetId];

  for (let depth = 0; depth < 2 && frontier.length; depth += 1) {
    const affected = [...new Set(frontier.flatMap((id) => next.find((tile) => tile.id === id)?.links ?? []))]
      .filter((id) => next.find((tile) => tile.id === id)?.state === 'solid');
    if (!affected.length) break;

    const affectedSet = new Set(affected);
    next = next.map((tile) => affectedSet.has(tile.id) ? { ...tile, stress: tile.stress + 1 } : tile);
    const falling = affected.filter((id) => {
      const tile = next.find((item) => item.id === id)!;
      if (tile.id === '0:0' && move <= players) return false;
      return tile.stress >= Math.max(1, tile.strength - coldPenalty);
    });
    const fallingSet = new Set(falling);
    next = next.map((tile) => fallingSet.has(tile.id) ? { ...tile, state: 'gone' as const } : tile);
    steps.push({ affected, falling });
    frontier = falling;
  }

  const detached = detachedIds(next).filter((id) => id !== '0:0' || move > players);
  if (detached.length) {
    const detachedSet = new Set(detached);
    next = next.map((tile) => detachedSet.has(tile.id) ? { ...tile, state: 'gone' as const } : tile);
    steps.push({ affected: detached, falling: detached });
  }

  return { final: next, steps };
}
