import { describe, expect, it } from 'vitest';
import { TEAMS } from '../../src/content/teams';
import { LEVEL_ORDER } from '../../src/sim';
import { setupConfig } from '../../src/game/setupSelection';

describe('setup configuration', () => {
  it.each([['short', 120, undefined], ['long', 240, undefined], ['five', 120, 5]] as const)(
    'maps %s length and selected settings', (length, halfSeconds, targetGoals) => {
      const config = setupConfig({ team: 2, opponent: 4, level: 'rookie', length }, 42);
      expect(config).toEqual({ seed: 42, halfSeconds, ...(targetGoals && { targetGoals }), human: [true, false], level: ['rookie', 'rookie'], ratings: [TEAMS[2].ratings, TEAMS[4].ratings] });
    });
  it.each(LEVEL_ORDER)('maps difficulty %s for both sides', level => {
    expect(setupConfig({ team: 0, opponent: 1, level, length: 'short' }, 7).level).toEqual([level, level]);
  });
  it.each(TEAMS.map((_, i) => i))('maps team %i ratings without sharing mutable data', team => {
    const config = setupConfig({ team, opponent: (team + 1) % TEAMS.length, level: 'pro', length: 'short' }, 7);
    expect(config.ratings).toEqual([TEAMS[team].ratings, TEAMS[(team + 1) % TEAMS.length].ratings]);
    expect(config.ratings![0]).not.toBe(TEAMS[team].ratings);
  });
});
