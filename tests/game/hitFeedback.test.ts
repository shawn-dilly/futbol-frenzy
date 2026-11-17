import { expect, test } from 'vitest';
import {
  CRATER_TIER, CRATER_VARIANT, DAZED_BLINK_TICKS, FLASH_MS, FLASH_PEAK_ALPHA, HIT_FEEDBACK,
  chargeFill, craterLandTicks, dazedMarkerVisible, flashAlpha, shakeOffset,
} from '../../src/game/hitFeedback';
import { BIG_HIT_CHARGE_TICKS, DAZED_HEALTH, MAX_HEALTH, createMatch, type PlayerState } from '../../src/sim';

const player = (): PlayerState => createMatch({ seed: 1, halfSeconds: 120, human: [true, false] }).players[4];

test('hit feedback per tier', () => {
  expect(HIT_FEEDBACK.stumble).toEqual({ sounds: ['thud'], shakePx: 1, shakeMs: 80, freezeTicks: 0, flash: false, stars: false });
  expect(HIT_FEEDBACK.knockdown).toEqual({ sounds: ['thud', 'grunt'], shakePx: 2, shakeMs: 150, freezeTicks: 0, flash: false, stars: false });
  expect(HIT_FEEDBACK.wipeout).toEqual({ sounds: ['crunch', 'grunt', 'ooh'], shakePx: 4, shakeMs: 250, freezeTicks: 6, flash: false, stars: false });
  expect(HIT_FEEDBACK.overTheTop).toEqual({ sounds: ['crunch', 'grunt', 'gasp'], shakePx: 6, shakeMs: 400, freezeTicks: 12, flash: true, stars: true });
});

test('shake decays linearly from full size to nothing', () => {
  const max = () => 1, min = () => 0;
  expect(shakeOffset(0, 4, 250, max)).toEqual({ x: 4, y: 4 });
  expect(shakeOffset(0, 4, 250, min)).toEqual({ x: -4, y: -4 });
  expect(shakeOffset(125, 4, 250, max)).toEqual({ x: 2, y: 2 });
  expect(shakeOffset(125, 4, 250, () => 0.5)).toEqual({ x: 0, y: 0 });
  expect(shakeOffset(250, 4, 250, max)).toEqual({ x: 0, y: 0 });
  expect(shakeOffset(900, 4, 250, max)).toEqual({ x: 0, y: 0 });
});
test('shake uses one random draw per axis', () => {
  const draws = [1, 0]; const r = () => draws.shift() ?? 0.5;
  expect(shakeOffset(0, 6, 400, r)).toEqual({ x: 6, y: -6 });
});

test('flash starts at its peak and fades to nothing over FLASH_MS', () => {
  expect(flashAlpha(0)).toBe(FLASH_PEAK_ALPHA);
  expect(flashAlpha(FLASH_MS / 2)).toBeCloseTo(FLASH_PEAK_ALPHA / 2, 10);
  expect(flashAlpha(FLASH_MS)).toBe(0);
  expect(flashAlpha(FLASH_MS * 3)).toBe(0);
  expect(FLASH_MS).toBe(200);
});

test('only the over-the-top crater variant leaves a crater, landing when the airborne frames end', () => {
  expect([CRATER_TIER, CRATER_VARIANT]).toEqual(['overTheTop', 2]);
  expect(craterLandTicks('overTheTop', 2)).toBe(60); // 5 airborne frames x 12 ticks
  expect(craterLandTicks('overTheTop', 1)).toBeNull();
  expect(craterLandTicks('overTheTop', 0)).toBeNull();
  expect(craterLandTicks('wipeout', 2)).toBeNull();
});

test('charge fill grows over BIG_HIT_CHARGE_TICKS and is zero when not charging', () => {
  const p = player();
  expect(chargeFill(p)).toBe(0);
  p.status = { kind: 'charging' };
  p.statusTick = 0; expect(chargeFill(p)).toBe(0);
  p.statusTick = BIG_HIT_CHARGE_TICKS / 2; expect(chargeFill(p)).toBe(0.5);
  p.statusTick = BIG_HIT_CHARGE_TICKS; expect(chargeFill(p)).toBe(1);
  p.statusTick = BIG_HIT_CHARGE_TICKS * 2; expect(chargeFill(p)).toBe(1);
  p.status = { kind: 'free' }; p.statusTick = 10; expect(chargeFill(p)).toBe(0);
});

test('the dazed marker blinks only on a dazed player', () => {
  const p = player();
  p.health = MAX_HEALTH;
  expect(dazedMarkerVisible(p, 0)).toBe(false);
  p.health = DAZED_HEALTH; expect(dazedMarkerVisible(p, 0)).toBe(false);
  p.health = DAZED_HEALTH - 1;
  expect(dazedMarkerVisible(p, 0)).toBe(true);
  expect(dazedMarkerVisible(p, DAZED_BLINK_TICKS - 1)).toBe(true);
  expect(dazedMarkerVisible(p, DAZED_BLINK_TICKS)).toBe(false);
  expect(dazedMarkerVisible(p, DAZED_BLINK_TICKS * 2)).toBe(true);
});
