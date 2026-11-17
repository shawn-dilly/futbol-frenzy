import { test, expect } from 'vitest';
import { add, sub, scale, len, dist, norm, clampLen, angleBetween, clamp, rotate } from '../../src/sim/vec';

test('add, sub, scale return new vectors and leave inputs alone', () => {
  const a = { x: 1, y: 2 }, b = { x: 3, y: 5 };
  expect(add(a, b)).toEqual({ x: 4, y: 7 });
  expect(sub(b, a)).toEqual({ x: 2, y: 3 });
  expect(scale(a, 3)).toEqual({ x: 3, y: 6 });
  expect(a).toEqual({ x: 1, y: 2 }); expect(b).toEqual({ x: 3, y: 5 });
});
test('len and dist', () => {
  expect(len({ x: 3, y: 4 })).toBe(5);
  expect(dist({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(5);
});
test('norm of zero stays zero; otherwise unit length', () => {
  expect(norm({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  expect(norm({ x: 0, y: 5 })).toEqual({ x: 0, y: 1 });
});
test('clampLen shortens long vectors and keeps short ones', () => {
  expect(clampLen({ x: 6, y: 8 }, 5)).toEqual({ x: 3, y: 4 });
  expect(clampLen({ x: 1, y: 1 }, 5)).toEqual({ x: 1, y: 1 });
});
test('angleBetween is 0 for parallel and PI for opposite', () => {
  expect(angleBetween({ x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(0);
  expect(angleBetween({ x: 1, y: 0 }, { x: -3, y: 0 })).toBeCloseTo(Math.PI);
  expect(angleBetween({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2);
});
test('angleBetween with a zero vector is 0', () => {
  expect(angleBetween({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
  expect(angleBetween({ x: 1, y: 0 }, { x: 0, y: 0 })).toBe(0);
});
test('clamp limits a number to a range', () => {
  expect(clamp(5, 0, 10)).toBe(5); expect(clamp(-1, 0, 10)).toBe(0); expect(clamp(11, 0, 10)).toBe(10);
});
test('rotate turns +x toward +y for a positive angle and keeps length', () => {
  const r = rotate({ x: 1, y: 0 }, Math.PI / 2);
  expect(r.x).toBeCloseTo(0, 12); expect(r.y).toBeCloseTo(1, 12);
  const q = rotate({ x: 3, y: 4 }, 0.7);
  expect(len(q)).toBeCloseTo(5, 12);
  expect(rotate({ x: 3, y: 4 }, 0)).toEqual({ x: 3, y: 4 });
});
