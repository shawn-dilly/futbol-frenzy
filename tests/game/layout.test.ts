import { expect, test } from 'vitest';
import { cameraTarget, formatClock, worldToScreen } from '../../src/game/layout';

test('camera follows the ball and stops at both ends', () => {
  expect(cameraTarget(240)).toBe(80); expect(cameraTarget(0)).toBe(-16); expect(cameraTarget(480)).toBe(176);
});
test('world to screen', () => { expect(worldToScreen({ x: 240, y: 62 }, 80)).toEqual({ x: 160, y: 112 }); });
test('clock text', () => {
  expect(formatClock(7200)).toBe('2:00'); expect(formatClock(7199)).toBe('2:00'); expect(formatClock(7140)).toBe('1:59');
  expect(formatClock(1)).toBe('0:01'); expect(formatClock(0)).toBe('0:00'); expect(formatClock(-5)).toBe('0:00');
});
