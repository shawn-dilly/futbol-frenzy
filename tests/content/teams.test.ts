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

function rgb(hex: string): number[] {
  return [1, 3, 5].map(n => parseInt(hex.slice(n, n + 2), 16));
}

for (const home of TEAMS) for (const away of TEAMS) {
  test(`readable kits for ${home.name} vs ${away.name}`, () => {
    const kits = resolveKits(home, away);
    expect(kits[0].outfield).toBe(home.primary);
    expect(kits[1].outfield).toBe(home.clashGroup === away.clashGroup ? away.alternate : away.primary);
    const colors = kits.flatMap(side => [side.outfield, side.keeper]).map(i => KITS[i].jersey);
    for (const [i, a] of colors.entries()) for (const b of colors.slice(i + 1)) {
      expect(Math.hypot(...rgb(a).map((v, c) => v - rgb(b)[c]))).toBeGreaterThan(100);
    }
  });
}
