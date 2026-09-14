import { rankResults } from './ranking.ts';

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

export type LunchDivider = { x: number; y: number; width: number; height: number };
export type LunchLayout = { id: string; name: string; dividers: LunchDivider[] };

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

export const LUNCH_PICK_COUNT = 15;

export const LUNCH_FOODS: LunchFood[] = [
  { id: 'gimbap-a', name: '김밥', emoji: '🍙', width: 64, height: 64, color: '#254f42' },
  { id: 'gimbap-b', name: '꼬마김밥', emoji: '🍙', width: 59, height: 59, color: '#34705b' },
  { id: 'tofu', name: '유부초밥', emoji: '🍣', width: 78, height: 66, color: '#d79632' },
  { id: 'egg', name: '계란말이', emoji: '🍳', width: 113, height: 51, color: '#efbd3d' },
  { id: 'dumpling', name: '만두', emoji: '🥟', width: 93, height: 56, color: '#e3b96f' },
  { id: 'sausage', name: '소시지', emoji: '🌭', width: 123, height: 37, color: '#cf5a42' },
  { id: 'broccoli', name: '브로콜리', emoji: '🥦', width: 69, height: 66, color: '#4f913f' },
  { id: 'rice', name: '주먹밥', emoji: '🍚', width: 81, height: 76, color: '#e8dfce' },
  { id: 'tomato-a', name: '방울토마토', emoji: '🍅', width: 51, height: 51, color: '#dd4a3c' },
  { id: 'tomato-b', name: '꼬마토마토', emoji: '🍅', width: 47, height: 47, color: '#ef6956' },
  { id: 'patty', name: '떡갈비', emoji: '🥩', width: 96, height: 69, color: '#8b4b34' },
  { id: 'chicken', name: '닭다리', emoji: '🍗', width: 117, height: 85, color: '#a85d32' },
  { id: 'shrimp', name: '새우튀김', emoji: '🍤', width: 137, height: 51, color: '#e4873f' },
  { id: 'fishcake', name: '어묵꼬치', emoji: '🍢', width: 117, height: 49, color: '#ca783e' },
  { id: 'salad', name: '샐러드', emoji: '🥗', width: 93, height: 88, color: '#5c9146' },
  { id: 'cheese', name: '치즈', emoji: '🧀', width: 88, height: 71, color: '#d8a72f' },
  { id: 'cucumber', name: '오이', emoji: '🥒', width: 110, height: 41, color: '#418b56' },
  { id: 'sandwich', name: '샌드위치', emoji: '🥪', width: 112, height: 88, color: '#bd7d45' },
  { id: 'grape', name: '포도', emoji: '🍇', width: 71, height: 81, color: '#7d5798' },
  { id: 'croquette', name: '고로케', emoji: '🥔', width: 100, height: 71, color: '#a87845' },
];

export const LUNCH_LAYOUTS: LunchLayout[] = [
  { id: 'l-right', name: '오른쪽 두 칸', dividers: [{ x: 204, y: 0, width: 8, height: 220 }, { x: 204, y: 106, width: 116, height: 8 }] },
  { id: 'l-left', name: '왼쪽 두 칸', dividers: [{ x: 108, y: 0, width: 8, height: 220 }, { x: 0, y: 106, width: 116, height: 8 }] },
  { id: 'cross', name: '네 칸 도시락', dividers: [{ x: 156, y: 0, width: 8, height: 220 }, { x: 0, y: 106, width: 320, height: 8 }] },
  { id: 'stairs', name: '계단 네 칸', dividers: [{ x: 0, y: 106, width: 320, height: 8 }, { x: 204, y: 0, width: 8, height: 114 }, { x: 108, y: 106, width: 8, height: 114 }] },
];

export function pickLunchFoods(random = Math.random) {
  const foods = [...LUNCH_FOODS];
  for (let index = foods.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [foods[index], foods[swap]] = [foods[swap], foods[index]];
  }
  return foods.slice(0, LUNCH_PICK_COUNT);
}

export function pickLunchLayout(random = Math.random) {
  return LUNCH_LAYOUTS[Math.floor(random() * LUNCH_LAYOUTS.length)];
}

export function foodRect(placement: LunchPlacement) {
  const food = LUNCH_FOODS.find((item) => item.id === placement.id)!;
  return {
    x: placement.x,
    y: placement.y,
    width: placement.rotated ? food.height : food.width,
    height: placement.rotated ? food.width : food.height,
  };
}

function overlaps(a: ReturnType<typeof foodRect>, b: ReturnType<typeof foodRect>, gap = 1) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

export function isValidLunchPlacement(candidate: LunchPlacement, placed: LunchPlacement[], dividers: LunchDivider[]) {
  const rect = foodRect(candidate);
  if (rect.x < 2 || rect.y < 2 || rect.x + rect.width > LUNCH_WIDTH - 2 || rect.y + rect.height > LUNCH_HEIGHT - 2) return false;
  if (dividers.some((divider) => overlaps(rect, divider))) return false;
  return placed.every((item) => item.id === candidate.id || !overlaps(rect, foodRect(item)));
}

export function lunchResult(player: number, placed: LunchPlacement[], elapsedMs: number): LunchResult {
  const area = placed.reduce((sum, placement) => {
    const food = LUNCH_FOODS.find((item) => item.id === placement.id)!;
    return sum + food.width * food.height;
  }, 0);
  return { player, area, placed: placed.length, elapsedMs, score: Math.round(area / (LUNCH_WIDTH * LUNCH_HEIGHT) * 1000) };
}

export function rankLunchResults(results: LunchResult[]) {
  return rankResults(results, (a, b) => b.area - a.area || Math.round(a.elapsedMs / 100) - Math.round(b.elapsedMs / 100));
}
