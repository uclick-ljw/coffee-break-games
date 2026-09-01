export const LUNCH_WIDTH = 320;
export const LUNCH_HEIGHT = 220;
export const LUNCH_TURN_MS = 25_000;

export type LunchFood = {
  id: string;
  name: string;
  emoji: string;
  width: number;
  height: number;
  color: string;
};

export type LunchPlacement = {
  id: string;
  x: number;
  y: number;
  rotated: boolean;
};

export type LunchResult = {
  player: number;
  area: number;
  placed: number;
  elapsedMs: number;
  score: number;
};

export const LUNCH_FOODS: LunchFood[] = [
  { id: 'gimbap-a', name: '김밥', emoji: '🍙', width: 52, height: 52, color: '#254f42' },
  { id: 'gimbap-b', name: '꼬마김밥', emoji: '🍙', width: 48, height: 48, color: '#34705b' },
  { id: 'tofu', name: '유부초밥', emoji: '🍣', width: 64, height: 54, color: '#d79632' },
  { id: 'egg', name: '계란말이', emoji: '🍳', width: 92, height: 42, color: '#efbd3d' },
  { id: 'dumpling', name: '만두', emoji: '🥟', width: 76, height: 46, color: '#e3b96f' },
  { id: 'sausage', name: '소시지', emoji: '🌭', width: 100, height: 30, color: '#cf5a42' },
  { id: 'broccoli', name: '브로콜리', emoji: '🥦', width: 56, height: 54, color: '#4f913f' },
  { id: 'rice', name: '주먹밥', emoji: '🍚', width: 66, height: 62, color: '#e8dfce' },
  { id: 'tomato-a', name: '방울토마토', emoji: '🍅', width: 42, height: 42, color: '#dd4a3c' },
  { id: 'tomato-b', name: '꼬마토마토', emoji: '🍅', width: 38, height: 38, color: '#ef6956' },
  { id: 'patty', name: '떡갈비', emoji: '🥩', width: 78, height: 56, color: '#8b4b34' },
];

const DIVIDERS = [
  { x: 204, y: 0, width: 8, height: 220 },
  { x: 204, y: 106, width: 116, height: 8 },
];

export function foodRect(placement: LunchPlacement) {
  const food = LUNCH_FOODS.find((item) => item.id === placement.id)!;
  return {
    x: placement.x,
    y: placement.y,
    width: placement.rotated ? food.height : food.width,
    height: placement.rotated ? food.width : food.height,
  };
}

function overlaps(a: ReturnType<typeof foodRect>, b: ReturnType<typeof foodRect>, gap = 4) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

export function isValidLunchPlacement(candidate: LunchPlacement, placed: LunchPlacement[]) {
  const rect = foodRect(candidate);
  if (rect.x < 4 || rect.y < 4 || rect.x + rect.width > LUNCH_WIDTH - 4 || rect.y + rect.height > LUNCH_HEIGHT - 4) return false;
  if (DIVIDERS.some((divider) => overlaps(rect, divider, 2))) return false;
  return placed.every((item) => item.id === candidate.id || !overlaps(rect, foodRect(item)));
}

export function lunchResult(player: number, placed: LunchPlacement[], elapsedMs: number): LunchResult {
  const area = placed.reduce((sum, placement) => {
    const food = LUNCH_FOODS.find((item) => item.id === placement.id)!;
    return sum + food.width * food.height;
  }, 0);
  const totalArea = LUNCH_FOODS.reduce((sum, food) => sum + food.width * food.height, 0);
  const speed = Math.max(0, LUNCH_TURN_MS - elapsedMs);
  return { player, area, placed: placed.length, elapsedMs, score: Math.round(area / totalArea * 900 + speed / 1000 * 4) };
}

export function rankLunchResults(results: LunchResult[]) {
  return [...results].sort((a, b) => b.area - a.area || b.placed - a.placed || a.elapsedMs - b.elapsedMs || a.player - b.player);
}
