import { ANIMATIONS, hurtAnimKey } from '../content/animations';
import type { SfxName } from '../content/sounds';
import { blinkOn } from './layout';
import { BIG_HIT_CHARGE_TICKS, DAZED_HEALTH, type HurtTier, type PlayerState } from '../sim';

/** Mixed into the match seed for the presentation's own random stream (shake), keeping it apart from the sim and the callouts. */
export const EFFECT_SEED_SALT = 0x5ba4e000;

/** What the player sees and hears when a hit of this tier lands. */
export interface HitFeedback {
  sounds: SfxName[];
  /** Screen shake: starting size in pixels and how long it takes to die away. */
  shakePx: number; shakeMs: number;
  /** Sim ticks the match freezes for (hit-stop). */
  freezeTicks: number;
  flash: boolean;
  stars: boolean;
}

export const HIT_FEEDBACK: Record<HurtTier, HitFeedback> = {
  stumble: { sounds: ['thud'], shakePx: 1, shakeMs: 80, freezeTicks: 0, flash: false, stars: false },
  knockdown: { sounds: ['thud', 'grunt'], shakePx: 2, shakeMs: 150, freezeTicks: 0, flash: false, stars: false },
  wipeout: { sounds: ['crunch', 'grunt', 'ooh'], shakePx: 4, shakeMs: 250, freezeTicks: 6, flash: false, stars: false },
  overTheTop: { sounds: ['crunch', 'grunt', 'gasp'], shakePx: 6, shakeMs: 400, freezeTicks: 12, flash: true, stars: true },
};

/** Whole-pixel shake offset `elapsedMs` after it began: random in a box that shrinks linearly to nothing at `shakeMs`. */
export function shakeOffset(elapsedMs: number, shakePx: number, shakeMs: number, random: () => number): { x: number; y: number } {
  const size = shakePx * (1 - elapsedMs / shakeMs);
  if (size <= 0) return { x: 0, y: 0 };
  return { x: Math.round(size * (random() * 2 - 1)), y: Math.round(size * (random() * 2 - 1)) };
}

/** White flash on an over-the-top hit: starts at its peak and fades out over FLASH_MS. */
export const FLASH_MS = 200;
export const FLASH_PEAK_ALPHA = 0.85;
export function flashAlpha(elapsedMs: number): number {
  return FLASH_PEAK_ALPHA * Math.max(0, 1 - elapsedMs / FLASH_MS);
}

/** The over-the-top variant that lands face first and leaves a crater. */
export const CRATER_TIER: HurtTier = 'overTheTop';
export const CRATER_VARIANT = 2;

/** Ticks from the hit until the victim lands and leaves a crater, or null when this hit leaves none. */
export function craterLandTicks(tier: HurtTier, variant: number): number | null {
  if (tier !== CRATER_TIER || variant !== CRATER_VARIANT) return null;
  const def = ANIMATIONS[hurtAnimKey(tier, variant)];
  return (def.airFrames ?? 0) * def.ticksPerFrame;
}

/** 0..1 progress of a big-hit charge (1 = charged enough for a big hit); 0 when not charging. */
export function chargeFill(p: PlayerState): number {
  if (p.status.kind !== 'charging') return 0;
  return Math.min(1, p.statusTick / BIG_HIT_CHARGE_TICKS);
}

/** Ticks each phase of the Dazed marker's blink lasts. */
export const DAZED_BLINK_TICKS = 12;

/** Whether the Dazed marker (two yellow pixels over the head) is lit on this match tick. */
export function dazedMarkerVisible(p: PlayerState, matchTick: number): boolean {
  return p.health < DAZED_HEALTH && blinkOn(matchTick, DAZED_BLINK_TICKS);
}
