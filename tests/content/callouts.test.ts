import { describe, expect, test } from 'vitest';
import { CALLOUTS } from '../../src/content/callouts';
import { hasGlyph, wrapText } from '../../src/art/pixelFont';
import { calloutStyle } from '../../src/game/calloutPicker';
import { CALLOUT_MAX_W } from '../../src/game/layout';
import { HURT_TIERS } from '../../src/sim';

const MAX_LINES = 2;

describe('CALLOUTS', () => {
  test('ids are unique', () => {
    const ids = CALLOUTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('there are at least 30 lines', () => { expect(CALLOUTS.length).toBeGreaterThanOrEqual(30); });

  test('every tier except stumble has at least 10 lines, and stumble has none', () => {
    for (const tier of HURT_TIERS) {
      const n = CALLOUTS.filter((c) => c.tiers.includes(tier)).length;
      if (tier === 'stumble') expect(n).toBe(0); else expect(n).toBeGreaterThanOrEqual(10);
    }
  });

  test('every tier has lines for each hit type', () => {
    for (const tier of ['knockdown', 'wipeout', 'overTheTop'] as const) {
      for (const hit of ['shoulder', 'slide', 'big'] as const) {
        const n = CALLOUTS.filter((c) => c.tiers.includes(tier) && (!c.hitTypes || c.hitTypes.includes(hit))).length;
        expect(n, `${tier}/${hit}`).toBeGreaterThanOrEqual(10);
      }
    }
  });

  test('every text is upper case, uses only glyphs the font has, and wraps to fit the screen at its tier scale', () => {
    for (const c of CALLOUTS) {
      expect(c.text, c.id).toBe(c.text.toUpperCase());
      for (const ch of c.text) expect(hasGlyph(ch), `${c.id}: '${ch}'`).toBe(true);
      for (const tier of c.tiers) {
        const lines = wrapText(c.text, CALLOUT_MAX_W, calloutStyle(tier).scale);
        expect(lines.length, `${c.id} @ ${tier}`).toBeLessThanOrEqual(MAX_LINES);
      }
    }
  });
});
