import { describe, expect, test } from 'vitest';
import type { Callout } from '../../src/content/callouts';
import { seededRandom } from '../../src/content/shuffleBag';
import { PAL } from '../../src/art/palette';
import { CalloutPicker, calloutStyle, calloutVisible } from '../../src/game/calloutPicker';

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

  test('tiers rotate independently', () => {
    const picker = new CalloutPicker(LINES, seededRandom(5));
    const first = picker.pick('knockdown', 'shoulder')!.id;
    picker.pick('wipeout', 'shoulder');
    expect(picker.pick('knockdown', 'shoulder')!.id).not.toBe(first);
  });
});

describe('calloutStyle', () => {
  test('knockdown: small, white, 60 ticks, steady', () => {
    expect(calloutStyle('knockdown')).toEqual({ scale: 1, color: PAL.wht, flash: false, ticks: 60 });
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
