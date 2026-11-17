import { expect, test } from 'vitest';
import {
  DEPTH, FULLTIME_RESTART_DELAY_TICKS, TEAM_NAMES, canRestart, cameraTarget, fullTimeLines, formatClock, nextFlip, turboPips, worldToScreen,
} from '../../src/game/layout';

test('camera follows the ball and stops at both ends', () => {
  expect(cameraTarget(240)).toBe(80); expect(cameraTarget(0)).toBe(-16); expect(cameraTarget(480)).toBe(176);
});
test('world to screen', () => { expect(worldToScreen({ x: 240, y: 62 }, 80)).toEqual({ x: 160, y: 112 }); });
test('clock text', () => {
  expect(formatClock(7200)).toBe('2:00'); expect(formatClock(7199)).toBe('2:00'); expect(formatClock(7140)).toBe('1:59');
  expect(formatClock(1)).toBe('0:01'); expect(formatClock(0)).toBe('0:00'); expect(formatClock(-5)).toBe('0:00');
});
test('flip follows horizontal facing and keeps the last flip on vertical moves', () => {
  expect(nextFlip(false, -1)).toBe(true); expect(nextFlip(true, 1)).toBe(false);
  expect(nextFlip(true, 0)).toBe(true); expect(nextFlip(false, 0)).toBe(false);
});
test('turbo pips lit by the meter', () => {
  expect([0, 0.33, 1 / 3, 0.5, 2 / 3, 1].map(turboPips)).toEqual([0, 0, 1, 1, 2, 3]);
});
test('draw order: pitch, shadow, ball, marker, controls, HUD', () => {
  const d = DEPTH;
  expect([d.pitch, d.shadow, d.ball, d.marker, d.controls, d.hud]).toEqual([...[d.pitch, d.shadow, d.ball, d.marker, d.controls, d.hud]].sort((a, b) => a - b));
  expect(d.controls).toBeLessThan(d.hud);
});

test('team names live in one table', () => { expect(TEAM_NAMES).toEqual(['RHINOS', 'VIPERS']); });
test('restart is allowed only at full time, once the delay has passed', () => {
  expect(FULLTIME_RESTART_DELAY_TICKS).toBe(120);
  expect(canRestart('play', 1000, 100)).toBe(false);
  expect(canRestart('fulltime', 1000, null)).toBe(false);
  expect(canRestart('fulltime', 100 + FULLTIME_RESTART_DELAY_TICKS - 1, 100)).toBe(false);
  expect(canRestart('fulltime', 100 + FULLTIME_RESTART_DELAY_TICKS, 100)).toBe(true);
  expect(canRestart('fulltime', 5000, 100)).toBe(true);
});
test('full-time banner lines: result always, hint once restart is allowed', () => {
  expect(fullTimeLines([3, 1], false)).toEqual(['FULL TIME', 'RHINOS 3 - 1 VIPERS']);
  expect(fullTimeLines([0, 0], true)).toEqual(['FULL TIME', 'RHINOS 0 - 0 VIPERS', 'TAP TO PLAY AGAIN']);
});
