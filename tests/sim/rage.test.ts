import { test, expect } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { addRage, decayRage, hitDamage, rageAfterHit, tierFor } from '../../src/sim/rage';
import { RAGE_DECAY_DELAY_TICKS } from '../../src/sim/constants';

const match = () => createMatch({ seed: 1, halfSeconds: 120, human: [true, false] });

test('damage scales with rage and turbo', () => {
  expect(hitDamage('shoulder', 0, false)).toBeCloseTo(10, 9);
  expect(hitDamage('shoulder', 100, false)).toBeCloseTo(25, 9);
  expect(hitDamage('slide', 0, false)).toBeCloseTo(16, 9);
  expect(hitDamage('slide', 100, true)).toBeCloseTo(48, 9);
  expect(hitDamage('big', 0, false)).toBeCloseTo(24, 9);
  expect(hitDamage('big', 50, false)).toBeCloseTo(42, 9);
  expect(hitDamage('big', 100, false)).toBeCloseTo(60, 9);
});
test('tiers map to the documented tiers at the boundaries', () => {
  expect(tierFor(10)).toBe('stumble');
  expect(tierFor(14.99)).toBe('stumble');
  expect(tierFor(15)).toBe('knockdown');
  expect(tierFor(24)).toBe('knockdown');
  expect(tierFor(29.99)).toBe('knockdown');
  expect(tierFor(30)).toBe('wipeout');
  expect(tierFor(42)).toBe('wipeout');
  expect(tierFor(44.99)).toBe('wipeout');
  expect(tierFor(45)).toBe('overTheTop');
  expect(tierFor(60)).toBe('overTheTop');
});
test('addRage clamps to 0..100', () => {
  const s = match();
  addRage(s, 0, 150); expect(s.rage[0]).toBe(100);
  addRage(s, 0, -500); expect(s.rage[0]).toBe(0);
});
test('a knockdown gives the tackler 14 and the victim team 6', () => {
  const s = match();
  rageAfterHit(s, 0, 'knockdown');
  expect(s.rage).toEqual([14, 6]);
  expect(s.lastHitTick[0]).toBe(s.tick);
});
test('a wipeout from 90 rage clamps to 100 then spends 30', () => {
  const s = match(); s.rage[0] = 90;
  rageAfterHit(s, 0, 'wipeout');
  expect(s.rage[0]).toBe(70);
});
test('an over-the-top also spends 30', () => {
  const s = match(); s.rage[1] = 50;
  rageAfterHit(s, 1, 'overTheTop');
  expect(s.rage[1]).toBe(42); expect(s.rage[0]).toBe(6);
});
test('rage holds for 360 ticks after the last landed hit, then loses 2 over 60 ticks, never below 0', () => {
  const s = match(); s.rage = [50, 1]; s.lastHitTick = [100, 100];
  s.tick = 100 + RAGE_DECAY_DELAY_TICKS - 1;
  decayRage(s);
  expect(s.rage).toEqual([50, 1]);
  for (let t = 0; t < 60; t++) { s.tick = 100 + RAGE_DECAY_DELAY_TICKS + t; decayRage(s); }
  expect(s.rage[0]).toBeCloseTo(48, 9);
  for (let t = 60; t < 300; t++) { s.tick = 100 + RAGE_DECAY_DELAY_TICKS + t; decayRage(s); }
  expect(s.rage[1]).toBe(0);
});
