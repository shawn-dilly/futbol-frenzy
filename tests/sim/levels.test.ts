import { expect, test } from 'vitest';
import { LEVELS, LEVEL_ORDER, type LevelSpec } from '../../src/sim/levels';
import { blankMemory, createMatch, placeForKickoff } from '../../src/sim/setup';
import { matchConfig } from '../helpers';

const FIELDS: (keyof LevelSpec)[] = [
  'label', 'reactionTicks', 'passMistakeChance', 'shotErrorRad', 'shootRange', 'pressureDist', 'teamHitCooldownTicks',
  'hitTypes', 'hitAimErrorRad', 'hitRange', 'lateHitChance', 'positioning', 'keeperSpeedFactor', 'usesTurbo',
];

test('level order is rookie, pro, bruiser, psycho', () => {
  expect(LEVEL_ORDER).toEqual(['rookie', 'pro', 'bruiser', 'psycho']);
});
test('every level has every field', () => {
  for (const level of LEVEL_ORDER) for (const f of FIELDS) expect(LEVELS[level][f], `${level}.${f}`).toBeDefined();
});
test('reaction and team cooldown shrink, positioning grows, along the order', () => {
  for (let i = 1; i < LEVEL_ORDER.length; i++) {
    const a = LEVELS[LEVEL_ORDER[i - 1]], b = LEVELS[LEVEL_ORDER[i]];
    expect(b.reactionTicks).toBeLessThan(a.reactionTicks);
    expect(b.teamHitCooldownTicks).toBeLessThan(a.teamHitCooldownTicks);
    expect(b.positioning).toBeGreaterThan(a.positioning);
  }
});
test('every level may shoulder-charge', () => {
  for (const level of LEVEL_ORDER) expect(LEVELS[level].hitTypes).toContain('shoulder');
});
test('starting values of the table', () => {
  expect(LEVELS.rookie.reactionTicks).toBe(24);
  expect(LEVELS.psycho.hitTypes).toEqual(['shoulder', 'slide', 'big']);
  expect(LEVELS.pro.hitTypes).toEqual(['shoulder', 'slide']);
  expect(LEVELS.pro.teamHitCooldownTicks).toBe(420);
});
test('createMatch gives all ten players blank memory, and a kickoff resets it', () => {
  const s = createMatch(matchConfig());
  expect(s.brain).toHaveLength(10);
  for (const m of s.brain) expect(m).toEqual(blankMemory());
  s.brain[3].thinkAt = 99; s.brain[3].holdHitUntil = 50; s.brain[3].action = 'pass';
  placeForKickoff(s, 1);
  for (const m of s.brain) expect(m).toEqual(blankMemory());
});
test('blankMemory is a fresh object each call', () => {
  expect(blankMemory()).toEqual({ thinkAt: 0, role: 'support', target: { x: 0, y: 0 }, action: 'none', aim: { x: 0, y: 0 }, turbo: false, holdHitUntil: 0 });
  expect(blankMemory().target).not.toBe(blankMemory().target);
});
