import { TICK_HZ, BIG_HIT_CHARGE_TICKS, TURBO_COST, type PlayerState } from '../sim';

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

export const DEFAULT_INJURY_STYLE = 'pulse';
export type InjuryStyle = 'bandage' | 'pulse';

/** Opacity of the red overlay over a fully opaque player during one two-second cycle. */
export function pulseAlpha(tick: number): number {
  return 0.16 * (1 + Math.cos(tick * Math.PI / TICK_HZ));
}
