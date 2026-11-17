import { test, expect } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { canAct, isDown, isHumanControlled, setStatus, tickStatus } from '../../src/sim/status';
import { HURT_TIERS } from '../../src/sim/constants';
import type { HitType, PlayerState, PlayerStatus } from '../../src/sim/types';

const cfg = { seed: 1, halfSeconds: 120, human: [true, false] as [boolean, boolean] };
const HITS: HitType[] = ['shoulder', 'slide', 'big'];
const player = (): PlayerState => createMatch(cfg).players[4];

test('setStatus sets the status and resets the counter and length', () => {
  const p = player(); p.statusTick = 9;
  setStatus(p, { kind: 'kicking' }, 12);
  expect([p.status, p.statusTick, p.statusTicks]).toEqual([{ kind: 'kicking' }, 0, 12]);
});
test('tickStatus returns to free exactly on tick statusTicks', () => {
  const p = player(); setStatus(p, { kind: 'kicking' }, 3);
  tickStatus(p); tickStatus(p);
  expect([p.status.kind, p.statusTick]).toEqual(['kicking', 2]);
  tickStatus(p);
  expect([p.status, p.statusTick, p.statusTicks]).toEqual([{ kind: 'free' }, 0, 0]);
});
test('a free player ticks without changing kind', () => {
  const p = player(); tickStatus(p);
  expect([p.status.kind, p.statusTick]).toEqual(['free', 1]);
});
test('an open-ended status never ends by itself', () => {
  const p = player(); setStatus(p, { kind: 'charging' }, 0);
  for (let i = 0; i < 1000; i++) tickStatus(p);
  expect([p.status.kind, p.statusTick]).toEqual(['charging', 1000]);
});
test('canAct is true for free, kicking and charging only', () => {
  const kinds: [PlayerStatus, boolean][] = [
    [{ kind: 'free' }, true], [{ kind: 'kicking' }, true], [{ kind: 'charging' }, true],
  ];
  for (const hit of HITS) {
    kinds.push([{ kind: 'lunging', hit }, false]);
    for (const landed of [true, false]) kinds.push([{ kind: 'recovering', hit, landed }, false]);
  }
  for (const tier of HURT_TIERS) kinds.push([{ kind: 'hurt', tier, variant: 0 }, false]);
  for (const [status, expected] of kinds) { const p = player(); p.status = status; expect(canAct(p), status.kind).toBe(expected); }
});
test('isDown is true for hurt with tier knockdown or worse only', () => {
  const expected = { stumble: false, knockdown: true, wipeout: true, overTheTop: true };
  for (const tier of HURT_TIERS) {
    const p = player(); p.status = { kind: 'hurt', tier, variant: 0 };
    expect(isDown(p), tier).toBe(expected[tier]);
  }
  for (const status of [{ kind: 'free' }, { kind: 'kicking' }, { kind: 'charging' }, { kind: 'lunging', hit: 'big' }, { kind: 'recovering', hit: 'big', landed: true }] as PlayerStatus[]) {
    const p = player(); p.status = status; expect(isDown(p), status.kind).toBe(false);
  }
});

test('isHumanControlled: only the controlled player of a human team', () => {
  const s = createMatch(cfg);
  const mine = s.players[s.controlled[0]];
  const other = s.players.find(p => p.team === 0 && p.id !== mine.id)!;
  const cpu = s.players[s.controlled[1]];
  expect([isHumanControlled(s, mine), isHumanControlled(s, other), isHumanControlled(s, cpu)]).toEqual([true, false, false]);
});
