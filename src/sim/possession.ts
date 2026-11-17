import type { MatchState, PlayerState, TeamId, Vec } from './types';
import {
  BALL_RADIUS, DRIBBLE_OFFSET, FIELD_H, FIELD_W, KICK_ANIM_TICKS, KICK_COOLDOWN_TICKS, PASS_CONE_RAD,
  PASS_SPEED, PICKUP_MAX_BALL_SPEED, DAZED_FUMBLE_CHANCE, FUMBLE_COOLDOWN_TICKS, PICKUP_RADIUS, SHOT_SPEED,
} from './constants';
import { add, angleBetween, clamp, dist, len, norm, scale, sub } from './vec';
import { goalCenter } from './setup';
import { nextRandom } from './rng';
import { isDazed, isDown, setStatus, standingOrAll } from './status';

const isZero = (v: Vec) => v.x === 0 && v.y === 0;

/** Counts every player's kick cooldown down to a floor of 0. */
export function tickKickCooldowns(state: MatchState): void {
  for (const p of state.players) p.kickCooldown = Math.max(0, p.kickCooldown - 1);
}

function nearestPickup(state: MatchState): PlayerState | null {
  let best: PlayerState | null = null, bestDist = Infinity;
  const ballTooFastForOutfield = len(state.ball.vel) > PICKUP_MAX_BALL_SPEED;
  for (const p of state.players) { // ascending id, so strict < gives ties to the lower id
    const d = dist(p.pos, state.ball.pos);
    if (isDown(p) || (p.role === 'out' && ballTooFastForOutfield)) continue;
    if (p.kickCooldown === 0 && d <= PICKUP_RADIUS && d < bestDist) { best = p; bestDist = d; }
  }
  return best;
}

/** Pickup while the ball is free; dribble position while it is owned. */
export function updatePossession(state: MatchState): void {
  const ball = state.ball;
  if (ball.owner === null) {
    const taker = nearestPickup(state);
    if (!taker) return;
    if (ball.passTarget === taker.id && isDazed(taker) && nextRandom(state) < DAZED_FUMBLE_CHANCE) {
      taker.kickCooldown = FUMBLE_COOLDOWN_TICKS; // misses the trap; the ball runs on
      return;
    }
    ball.owner = taker.id; ball.ownerTicks = 0; ball.vel = { x: 0, y: 0 }; ball.passTarget = null;
    state.controlled[taker.team] = taker.id;
  } else {
    ball.ownerTicks += 1;
  }
  const owner = state.players[ball.owner];
  const carried = add(owner.pos, scale(owner.facing, DRIBBLE_OFFSET));
  ball.pos = {
    x: clamp(carried.x, BALL_RADIUS, FIELD_W - BALL_RADIUS),
    y: clamp(carried.y, BALL_RADIUS, FIELD_H - BALL_RADIUS),
  };
}

/** Teammate id: smallest angle to `aim` within the pass cone, else the nearest teammate. */
export function pickPassTarget(state: MatchState, passer: PlayerState, aim: Vec): number {
  const mates = standingOrAll(state.players.filter(p => p.team === passer.team && p.id !== passer.id));
  const nearest = mates.reduce((a, b) => (dist(b.pos, passer.pos) < dist(a.pos, passer.pos) ? b : a));
  if (isZero(aim)) return nearest.id;
  let best: PlayerState | null = null, bestAngle = PASS_CONE_RAD;
  for (const m of mates) { // ascending id: equal angle -> nearer, then lower id
    const angle = angleBetween(aim, sub(m.pos, passer.pos));
    const better = best === null ? angle <= bestAngle
      : angle < bestAngle || (angle === bestAngle && dist(m.pos, passer.pos) < dist(best.pos, passer.pos));
    if (better) { best = m; bestAngle = angle; }
  }
  return (best ?? nearest).id;
}

export function kick(state: MatchState, p: PlayerState, kind: 'pass' | 'shot', aim: Vec): void {
  const ball = state.ball;
  if (ball.owner !== p.id) return;
  if (kind === 'pass') {
    const target = state.players[pickPassTarget(state, p, aim)];
    ball.vel = scale(norm(sub(target.pos, ball.pos)), PASS_SPEED);
    ball.passTarget = target.id;
    if (state.config.human[p.team]) state.controlled[p.team] = target.id;
  } else {
    const opposing: TeamId = p.team === 0 ? 1 : 0;
    const dir = isZero(aim) ? sub(goalCenter(opposing), ball.pos) : aim;
    ball.vel = scale(norm(dir), SHOT_SPEED);
    ball.passTarget = null;
  }
  ball.owner = null;
  p.kickCooldown = KICK_COOLDOWN_TICKS;
  setStatus(p, { kind: 'kicking' }, KICK_ANIM_TICKS);
  state.events.push({ type: 'kick', kind, player: p.id });
}

/** The team's outfield player nearest the ball, preferring standing players (ties to the lower id). */
export function nearestOutfield(state: MatchState, team: TeamId): number {
  const candidates = standingOrAll(state.players.filter(p => p.team === team && p.role === 'out'));
  let best = candidates[0].id, bestDist = Infinity;
  for (const p of candidates) {
    const d = dist(p.pos, state.ball.pos);
    if (d < bestDist) { best = p.id; bestDist = d; }
  }
  return best;
}

/** Control goes to the team's nearest standing outfield player to the ball. */
export function switchControl(state: MatchState, team: TeamId): void {
  state.controlled[team] = nearestOutfield(state, team);
}
