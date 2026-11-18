import { describe, expect, test } from 'vitest';
import type { Callout } from '../../src/content/callouts';
import { seededRandom } from '../../src/content/shuffleBag';
import { PAL } from '../../src/art/palette';
import { CalloutPicker, calloutDrawKey, calloutStyle, calloutVisible } from '../../src/game/calloutPicker';

const LINES: Callout[] = [
  { id: 'a', text: 'A', tiers: ['knockdown'] },
  { id: 'b', text: 'B', tiers: ['knockdown', 'wipeout'] },
  { id: 'big', text: 'BIG', tiers: ['knockdown'], hitTypes: ['big'] },
  { id: 'w', text: 'W', tiers: ['wipeout'], weight: 3 },
];

describe('CalloutPicker', () => {
  test('stumble has no callout', () => {
    expect(new CalloutPicker(LINES, seededRandom(1)).pick('stumble', 'shoulder')).toBeNull();
  });

  test('a tier with no line for this hit type gives null', () => {
    expect(new CalloutPicker(LINES, seededRandom(1)).pick('overTheTop', 'big')).toBeNull();
    const bigOnly: Callout[] = [{ id: 'x', text: 'X', tiers: ['wipeout'], hitTypes: ['big'] }];
    expect(new CalloutPicker(bigOnly, seededRandom(1)).pick('wipeout', 'shoulder')).toBeNull();
  });

  test('only lines for the tier come out, and hit-restricted lines only for their hit', () => {
    const picker = new CalloutPicker(LINES, seededRandom(2));
    for (let i = 0; i < 50; i++) expect(['a', 'b']).toContain(picker.pick('knockdown', 'shoulder')!.id);
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(picker.pick('knockdown', 'big')!.id);
    expect(seen).toEqual(new Set(['a', 'b', 'big']));
  });

  test('a hit-restricted line is not lost when skipped: it comes out once a big hit asks', () => {
    const picker = new CalloutPicker(LINES, seededRandom(3));
    picker.pick('knockdown', 'shoulder'); picker.pick('knockdown', 'shoulder');
    expect(picker.pick('knockdown', 'big')!.id).toBe('big');
  });

  test('never repeats a line back to back within a tier', () => {
    const picker = new CalloutPicker(LINES, seededRandom(4));
    let prev = '';
    for (let i = 0; i < 100; i++) { const id = picker.pick('knockdown', 'shoulder')!.id; expect(id).not.toBe(prev); prev = id; }
  });

  test('never shows the same line twice running, even across tiers', () => {
    const picker = new CalloutPicker(LINES, seededRandom(6));
    let prev = '';
    for (let i = 0; i < 200; i++) {
      const tier = i % 2 === 0 ? 'knockdown' : 'wipeout';
      const id = picker.pick(tier, 'shoulder')!.id;
      expect(id, `draw ${i}`).not.toBe(prev); prev = id;
    }
  });

  test('a lone eligible line still shows when it was the last one', () => {
    const picker = new CalloutPicker([{ id: 'only', text: 'ONLY', tiers: ['wipeout'] }], seededRandom(1));
    expect(picker.pick('wipeout', 'shoulder')!.id).toBe('only');
    expect(picker.pick('wipeout', 'shoulder')!.id).toBe('only');
  });

  test('tiers rotate independently: a draw in one tier does not use up the other tier\'s bag', () => {
    const two: Callout[] = [
      { id: 'k1', text: 'K1', tiers: ['knockdown'] }, { id: 'k2', text: 'K2', tiers: ['knockdown'] },
      { id: 'w1', text: 'W1', tiers: ['wipeout'] }, { id: 'w2', text: 'W2', tiers: ['wipeout'] },
    ];
    const picker = new CalloutPicker(two, seededRandom(5));
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) { seen.add(picker.pick('knockdown', 'shoulder')!.id); seen.add(picker.pick('wipeout', 'shoulder')!.id); }
    expect(seen).toEqual(new Set(['k1', 'k2', 'w1', 'w2']));
    // Interleaved draws still alternate within each tier (one shared bag would repeat or starve one tier).
    const ks: string[] = [];
    for (let i = 0; i < 6; i++) { ks.push(picker.pick('knockdown', 'shoulder')!.id); picker.pick('wipeout', 'shoulder'); }
    ks.forEach((id, i) => { if (i > 0) expect(id).not.toBe(ks[i - 1]); });
    expect(new Set(ks.slice(0, 2))).toEqual(new Set(['k1', 'k2']));
  });
});

