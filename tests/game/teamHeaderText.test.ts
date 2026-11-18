import { expect, test } from 'vitest';
import { KITS, teamHeaderText } from '../../src/art/palette';
import { resolveKits, TEAMS } from '../../src/content/teams';

test('setup chooses the higher-contrast black or white label for every resolved kit', () => {
  // Expected from sRGB contrast against each club's primary and reversed jersey.
  const primary = ['#000000', '#000000', '#000000', '#000000', '#000000', '#ffffff'];
  const reversed = ['#000000', '#000000', '#ffffff', '#000000', '#ffffff', '#000000'];
  for (const [i, home] of TEAMS.entries()) {
    for (const [j, away] of TEAMS.entries()) {
      const labels = resolveKits(home, away).map(kit => teamHeaderText(KITS[kit.outfield].jersey));
      expect(labels, home.name + ' vs ' + away.name).toEqual([primary[i], i === j ? reversed[j] : primary[j]]);
    }
  }
});
