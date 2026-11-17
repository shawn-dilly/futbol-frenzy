import { test, expect } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { animFor } from '../../src/game/playerAnim';
import type { PlayerState, PlayerStatus } from '../../src/sim/types';

const cfg = { seed: 1, halfSeconds: 120, human: [true, false] as [boolean, boolean] };
const player = (status: PlayerStatus, statusTick = 0, vel = { x: 0, y: 0 }): PlayerState => {
  const p = createMatch(cfg).players[4]; p.status = status; p.statusTick = statusTick; p.vel = vel; return p;
};

test('free and still is idle on the match tick', () => {
  expect(animFor(player({ kind: 'free' }, 7), 123)).toEqual({ key: 'idle', tick: 123 });
});
test('free and moving is run on the match tick', () => {
  expect(animFor(player({ kind: 'free' }, 7, { x: 60, y: 0 }), 123)).toEqual({ key: 'run', tick: 123 });
  expect(animFor(player({ kind: 'free' }, 7, { x: 0, y: -60 }), 5)).toEqual({ key: 'run', tick: 5 });
});
test('kicking is kick on the status tick', () => {
  expect(animFor(player({ kind: 'kicking' }, 4), 123)).toEqual({ key: 'kick', tick: 4 });
});
test('charging is charge on the status tick', () => {
  expect(animFor(player({ kind: 'charging' }, 31), 123)).toEqual({ key: 'charge', tick: 31 });
});
test('lunging is lunge_<hit>', () => {
  expect(animFor(player({ kind: 'lunging', hit: 'slide' }, 3), 123)).toEqual({ key: 'lunge_slide', tick: 3 });
  expect(animFor(player({ kind: 'lunging', hit: 'big' }, 0), 123)).toEqual({ key: 'lunge_big', tick: 0 });
});
test('recovering after a miss is recover_<hit>', () => {
  expect(animFor(player({ kind: 'recovering', hit: 'shoulder', landed: false }, 6), 123)).toEqual({ key: 'recover_shoulder', tick: 6 });
});
test('recovering after a landed shoulder charge is idle', () => {
  expect(animFor(player({ kind: 'recovering', hit: 'shoulder', landed: true }, 2), 123)).toEqual({ key: 'idle', tick: 2 });
});
test('recovering after a landed slide or big hit gets up on the status tick', () => {
  expect(animFor(player({ kind: 'recovering', hit: 'slide', landed: true }, 2), 123)).toEqual({ key: 'getup', tick: 2 });
  expect(animFor(player({ kind: 'recovering', hit: 'big', landed: true }, 7), 123)).toEqual({ key: 'getup', tick: 7 });
});
const withLength = (status: PlayerStatus, statusTick: number, statusTicks: number): PlayerState => {
  const p = player(status, statusTick); p.statusTicks = statusTicks; return p;
};
test('a knockdown or worse gets up during its last GETUP_TICKS, counted from the window start', () => {
  const down: PlayerStatus = { kind: 'hurt', tier: 'knockdown', variant: 1 };
  expect(animFor(withLength(down, 59, 72), 0)).toEqual({ key: 'hurt_knockdown_1', tick: 59 });
  expect(animFor(withLength(down, 60, 72), 0)).toEqual({ key: 'getup', tick: 0 });
  expect(animFor(withLength(down, 71, 72), 0)).toEqual({ key: 'getup', tick: 11 });
  expect(animFor(withLength({ kind: 'hurt', tier: 'overTheTop', variant: 2 }, 200, 210), 0)).toEqual({ key: 'getup', tick: 2 });
  expect(animFor(withLength({ kind: 'hurt', tier: 'wipeout', variant: 0 }, 120, 132), 0)).toEqual({ key: 'getup', tick: 0 });
});
test('a stumble never gets up', () => {
  expect(animFor(withLength({ kind: 'hurt', tier: 'stumble', variant: 0 }, 23, 24), 0)).toEqual({ key: 'hurt_stumble_0', tick: 23 });
});
test('a missed slide or big hit ends on the get-up frames; a missed shoulder charge does not', () => {
  expect(animFor(withLength({ kind: 'recovering', hit: 'slide', landed: false }, 27, 40), 0)).toEqual({ key: 'recover_slide', tick: 27 });
  expect(animFor(withLength({ kind: 'recovering', hit: 'slide', landed: false }, 28, 40), 0)).toEqual({ key: 'getup', tick: 0 });
  expect(animFor(withLength({ kind: 'recovering', hit: 'big', landed: false }, 59, 60), 0)).toEqual({ key: 'getup', tick: 11 });
  expect(animFor(withLength({ kind: 'recovering', hit: 'shoulder', landed: false }, 11, 12), 0)).toEqual({ key: 'recover_shoulder', tick: 11 });
});
test('hurt is hurt_<tier>_<variant> on the status tick', () => {
  expect(animFor(player({ kind: 'hurt', tier: 'overTheTop', variant: 2 }, 50), 123)).toEqual({ key: 'hurt_overTheTop_2', tick: 50 });
  expect(animFor(player({ kind: 'hurt', tier: 'stumble', variant: 0 }, 1), 123)).toEqual({ key: 'hurt_stumble_0', tick: 1 });
});

test('a player with no velocity (as after a whistle) is idle on the match tick', () => {
  expect(animFor(player({ kind: 'free' }, 40, { x: 0, y: 0 }), 99)).toEqual({ key: 'idle', tick: 99 });
});
