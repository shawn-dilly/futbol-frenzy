import { expect, test } from 'vitest';
import { DAZED_BLINK_TICKS, bigHitReady, chargeFill, chargeJustStarted, dazedMarkerVisible } from '../../src/game/indicators';
import { BIG_HIT_CHARGE_TICKS, DAZED_HEALTH, MAX_HEALTH, TURBO_COST, createMatch, type PlayerState } from '../../src/sim';

const player = (): PlayerState => createMatch({ seed: 1, halfSeconds: 120, human: [true, false] }).players[4];

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

test('a big hit is ready only when charged enough and the turbo meter can pay for it', () => {
  const p = player(); p.status = { kind: 'charging' };
  p.statusTick = BIG_HIT_CHARGE_TICKS - 1; expect(bigHitReady(p, TURBO_COST)).toBe(false);
  p.statusTick = BIG_HIT_CHARGE_TICKS;
  expect(bigHitReady(p, TURBO_COST)).toBe(true);
  expect(bigHitReady(p, TURBO_COST - 0.01)).toBe(false);
  p.status = { kind: 'free' }; expect(bigHitReady(p, TURBO_COST)).toBe(false);
});

test('the charge sound starts on the step a charge begins, once', () => {
  const p = player();
  expect(chargeJustStarted(false, p)).toBe(false);
  p.status = { kind: 'charging' };
  expect(chargeJustStarted(false, p)).toBe(true);
  expect(chargeJustStarted(true, p)).toBe(false);
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
