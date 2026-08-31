import assert from 'node:assert/strict';
import { makeParkingCourse, makeParkingState, parkingOutcome, stepParking } from '../app/parking-game.ts';

function run(targetLeft: boolean, steerOut: number, turnAt: number, straightenAt: number, releaseAt: number) {
  const course = makeParkingCourse(targetLeft ? 2 : 1);
  const state = makeParkingState();
  const direction = targetLeft ? -1 : 1;
  for (let step = 0; step < 2000; step += 1) {
    const time = step / 120;
    const steering = time < turnAt ? direction * steerOut : time < straightenAt ? -direction * steerOut : 0;
    stepParking(state, { driving: time < releaseAt, steering }, 1 / 120, course);
    const outcome = parkingOutcome(state, course);
    if (outcome) return outcome;
  }
  throw new Error('simulation did not finish');
}

let best = null as ReturnType<typeof run> | null;
for (const steer of [0.55, 0.7, 0.85, 1]) {
  for (let turnAt = 0.45; turnAt <= 1.25; turnAt += 0.1) {
    for (let straightenAt = turnAt + 0.2; straightenAt <= 1.75; straightenAt += 0.1) {
      for (let releaseAt = 1.3; releaseAt <= 2.4; releaseAt += 0.05) {
        const result = run(true, steer, turnAt, straightenAt, releaseAt);
        if (!best || result.score > best.score) best = result;
      }
    }
  }
}

assert(best?.parked, 'a skilled steering path must reach the parking slot');
assert(best.score >= 700, 'a clean park must earn a strong score');
const earlyBrake = run(true, 0.8, 0.7, 1.1, 0.7);
assert(!earlyBrake.parked && earlyBrake.score < best.score, 'braking too early must lose points');
const crash = run(false, 0, 0, 0, 3);
assert(!crash.parked && crash.reason.includes('부딪혔어요'), 'driving into an occupied middle slot must crash');
assert.equal(makeParkingCourse(2).targetIndex, 0);
assert.equal(makeParkingCourse(3).targetIndex, 2);

console.log(`parking check passed: best ${best.score}, early ${earlyBrake.score}, crash ${crash.score}`);
