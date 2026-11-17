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
    if (!this.bag.some(eligible)) this.refill(items, weightOf);
    const candidates = this.bag.filter(eligible);
    if (candidates.length === 0) throw new Error('ShuffleBag: no items to draw from');
    const fresh = this.last ? candidates.filter((t) => t !== this.last!.item) : candidates;
    const pool = fresh.length > 0 ? fresh : candidates;
    const pick = pool[Math.floor(this.random() * pool.length)];
    this.bag.splice(this.bag.indexOf(pick), 1);
    this.last = { item: pick };
    return pick;
  }

  private refill(items: readonly T[], weightOf: (t: T) => number): void {
    this.bag = items.flatMap((t) => Array<T>(Math.max(1, Math.round(weightOf(t)))).fill(t));
  }
}
