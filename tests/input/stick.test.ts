import { expect, test } from 'vitest';
import { buttonAt, stickVector } from '../../src/input/stick';

test('deadzone, scaling, and clamping', () => {
  const o = { x: 40, y: 140 };
  expect(stickVector(o, { x: 43, y: 140 })).toEqual({ x: 0, y: 0 });
  const half = stickVector(o, { x: 53, y: 140 }); expect(half.x).toBeGreaterThan(0.3); expect(half.x).toBeLessThan(0.6); expect(half.y).toBe(0);
  const far = stickVector(o, { x: 140, y: 240 }); expect(Math.hypot(far.x, far.y)).toBeCloseTo(1, 5); expect(far.x).toBeCloseTo(far.y, 5);
});
test('button hit areas', () => {
  expect(buttonAt({ x: 248, y: 150 })).toBe('pass'); expect(buttonAt({ x: 290, y: 118 })).toBe('shoot');
  expect(buttonAt({ x: 222, y: 166 })).toBe('turbo'); expect(buttonAt({ x: 160, y: 90 })).toBeNull();
});
test('hit area is the radius plus 4 and the nearest centre wins on overlap', () => {
  expect(buttonAt({ x: 248 + 17, y: 150 })).toBe('pass');
  expect(buttonAt({ x: 248 + 17.5, y: 150 })).toBeNull();
  // between pass (248,150) and turbo (222,166): closer to turbo
  expect(buttonAt({ x: 232, y: 160 })).toBe('turbo');
});
