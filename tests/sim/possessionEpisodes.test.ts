import { expect, test } from 'vitest';
import { step } from '../../src/sim/step';
import { neutralPad } from '../../src/sim/setup';
import { createMatch } from '../../src/sim/setup';
import { matchConfig } from '../helpers';
import { median, PossessionEpisodes } from './possessionEpisodes';

test('median averages the middle pair without dropping short observations', () => {
  expect(median([121, 121, 121, 2042, 2042, 2042])).toBe(1081.5);
  expect(median([25, 25, 1682])).toBe(25);
});

test('phase changes censor and split episodes even when the owner persists', () => {
  const s = createMatch(matchConfig()); const t = new PossessionEpisodes();
  s.phase = 'play'; s.ball.owner = s.controlled[0]; t.observe(s, true); t.observe(s, true);
  s.phase = 'halftime'; t.observe(s, true); s.phase = 'play'; t.observe(s, true);
  s.phase = 'fulltime'; t.observe(s, true);
  expect(t.episodes).toEqual([{ ticks: 2, reason: 'phase', censored: true }, { ticks: 1, reason: 'phase', censored: true }]);
});

test('owner changes and control-only switches terminate distinct episodes', () => {
  const s = createMatch(matchConfig()); const t = new PossessionEpisodes();
  s.phase = 'play'; const first = s.controlled[0]; s.ball.owner = first; t.observe(s, true);
  const teammate = s.players.find(p => p.team === s.players[first].team && p.id !== first)!.id;
  s.ball.owner = teammate; s.controlled[0] = teammate; t.observe(s, true);
  s.controlled[0] = first; t.observe(s, true);
  expect(t.episodes).toEqual([{ ticks: 1, reason: 'transfer', censored: false }, { ticks: 1, reason: 'control-switch', censored: false }]);
});

test('hit and kick events identify losses', () => {
  const s = createMatch(matchConfig()); const t = new PossessionEpisodes();
  s.phase = 'play'; const owner = s.controlled[0]; s.ball.owner = owner; t.observe(s, true);
  s.ball.owner = null; s.events = [{ type: 'kick', kind: 'shot', player: owner }]; t.observe(s, true);
  s.ball.owner = owner; s.events = []; t.observe(s, true);
  s.ball.owner = null; s.events = [{ type: 'hit', victim: owner, tackler: 9, hit: 'shoulder', tier: 'stumble', variant: 0, damage: 1, late: false }]; t.observe(s, true);
  expect(t.episodes.map(e => e.reason)).toEqual(['kick', 'hit']);
});

 test('kickoff transition is not a live possession tick', () => {
  const s = createMatch(matchConfig()); const t = new PossessionEpisodes();
  while (s.phase !== 'play') { step(s, [neutralPad(), neutralPad()]); t.observe(s, false); }
  expect(s.liveTicks).toBe(0);
  s.ball.owner = s.controlled[0];
  step(s, [neutralPad(), neutralPad()]); t.observe(s, true);
  s.phase = 'fulltime'; t.observe(s, false);
  expect(t.episodes[0].ticks).toBe(1);
});