describe('calloutDrawKey', () => {
  test('nothing shown, or not visible, gives an empty key', () => {
    expect(calloutDrawKey(null, 10)).toBe('');
    expect(calloutDrawKey({ text: 'CRUNCH!', tier: 'knockdown', tick: 0 }, 60)).toBe('');
    expect(calloutDrawKey({ text: 'CRUNCH!', tier: 'overTheTop', tick: 0 }, 6)).toBe(''); // blink off
  });
  test('same text at another tier has another key, so a replacement is restyled', () => {
    const kd = calloutDrawKey({ text: 'CRUNCH!', tier: 'knockdown', tick: 0 }, 1);
    const wo = calloutDrawKey({ text: 'CRUNCH!', tier: 'wipeout', tick: 0 }, 1);
    expect(kd).not.toBe('');
    expect(wo).not.toBe(kd);
  });
  test('a different text has a different key; the same callout keeps its key while visible', () => {
    const a = { text: 'A', tier: 'wipeout' as const, tick: 0 };
    expect(calloutDrawKey(a, 1)).toBe(calloutDrawKey(a, 50));
    expect(calloutDrawKey({ ...a, text: 'B' }, 1)).not.toBe(calloutDrawKey(a, 1));
  });
});

describe('calloutStyle', () => {
  test('knockdown: small, white, 60 ticks, steady', () => {
    expect(calloutStyle('knockdown')).toEqual({ scale: 2, color: PAL.wht, flash: false, ticks: 60 });
  });
  test('wipeout: scale 2 orange 80 ticks', () => {
    expect(calloutStyle('wipeout')).toEqual({ scale: 2, color: PAL.org, flash: false, ticks: 80 });
  });
  test('over the top: scale 2 yellow flashing 110 ticks', () => {
    expect(calloutStyle('overTheTop')).toEqual({ scale: 2, color: PAL.yel, flash: true, ticks: 110 });
  });
});

describe('calloutVisible', () => {
  test('steady lines show until their last tick', () => {
    const s = { flash: false, ticks: 60 };
    expect(calloutVisible(100, 100, s)).toBe(true);
    expect(calloutVisible(100, 159, s)).toBe(true);
    expect(calloutVisible(100, 160, s)).toBe(false);
  });
  test('flashing lines blink every 6 ticks and end after `ticks`', () => {
    const s = { flash: true, ticks: 110 };
    expect(calloutVisible(10, 10, s)).toBe(true);
    expect(calloutVisible(10, 15, s)).toBe(true);
    expect(calloutVisible(10, 16, s)).toBe(false);
    expect(calloutVisible(10, 21, s)).toBe(false);
    expect(calloutVisible(10, 22, s)).toBe(true);
    expect(calloutVisible(10, 10 + 110, s)).toBe(false);
    expect(calloutVisible(10, 10 + 108, s)).toBe(true);
  });
});

test('the announcer distinguishes late hits from dispossessions', () => {
  const picker = new CalloutPicker([
    { id: 'late', text: 'LATE', tiers: ['knockdown'], late: true },
    { id: 'steal', text: 'STEAL', tiers: ['knockdown'], late: false },
  ], seededRandom(3));
  expect(picker.pick('knockdown', 'big', true)?.id).toBe('late');
  expect(picker.pick('knockdown', 'big', false)?.id).toBe('steal');
});
