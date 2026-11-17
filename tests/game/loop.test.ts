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
