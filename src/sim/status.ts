import type { PlayerState, PlayerStatus } from './types';
import { DAZED_HEALTH, HURT_TIERS } from './constants';

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
  return p.status.kind === 'hurt' && HURT_TIERS.indexOf(p.status.tier) >= HURT_TIERS.indexOf('knockdown');
}

/** Badly hurt (health under DAZED_HEALTH): slower, and may fumble a pass. */
export function isDazed(p: PlayerState): boolean {
  return p.health < DAZED_HEALTH;
}

/** The players who are not down; if every one is down, all of them (callers always need someone to pick). */
export function standingOrAll(players: PlayerState[]): PlayerState[] {
  const standing = players.filter(p => !isDown(p));
  return standing.length > 0 ? standing : players;
}
