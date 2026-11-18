import { expect, test } from 'vitest';
import { HIT_FEEDBACK } from '../../src/game/hitFeedback';
import {
  DEPTH, HUD_BAR_H, CAMERA_MAX_X, CAMERA_MIN_X, MAX_SHAKE_PX, CALLOUT_MAX_W, PITCH_MARGIN_PX, PITCH_TEX_H, PITCH_TEX_W, RAGE_FLASH_AT, SCREEN_H, SCREEN_W, pitchImagePos, arcLift, blinkOn, isRageFlashing, rageBarWidth, FULLTIME_RESTART_DELAY_TICKS, TEAM_NAMES, canRestart, cameraTarget, fullTimeLines, formatClock, nextFlip, turboPips, worldToScreen,
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
test('draw order: pitch, crater, shadow, ball, marker, controls, HUD, flash', () => {
  const d = DEPTH;
  const order = [d.pitch, d.crater, d.shadow, d.ball, d.marker, d.controls, d.callout, d.hud, d.flash];
  expect(order).toEqual([...order].sort((a, b) => a - b));
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

test('arcLift is 0 at the start, peaks at half the air time, and is 0 at and after the air time', () => {
  expect(arcLift(22, 0, 100)).toBe(0);
  expect(arcLift(22, 50, 100)).toBeCloseTo(22, 10);
  expect(arcLift(30, 25, 100)).toBeCloseTo(30 * Math.sin(Math.PI / 4), 10);
  expect(arcLift(22, 100, 100)).toBe(0);
  expect(arcLift(22, 160, 100)).toBe(0);
});
test('arcLift is zero without an arc or without air time', () => {
  expect(arcLift(undefined, 40, 100)).toBe(0);
  expect(arcLift(22, 40, 0)).toBe(0);
});

test('rage bar width is proportional, clamped, and whole pixels', () => {
  expect([0, 50, 100].map(r => rageBarWidth(r, 60))).toEqual([0, 30, 60]);
  expect(rageBarWidth(33, 60)).toBe(20); expect(rageBarWidth(-5, 60)).toBe(0); expect(rageBarWidth(140, 60)).toBe(60);
});
test('rage flashes from RAGE_FLASH_AT up', () => {
  expect(RAGE_FLASH_AT).toBe(80);
  expect(isRageFlashing(79.9)).toBe(false); expect(isRageFlashing(80)).toBe(true); expect(isRageFlashing(100)).toBe(true);
});
test('blinkOn alternates on and off every period, starting on', () => {
  expect([0, 5, 6, 11, 12].map(t => blinkOn(t, 6))).toEqual([true, true, false, false, true]);
});

test('the pitch image has a margin as wide as the biggest shake, so no edge shows while shaking', () => {
  expect(PITCH_MARGIN_PX).toBe(MAX_SHAKE_PX);
  for (const [tier, fb] of Object.entries(HIT_FEEDBACK)) expect(fb.shakePx, tier).toBeLessThanOrEqual(MAX_SHAKE_PX);
  for (const camX of [CAMERA_MIN_X, CAMERA_MAX_X]) {
    for (const dx of [-PITCH_MARGIN_PX, PITCH_MARGIN_PX]) {
      const { x } = pitchImagePos(camX, { x: dx, y: 0 });
      expect(x, `left, cam ${camX}, shake ${dx}`).toBeLessThanOrEqual(0);
      expect(x + PITCH_TEX_W, `right, cam ${camX}, shake ${dx}`).toBeGreaterThanOrEqual(SCREEN_W);
    }
  }
  expect(pitchImagePos(0, { x: 0, y: -PITCH_MARGIN_PX }).y + PITCH_TEX_H).toBeGreaterThanOrEqual(SCREEN_H); // bottom
  expect(PITCH_MARGIN_PX).toBeLessThanOrEqual(HUD_BAR_H); // a shake down leaves a gap only under the top bar
});

test('a callout line may be as wide as the screen less a 4 px margin each side', () => { expect(CALLOUT_MAX_W).toBe(312); });

test('deliberate off-ball framing leaves tackle room on either side', () => {
  expect(cameraTarget(54)).toBe(CAMERA_MIN_X);
  expect(cameraTarget(54, 371)).toBe(85);
  expect(cameraTarget(426, 109)).toBe(75);
  expect(cameraTarget(240, 220)).toBe(80);
});
