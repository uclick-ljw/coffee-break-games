import assert from 'node:assert/strict';
import { pathIsLongEnough, rankCircles, scoreCircle, type CirclePoint } from '../app/circle-game.ts';

const circle = (radius: number, xScale = 1, yScale = 1): CirclePoint[] => Array.from({ length: 121 }, (_, index) => {
  const angle = index / 120 * Math.PI * 2;
  return { x: 0.5 + Math.cos(angle) * radius * xScale, y: 0.5 + Math.sin(angle) * radius * yScale };
});

const perfect = scoreCircle(0, circle(0.33));
const oval = scoreCircle(1, circle(0.33, 1, 0.58));
const tiny = scoreCircle(2, circle(0.07));
assert.equal(perfect.score, 100);
assert.ok(oval.score < perfect.score);
assert.ok(tiny.score < 40);
assert.equal(pathIsLongEnough(circle(0.33)), true);
assert.equal(pathIsLongEnough([{ x: 0.5, y: 0.5 }]), false);
assert.deepEqual(rankCircles([oval, perfect, tiny]).map((result) => result.player), [0, 1, 2]);
console.log('circle checks passed');
