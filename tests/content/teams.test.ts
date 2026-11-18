import { expect, test } from 'vitest';
import { TEAMS, resolveKits } from '../../src/content/teams';
import { KITS } from '../../src/art/palette';

test('team catalog has stable unique identities, normalized ratings and contrasting supported kits', () => {
  expect(TEAMS).toHaveLength(6);
  expect(new Set(TEAMS.map(team => team.id)).size).toBe(6);
  expect(new Set(TEAMS.map(team => team.name)).size).toBe(6);
  for (const team of TEAMS) {
    expect(team.id).toMatch(/^[a-z]+$/);
    expect(Object.keys(team.ratings).sort()).toEqual(['dirty', 'power', 'skill', 'speed']);
    for (const rating of Object.values(team.ratings)) expect(rating).toBeGreaterThanOrEqual(0), expect(rating).toBeLessThanOrEqual(1);
  }
  expect(new Set(TEAMS.map(t => KITS[t.primary].jersey)).size).toBe(6);
});

for (const home of TEAMS) for (const away of TEAMS) {
  test(`fixed club colors for ${home.name} vs ${away.name}`, () => {
    const [left, right] = resolveKits(home, away);
    const primary = KITS[away.primary];
    expect(primary.jersey).not.toBe(primary.trim);
    expect(primary.shorts).toBe(primary.trim);
    const mirror = home.id === away.id;
    expect(left.outfield).toBe(home.primary);
    expect(KITS[right.outfield].jersey).toBe(mirror ? primary.trim : primary.jersey);
    expect(KITS[right.outfield].trim).toBe(mirror ? primary.jersey : primary.trim);
    const shirts = [left.outfield, right.outfield, left.keeper, right.keeper].map(index => KITS[index].jersey);
    expect(new Set(shirts).size).toBe(4);
  });
}
