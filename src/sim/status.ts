import type { MatchState, PlayerState, PlayerStatus } from './types';
import { LEVELS } from './levels';
import { PLAYER_INJURY_HEALTH, DAZED_HEALTH, HURT_TIERS } from './constants';

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

export function isInjured(state: MatchState, p: PlayerState): boolean {
  if (!state.config.human.some(Boolean)) return isDazed(p);
  const threshold = state.config.human[p.team] ? PLAYER_INJURY_HEALTH : LEVELS[state.config.level[p.team]].injuryHealth;
  return p.health < threshold;
}

/** The players who are not down; if every one is down, all of them (callers always need someone to pick). */
export function standingOrAll(players: PlayerState[]): PlayerState[] {
  const standing = players.filter(p => !isDown(p));
  return standing.length > 0 ? standing : players;
}

/** A player of a human team whom the human is not steering right now. */
export function isHumanTeammate(state: MatchState, p: PlayerState): boolean {
  return state.config.human[p.team] && !isHumanControlled(state, p);
}

/** Whether this player is the one a human team is steering right now. */
export function isHumanControlled(state: MatchState, p: PlayerState): boolean {
  return state.config.human[p.team] && state.controlled[p.team] === p.id;
}
