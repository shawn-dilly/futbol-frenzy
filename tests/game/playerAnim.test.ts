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
test('recovering after a landed hit is idle', () => {
  expect(animFor(player({ kind: 'recovering', hit: 'big', landed: true }, 2), 123)).toEqual({ key: 'idle', tick: 2 });
});
test('hurt is hurt_<tier>_<variant> on the status tick', () => {
  expect(animFor(player({ kind: 'hurt', tier: 'overTheTop', variant: 2 }, 50), 123)).toEqual({ key: 'hurt_overTheTop_2', tick: 50 });
  expect(animFor(player({ kind: 'hurt', tier: 'stumble', variant: 0 }, 1), 123)).toEqual({ key: 'hurt_stumble_0', tick: 1 });
});
