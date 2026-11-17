import { expect, test } from 'vitest';
import {
  CRATER_TIER, CRATER_VARIANT, FLASH_MS, FLASH_PEAK_ALPHA, HIT_FEEDBACK, STAR_BURST,
  craterLandTicks, flashAlpha, shakeOffset, shakeRemainingPx, starOffsets, strongerShake,
} from '../../src/game/hitFeedback';

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

test('remaining shake falls linearly to zero', () => {
  const sh = { startMs: 100, px: 6, ms: 400 };
  expect([100, 300, 500, 900].map(t => shakeRemainingPx(sh, t))).toEqual([6, 3, 0, 0]);
});
test('a new shake replaces the running one only when it has more left', () => {
  const big = { startMs: 0, px: 6, ms: 400 }, small = { startMs: 100, px: 1, ms: 80 }, mid = { startMs: 300, px: 4, ms: 250 };
  expect(strongerShake(big, small, 100)).toBe(big); // a stumble does not cut an over-the-top shake short
  expect(strongerShake(small, big, 100)).toBe(big);
  expect(strongerShake(big, mid, 300)).toBe(mid); // big has 1.5 left, mid has 4
  expect(strongerShake(null, small, 100)).toBe(small);
  expect(strongerShake({ startMs: 0, px: 2, ms: 50 }, small, 1000)).toBe(small); // the old one is long over
});

test('the star burst flies out from the centre, slows down, and ends', () => {
  expect(STAR_BURST.ms).toBe(400);
  expect(starOffsets(0)).toEqual(Array.from({ length: STAR_BURST.count }, () => ({ x: 0, y: 0 })));
  // half way: eased reach is 16 x 0.75 = 12; star 0 is straight up, star 3 straight down
  const mid = starOffsets(200);
  expect(mid[0]).toEqual({ x: 0, y: -12 }); expect(mid[3]).toEqual({ x: 0, y: 12 });
  expect(mid[1]).toEqual({ x: 10, y: -6 });
  expect(starOffsets(399)[0].y).toBe(-16);
  expect(starOffsets(400)).toEqual([]); expect(starOffsets(5000)).toEqual([]);
});
