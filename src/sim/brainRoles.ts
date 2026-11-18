import type { BrainRole, MatchState, PlayerState, TeamId, Vec } from './types';
import { goalCenter } from './setup';
import { isHumanControlled, standingOrAll } from './status';
import { add, nearestTo, scale } from './vec';

/** Who has the ball, seen from `team`: its own player, the other team's player, or nobody. */
export type BallSide = 'own' | 'other' | 'loose';

export function ballSide(state: MatchState, team: TeamId, owner: number | null = state.ball.owner): BallSide {
  if (owner === null) return 'loose';
  return state.players[owner].team === team ? 'own' : 'other';
}

const teamMembers = (state: MatchState, team: TeamId): PlayerState[] => state.players.filter(p => p.team === team);

/**
 * One role per player of `team`, indexed by position in the team (0 = keeper, always 'keeper'). A human team's
 * controlled player is never given a role by the brain (he shows as 'support'); the others take the remaining roles,
 * with a loose-ball chaser when the human has selected an off-ball player.
 * Players who are down only get a pressing or chasing role when every outfielder of the team is down.
 */
export function assignRoles(state: MatchState, team: TeamId): BrainRole[] {
  const members = teamMembers(state, team);
  const roles = members.map((p): BrainRole => (p.role === 'gk' ? 'keeper' : 'support'));
  const give = (p: PlayerState | null, role: BrainRole): void => { if (p) roles[members.indexOf(p)] = role; };
  const pool = members.filter(p => p.role === 'out' && !isHumanControlled(state, p));
  const free = standingOrAll(pool);
  const owner = state.ball.owner === null ? null : state.players[state.ball.owner];

  if (owner === null) {
    const receiver = pool.find(p => p.id === state.ball.passTarget);
    if (receiver) give(receiver, 'receiver');
    else if (!state.config.human[team] || state.manualSelection[team]) give(nearestTo(free, state.ball.pos), 'chaser');
  } else if (owner.team === team) {
    give(pool.find(p => p.id === owner.id) ?? null, 'carrier');
  } else {
    const presser = nearestTo(free, owner.pos);
    const cover = nearestTo(free.filter(p => p !== presser), scale(add(owner.pos, goalCenter(team)), 0.5));
    give(presser, 'presser'); give(cover, 'cover');
    for (const p of free) if (p !== presser && p !== cover) give(p, 'marker');
  }
  return roles;
}

/** The role of one player (his entry in assignRoles). */
export function roleOf(state: MatchState, p: PlayerState): BrainRole {
  return assignRoles(state, p.team)[teamMembers(state, p.team).indexOf(p)];
}

/**
 * The opponent a marker covers: markers in ascending id each take the nearest standing opposing outfielder
 * nobody has taken (never the ball carrier, who is the presser's). Null for a player who is not a marker.
 */
export function markedOpponent(state: MatchState, p: PlayerState): PlayerState | null {
  const roles = assignRoles(state, p.team);
  const members = teamMembers(state, p.team);
  const carrierId = state.ball.owner;
  const opponents = standingOrAll(state.players.filter(q => q.team !== p.team && q.role === 'out' && q.id !== carrierId));
  const taken = new Set<number>();
  for (const marker of members.filter((_, i) => roles[i] === 'marker')) {
    const man = nearestTo(opponents.filter(q => !taken.has(q.id)), marker.pos);
    if (man) taken.add(man.id);
    if (marker === p) return man;
  }
  return null;
}
