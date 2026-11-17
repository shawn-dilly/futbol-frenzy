import type { PlayerState, PlayerStatus } from './types';
import { HURT } from './constants';

/** Enters `status` for `ticks` ticks (0 = open-ended). */
export function setStatus(p: PlayerState, status: PlayerStatus, ticks: number): void {
  p.status = status; p.statusTick = 0; p.statusTicks = ticks;
}

/** Advances the status clock; a timed status ends in `free` once its length is spent. */
export function tickStatus(p: PlayerState): void {
  p.statusTick += 1;
  if (p.statusTicks > 0 && p.statusTick >= p.statusTicks) setStatus(p, { kind: 'free' }, 0);
}

/** Whether the player may take actions (move, kick, hit). */
export function canAct(p: PlayerState): boolean {
  const k = p.status.kind;
  return k === 'free' || k === 'kicking' || k === 'charging';
}

/** Hurt with tier knockdown or worse: lying on the ground. */
export function isDown(p: PlayerState): boolean {
  return p.status.kind === 'hurt' && HURT[p.status.tier].minDamage >= HURT.knockdown.minDamage;
}
