import { test, expect } from 'vitest';
import { nextRandom } from '../../src/sim/rng';

test('same seed gives the same sequence, in [0,1)', () => {
  const a = { rng: 42 }, b = { rng: 42 };
  const xs = Array.from({ length: 100 }, () => nextRandom(a));
  expect(Array.from({ length: 100 }, () => nextRandom(b))).toEqual(xs);
  expect(xs.every(x => x >= 0 && x < 1)).toBe(true);
  expect(new Set(xs).size).toBeGreaterThan(95);
});
