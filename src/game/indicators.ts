import { BIG_HIT_CHARGE_TICKS, TURBO_COST, isDazed, type PlayerState } from '../sim';
import { blinkOn } from './layout';

/** 0..1 progress of a big-hit charge (1 = charged enough for a big hit); 0 when not charging. */
export function chargeFill(p: PlayerState): number {
  if (p.status.kind !== 'charging') return 0;
  return Math.min(1, p.statusTick / BIG_HIT_CHARGE_TICKS);
}

/** Whether releasing now would launch a big hit: charged long enough and the team's turbo meter can pay for it. */
export function bigHitReady(p: PlayerState, turboMeter: number): boolean {
  return chargeFill(p) >= 1 && turboMeter >= TURBO_COST;
}

/** Whether this step is the one a charge began on, given whether the player was charging on the step before. */
export function chargeJustStarted(wasCharging: boolean, p: PlayerState): boolean {
  return !wasCharging && p.status.kind === 'charging';
}

/** Ticks each phase of the Dazed marker's blink lasts. */
export const DAZED_BLINK_TICKS = 12;

/** Whether the Dazed marker (two yellow pixels over the head) is lit on this match tick. */
export function dazedMarkerVisible(p: PlayerState, matchTick: number): boolean {
  return isDazed(p) && blinkOn(matchTick, DAZED_BLINK_TICKS);
}
