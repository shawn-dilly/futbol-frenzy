import { describe, expect, test } from 'vitest';
import { ShuffleBag, seededRandom } from '../../src/content/shuffleBag';

const TEN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('seededRandom', () => {
  test('same seed gives the same sequence in [0,1); different seeds differ', () => {
    const a = seededRandom(7), b = seededRandom(7), c = seededRandom(8);
    const seqA = [a(), a(), a()];
    expect(seqA).toEqual([b(), b(), b()]);
    expect(seqA).not.toEqual([c(), c(), c()]);
    for (const v of seqA) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe('ShuffleBag', () => {
  test('3 full cycles of 10 items each contain all 10', () => {
    const bag = new ShuffleBag<number>(seededRandom(1));
    for (let cycle = 0; cycle < 3; cycle++) {
      const drawn = Array.from({ length: 10 }, () => bag.next(TEN));
      expect([...drawn].sort((x, y) => x - y)).toEqual(TEN);
    }
  });

  test('never returns the same item twice in a row across 1000 draws', () => {
    const bag = new ShuffleBag<number>(seededRandom(2));
    let prev = -1;
    for (let i = 0; i < 1000; i++) { const v = bag.next(TEN); expect(v).not.toBe(prev); prev = v; }
  });

  test('two items alternate', () => {
    const bag = new ShuffleBag<string>(seededRandom(3));
    let prev = '';
    for (let i = 0; i < 50; i++) { const v = bag.next(['a', 'b']); expect(v).not.toBe(prev); prev = v; }
  });

  test('weight 3 puts three copies in each cycle', () => {
    const bag = new ShuffleBag<string>(seededRandom(4));
    const items = ['heavy', 'x', 'y', 'z'];
    for (let cycle = 0; cycle < 3; cycle++) {
      const drawn = Array.from({ length: 6 }, () => bag.next(items, (s) => (s === 'heavy' ? 3 : 1)));
      expect(drawn.filter((s) => s === 'heavy').length).toBe(3);
      for (const s of ['x', 'y', 'z']) expect(drawn.filter((d) => d === s).length).toBe(1);
    }
  });

  test('a single item repeats without hanging', () => {
    const bag = new ShuffleBag<string>(seededRandom(5));
    expect([bag.next(['only']), bag.next(['only']), bag.next(['only'])]).toEqual(['only', 'only', 'only']);
  });

  test('an empty list throws a clear error', () => {
    const bag = new ShuffleBag<string>(seededRandom(6));
    expect(() => bag.next([])).toThrow('ShuffleBag: no items to draw from');
  });

  test('items rejected by the eligibility filter stay in the bag', () => {
    const bag = new ShuffleBag<number>(seededRandom(7));
    const items = [1, 2, 3, 4];
    expect(bag.next(items, undefined, (n) => n === 4)).toBe(4);
    const rest = [bag.next(items), bag.next(items), bag.next(items)];
    expect([...rest].sort()).toEqual([1, 2, 3]);
  });

  test('throws when nothing is eligible', () => {
    const bag = new ShuffleBag<number>(seededRandom(8));
    expect(() => bag.next([1, 2], undefined, () => false)).toThrow('ShuffleBag: no items to draw from');
  });
});
