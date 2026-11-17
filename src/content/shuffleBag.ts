import { nextRandom } from '../sim';

/** A seeded float generator in [0,1), built on the sim's PRNG so the codebase has one algorithm. Independent of any match state. */
export function seededRandom(seed: number): () => number {
  const holder = { rng: seed | 0 };
  return () => nextRandom(holder);
}

/**
 * Draws items so each comes out once before any repeats, and never the same item twice running.
 * A weight of w puts w copies of an item in each cycle.
 */
export class ShuffleBag<T> {
  private bag: T[] = [];
  private last: { item: T } | null = null;

  constructor(private readonly random: () => number) {}

  /** `eligible` skips items for this draw only; they stay in the bag. */
  next(items: readonly T[], weightOf: (t: T) => number = () => 1, eligible: (t: T) => boolean = () => true): T {
    if (items.length === 0) throw new Error('ShuffleBag: no items to draw from');
    if (!this.bag.some(eligible)) this.bag = this.fullCycle(items, weightOf);
    let candidates = this.bag.filter(eligible);
    if (candidates.length === 0) throw new Error('ShuffleBag: no items to draw from');
    let fresh = this.notLast(candidates);
    if (fresh.length === 0 && items.some((t) => eligible(t) && t !== this.last?.item)) {
      // Only copies of the item just drawn remain: add the next cycle now (keeping those copies) rather than repeat it.
      this.bag.push(...this.fullCycle(items, weightOf));
      candidates = this.bag.filter(eligible);
      fresh = this.notLast(candidates);
    }
    const pool = fresh.length > 0 ? fresh : candidates;
    const pick = pool[Math.floor(this.random() * pool.length)];
    this.bag.splice(this.bag.indexOf(pick), 1);
    this.last = { item: pick };
    return pick;
  }

  private notLast(candidates: T[]): T[] {
    return this.last ? candidates.filter((t) => t !== this.last!.item) : candidates;
  }

  private fullCycle(items: readonly T[], weightOf: (t: T) => number): T[] {
    return items.flatMap((t) => {
      const weight = weightOf(t);
      if (!(weight >= 1)) throw new Error('ShuffleBag: weight must be at least 1');
      return Array<T>(Math.round(weight)).fill(t);
    });
  }
}
