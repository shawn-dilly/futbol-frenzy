import type { Callout } from '../content/callouts';
import { ShuffleBag } from '../content/shuffleBag';
import { blinkOn } from './layout';
import { PAL } from '../art/palette';
import type { HitType, HurtTier } from '../sim';

export interface CalloutStyle { scale: number; color: string; flash: boolean; ticks: number }

/** How each tier's callout is drawn; bigger tiers are bigger, brighter and stay up longer. */
const STYLES: Record<HurtTier, CalloutStyle> = {
  stumble: { scale: 1, color: PAL.wht, flash: false, ticks: 0 }, // no callout is ever shown for a stumble
  knockdown: { scale: 1, color: PAL.wht, flash: false, ticks: 60 },
  wipeout: { scale: 2, color: PAL.org, flash: false, ticks: 80 },
  overTheTop: { scale: 2, color: PAL.yel, flash: true, ticks: 110 },
};
/** A flashing callout is on for this many ticks, then off for as many. */
const FLASH_HALF_PERIOD_TICKS = 6;

export function calloutStyle(tier: HurtTier): CalloutStyle { return STYLES[tier]; }

/** Whether a callout shown at `shownTick` is on screen at `nowTick`. */
export function calloutVisible(shownTick: number, nowTick: number, style: Pick<CalloutStyle, 'flash' | 'ticks'>): boolean {
  const elapsed = nowTick - shownTick;
  if (elapsed >= style.ticks) return false;
  return !style.flash || blinkOn(elapsed, FLASH_HALF_PERIOD_TICKS);
}

/** What is on screen: '' when nothing is visible, otherwise a key that changes whenever the pixels would (text or tier/style). */
export function calloutDrawKey(shown: { text: string; tier: HurtTier; tick: number } | null, nowTick: number): string {
  if (!shown || !calloutVisible(shown.tick, nowTick, calloutStyle(shown.tier))) return '';
  return `${shown.tier}|${shown.text}`;
}

/** XORed into the match seed so callout choices do not replay the sim's own random sequence. */
export const CALLOUT_SEED_SALT = 0x5ca11047;

/** Chooses the callout for a hit: one shuffle bag per tier so lines rotate and never repeat back to back. */
export class CalloutPicker {
  private readonly bags = new Map<HurtTier, ShuffleBag<Callout>>();
  /** The line shown last, whatever its tier: it is not shown again straight away. */
  private lastShown: Callout | null = null;

  constructor(private readonly callouts: readonly Callout[], private readonly random: () => number) {}

  pick(tier: HurtTier, hit: HitType): Callout | null {
    const forTier = this.callouts.filter((c) => c.tiers.includes(tier));
    const fits = (c: Callout) => !c.hitTypes || c.hitTypes.includes(hit);
    if (!forTier.some(fits)) return null;
    const fresh = (c: Callout) => fits(c) && c !== this.lastShown;
    let bag = this.bags.get(tier);
    if (!bag) { bag = new ShuffleBag<Callout>(this.random); this.bags.set(tier, bag); }
    const picked = bag.next(forTier, (c) => c.weight ?? 1, forTier.some(fresh) ? fresh : fits); // the last line again only if nothing else fits
    this.lastShown = picked;
    return picked;
  }
}
