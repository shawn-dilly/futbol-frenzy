import { expect, test } from 'vitest';
import { FixedStepper } from '../../src/game/loop';

test('one step per 16.67 ms, remainder carried', () => {
  const s = new FixedStepper(); expect(s.advance(16)).toBe(0); expect(s.advance(1)).toBe(1); expect(s.advance(50)).toBe(3);
});
test('a ten-second stall runs 5 steps and drops the rest', () => {
  const s = new FixedStepper(); expect(s.advance(10_000)).toBe(5); expect(s.advance(1)).toBe(0); expect(s.advance(16.7)).toBe(1);
});
test('reset drops the accumulated remainder', () => {
  const s = new FixedStepper(); s.advance(16); s.reset(); expect(s.advance(1)).toBe(0);
});

test('freeze(6) skips exactly the next 6 steps, then runs at the normal rate with no burst', () => {
  const s = new FixedStepper(); s.freeze(6);
  const ran: number[] = [];
  for (let frame = 0; frame < 10; frame++) ran.push(s.advance(1000 / 60)); // ten frames of exactly one step
  expect(ran).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1]);
});
test('a freeze spans a long frame: the skipped steps are consumed, the rest run', () => {
  const s = new FixedStepper(); s.freeze(6);
  expect(s.advance(1000 / 60 * 4)).toBe(0); expect(s.advance(1000 / 60 * 4)).toBe(2); expect(s.advance(1000 / 60 * 3)).toBe(3);
});
test('a second freeze adds to the remaining one', () => {
  const s = new FixedStepper(); s.freeze(2); s.freeze(3);
  expect(s.advance(1000 / 60 * 5)).toBe(0); expect(s.advance(1000 / 60)).toBe(1);
});

/** Runs `frames` frames of `frameMs`; a hit on sim step number `hitStep` (counting steps run) freezes for `ticks`. Returns sim steps run. */
function simStepsRun(frameMs: number, frames: number, hit: { step: number; ticks: number } | null): number {
  const s = new FixedStepper(); let run = 0; let hitDone = hit === null;
  for (let f = 0; f < frames; f++) {
    const steps = s.advance(frameMs);
    for (let i = 0; i < steps; i++) {
      run++;
      if (!hitDone && run === hit!.step) { s.freeze(hit!.ticks, steps - i - 1); hitDone = true; break; }
    }
  }
  return run;
}
test('hit-stop costs exactly freezeTicks sim steps at 60 fps, 30 fps and after a stall', () => {
  for (const frameMs of [1000 / 60, 1000 / 30, 1000 / 12]) {
    const frames = 120;
    expect(simStepsRun(frameMs, frames, null) - simStepsRun(frameMs, frames, { step: 11, ticks: 6 }), `frame ${frameMs.toFixed(1)} ms`).toBe(6);
  }
});
test('a hit-stop on the first step of a stalled five-step frame costs exactly its ticks', () => {
  const s = new FixedStepper();
  expect(s.advance(10_000)).toBe(5); // a stall: 5 steps owed
  s.freeze(6, 4); // hit on the first of those 5 steps: 4 are still owed and dropped
  const next = [s.advance(1000 / 60), s.advance(1000 / 60), s.advance(1000 / 60)];
  expect(next).toEqual([0, 0, 1]); // 4 dropped + 2 frozen = 6
});
test('a freeze shorter than the steps still owed adds nothing', () => {
  const s = new FixedStepper(); s.freeze(2, 4);
  expect(s.advance(1000 / 60)).toBe(1);
});
test('reset clears a freeze', () => {
  const s = new FixedStepper(); s.freeze(6); s.reset();
  expect(s.advance(1000 / 60)).toBe(1);
});
