import { test, expect } from 'vitest';
import { createMatch, neutralPad } from '../../src/sim/setup';
import { dist } from '../../src/sim/vec';
import type { PadInput } from '../../src/sim/types';
import { runTicks, matchConfig } from '../helpers';

const cfg = matchConfig({ human: [true, true] });
const pad = (o: Partial<PadInput>) => ({ ...neutralPad(), ...o });
const playing = () => { const s = createMatch(cfg); runTicks(s, 60); expect(s.phase).toBe('play'); return s; };
test('nobody moves during the kickoff pause', () => {
  const s = createMatch(cfg); const x0 = s.players[4].pos.x;
  runTicks(s, 59, [pad({ moveX: 1 }), neutralPad()]);
  expect(s.players[4].pos.x).toBe(x0);
});
test('nobody moves on the tick the countdown ends', () => {
  const s = createMatch(cfg); const x0 = s.players[4].pos.x;
  runTicks(s, 60, [pad({ moveX: 1 }), neutralPad()]);
  expect(s.phase).toBe('play'); expect(s.players[4].pos.x).toBe(x0);
});
test('runs at 60 units per second', () => {
  const s = playing(); const x0 = s.players[4].pos.x;
  runTicks(s, 60, [pad({ moveX: 1 }), neutralPad()]);
  expect(s.players[4].pos.x - x0).toBeCloseTo(60, 1);
  expect(s.players[4].vel).toEqual({ x: 60, y: 0 }); expect(s.players[4].facing).toEqual({ x: 1, y: 0 });
});
test('diagonal and oversized stick input is not faster', () => {
  const s = playing(); const p0 = { ...s.players[4].pos };
  runTicks(s, 30, [pad({ moveX: 3, moveY: -3 }), neutralPad()]);
  expect(dist(s.players[4].pos, p0)).toBeCloseTo(30, 1);
});
test('turbo tap: one burst of 90 ticks at 92, costs a third, needs a new press', () => {
  const s = playing(); const x0 = s.players[4].pos.x;
  runTicks(s, 90, [pad({ moveX: 1, turbo: true }), neutralPad()]);   // held the whole time
  expect(s.players[4].pos.x - x0).toBeCloseTo(92 * 1.5, 0);
  expect(s.turbo[0]).toBeGreaterThan(0.66); expect(s.turbo[0]).toBeLessThan(0.8);
  expect(s.players[4].turboTicks).toBe(0);
});
test('no burst when the meter is under a third', () => {
  const s = playing(); s.turbo[0] = 0.2;
  runTicks(s, 1, [pad({ moveX: 1, turbo: true }), neutralPad()]);
  expect(s.players[4].turboTicks).toBe(0);
});
test('players stay on the pitch', () => {
  const s = playing();
  runTicks(s, 600, [pad({ moveX: -1, moveY: -1 }), neutralPad()]);
  expect(s.players[4].pos).toEqual({ x: 4, y: 4 });
});
test('holding turbo after a burst does nothing; a fresh press starts a new burst', () => {
  const s = playing();
  const held = [pad({ moveX: 1, turbo: true }), neutralPad()] as [PadInput, PadInput];
  runTicks(s, 90, held);
  expect(s.players[4].turboTicks).toBe(0);
  const meter = s.turbo[0];
  runTicks(s, 30, held);
  expect(s.players[4].turboTicks).toBe(0);
  expect(s.turbo[0]).toBeGreaterThan(meter);
  runTicks(s, 1, [pad({ moveX: 1 }), neutralPad()]);
  const before = s.turbo[0];
  runTicks(s, 1, held);
  expect(s.players[4].turboTicks).toBe(89);
  expect(before - s.turbo[0]).toBeCloseTo(1 / 3 - 1 / 720, 5);
});
test('keepers run at 40 units per second, outfield players at 60', () => {
  const s = playing(); s.controlled[0] = 0; const y0 = s.players[0].pos.y;
  runTicks(s, 60, [pad({ moveY: 1, turbo: true }), neutralPad()]);
  expect(s.players[0].pos.y - y0).toBeCloseTo(40, 1);
  expect(s.turbo[0]).toBe(1); // a keeper cannot start a turbo burst
  const o = playing(); const x0 = o.players[4].pos.x;
  runTicks(o, 60, [pad({ moveX: 1 }), neutralPad()]);
  expect(o.players[4].pos.x - x0).toBeCloseTo(60, 1);
});
