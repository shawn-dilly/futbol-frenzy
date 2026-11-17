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
