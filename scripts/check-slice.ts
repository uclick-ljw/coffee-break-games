import assert from 'node:assert/strict';
import { SLICE_SHAPES, makeSliceChallenges, polygonArea, projectSlicePoint, rankSlices, scoreSlice, splitPolygon, unprojectSlicePoint } from '../app/slice-game.ts';

function isConvex(points: { x: number; y: number }[]) {
  let sign = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const c = points[(index + 2) % points.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-8) continue;
    if (sign && Math.sign(cross) !== sign) return false;
    sign = Math.sign(cross);
  }
  return true;
}

assert.equal(SLICE_SHAPES.length, 8);
for (const shape of SLICE_SHAPES) {
  assert(isConvex(shape.points), `${shape.name} must stay convex for exact clipping`);
  const split = splitPolygon(shape.points, { x: .5, y: 0 }, { x: .5, y: 1 });
  assert(Math.abs(polygonArea(split.first) + polygonArea(split.second) - polygonArea(shape.points)) < 1e-8);
}

const challenges = makeSliceChallenges(6, 20260831);
assert.equal(new Set(challenges.map((shape) => shape.id)).size, 6, 'six players should receive six different objects');
for (const challenge of challenges) {
  assert(challenge.viewTilt >= .56 && challenge.viewTilt <= .66);
  assert(challenge.viewPerspective >= .38 && challenge.viewPerspective <= .52);
  for (const point of challenge.transformed) {
    const restored = unprojectSlicePoint(projectSlicePoint(point, challenge), challenge);
    assert(Math.hypot(restored.x - point.x, restored.y - point.y) < 1e-10, '3D view must map a touch back to the exact surface point');
  }
}
const invalid = scoreSlice(0, challenges[0], { x: .1, y: .1 }, { x: .18, y: .15 });
assert.equal(invalid, null, 'a tiny swipe must not count as a cut');
const valid = scoreSlice(0, challenges[0], { x: 0, y: .5 }, { x: 1, y: .5 });
assert(valid && valid.left + valid.right > 99.999 && valid.left + valid.right < 100.001);
const ranking = rankSlices([{ ...valid, player: 1, score: 200 }, { ...valid, player: 0, score: 900 }]);
assert.deepEqual(ranking.map((result) => result.player), [0, 1]);

console.log('slice game checks passed: 8 shapes, exact area split, reversible 3D projection, valid ranking');
