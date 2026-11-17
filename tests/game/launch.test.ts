import { describe, expect, it } from 'vitest';
import { launchFromSearch } from '../../src/game/launch';

describe('launchFromSearch', () => {
  it('maps query settings and gives demo precedence', () => {
    expect(launchFromSearch('?demo=1&match=1&seed=9&half=3&mute=1&level=rookie&level2=pro')).toMatchObject({ mode: 'demo', matchId: null, mute: true, config: { seed: 9, halfSeconds: 3, human: [false, false], level: ['pro', 'rookie'] } });
  });
  it('defaults to direct human play', () => {
    expect(launchFromSearch('').mode).toBe('direct');
    expect(launchFromSearch('?match=1').config.human).toEqual([true, false]);
  });
});
