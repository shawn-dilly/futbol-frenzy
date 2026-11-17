import { describe, expect, test } from 'vitest';
import { CALLOUTS } from '../../src/content/callouts';
import { hasGlyph, textWidth, wrapText } from '../../src/art/pixelFont';
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

  test('every text is upper case and uses only glyphs the font has', () => {
    for (const c of CALLOUTS) {
      expect(c.text, c.id).toBe(c.text.toUpperCase());
      for (const ch of c.text) expect(hasGlyph(ch), `${c.id}: '${ch}'`).toBe(true);
    }
  });

  test('every text wraps into at most 2 lines, each at most 312 px wide, at the scale of every tier it lists', () => {
    for (const c of CALLOUTS) {
      for (const tier of c.tiers) {
        const { scale } = calloutStyle(tier);
        const lines = wrapText(c.text, CALLOUT_MAX_W, scale);
        expect(lines.length, `${c.id} @ ${tier}`).toBeLessThanOrEqual(2);
        for (const line of lines) expect(textWidth(line, scale), `${c.id} @ ${tier}`).toBeLessThanOrEqual(CALLOUT_MAX_W);
      }
    }
  });

  test('at least two lines are long enough to need two lines at scale 2', () => {
    const wraps = CALLOUTS.filter((c) => wrapText(c.text, CALLOUT_MAX_W, 2).length === 2);
    expect(wraps.length).toBeGreaterThanOrEqual(2);
  });

  test('ids are the text in kebab-case, the pool has 40+ lines, and no weight is below 1', () => {
    expect(CALLOUTS.length).toBeGreaterThanOrEqual(40);
    for (const c of CALLOUTS) {
      expect(c.id).toBe(c.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
      expect(c.weight ?? 1).toBeGreaterThanOrEqual(1);
    }
  });
});
