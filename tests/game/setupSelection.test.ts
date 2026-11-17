import { describe, expect, it } from 'vitest';
import { TEAMS } from '../../src/content/teams';
import { setupConfig } from '../../src/game/setupSelection';

describe('setup configuration', () => {
  it.each([['short', 120, undefined], ['long', 240, undefined], ['five', 120, 5]] as const)(
    'maps %s length and selected settings', (length, halfSeconds, targetGoals) => {
      const config = setupConfig({ team: 2, opponent: 4, level: 'rookie', length }, 42);
      expect(config).toEqual({ seed: 42, halfSeconds, ...(targetGoals && { targetGoals }), human: [true, false], level: ['rookie', 'rookie'], ratings: [TEAMS[2].ratings, TEAMS[4].ratings] });
    });
});
