import { expect, test } from 'vitest';
import { TEAMS } from '../../src/content/teams';
import { KITS } from '../../src/art/palette';

test('team catalog has stable unique identities, normalized ratings and contrasting supported kits', () => {
  expect(TEAMS).toHaveLength(6);
  expect(new Set(TEAMS.map(team => team.id)).size).toBe(6);
  expect(new Set(TEAMS.map(team => team.name)).size).toBe(6);
  for (const team of TEAMS) {
    expect(team.id).toMatch(/^[a-z]+$/);
    expect(Object.keys(team.ratings).sort()).toEqual(['dirty', 'power', 'skill', 'speed']);
    for (const rating of Object.values(team.ratings)) expect(rating).toBeGreaterThanOrEqual(0), expect(rating).toBeLessThanOrEqual(1);
    for (const index of [...team.kits.home, ...team.kits.away]) expect(KITS[index]).toBeDefined();
    for (const opponent of TEAMS) expect(KITS[team.kits.home[0]].jersey).not.toBe(KITS[opponent.kits.away[0]].jersey);
  }
});
