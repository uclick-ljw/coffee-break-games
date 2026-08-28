import assert from 'node:assert/strict';
import { CURVE_SHAPES, curveTemplate, pathIsLongEnough, rankCurves, scoreCurve, type CurvePoint } from '../app/circle-game.ts';

for (const shape of CURVE_SHAPES) {
  const template = curveTemplate(shape, 121);
  const perfect = scoreCurve(0, shape, template);
  const shifted = template.map(({ x, y }) => ({ x: x + 0.16, y }));
  assert.ok(perfect.score >= 98, `${shape} template should score near 100`);
  assert.ok(scoreCurve(1, shape, shifted).score < perfect.score, `${shape} must penalize misplaced strokes`);
  assert.equal(pathIsLongEnough(template), true);
}

const circle = curveTemplate('circle', 121);
const flatCircle = circle.map(({ x, y }) => ({ x, y: 0.5 + (y - 0.5) * 0.45 }));
const perfect = scoreCurve(0, 'circle', circle);
const flat = scoreCurve(1, 'circle', flatCircle);
assert.ok(flat.score < perfect.score);
assert.equal(pathIsLongEnough([{ x: 0.5, y: 0.5 } as CurvePoint]), false);
assert.deepEqual(rankCurves([flat, perfect]).map((result) => result.player), [0, 1]);
console.log('curve checks passed');
