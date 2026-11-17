import type { BrainMemory, BrainRole, MatchState, PlayerState, Vec } from './types';
import {
  ANCHOR_SHIFT_X, ANCHOR_SHIFT_Y, BIG_TARGET_SLOW_SPEED, COVER_DIST, HUMAN_PRESS_TICKS, JOCKEY_DIST, FIELD_MID_Y, FIELD_W, MARK_DIST, PRESS_TURBO_DIST, PURSUIT_LEAD_MAX_TICKS, RUN_SPEED, TICK_HZ,
  TURBO_COST,
} from './constants';
import type { LevelSpec } from './levels';
import { clampToPitch } from './movement';
import { markedOpponent } from './brainRoles';
import { nextRandom } from './rng';
import { goalCenter, otherTeam } from './setup';
import { isDown } from './status';
import { add, dist, len, nearestTo, norm, scale, sub } from './vec';

export type Plan = Partial<BrainMemory>;

/** A plan that only moves: go to `target`, press nothing. */
const walkTo = (target: Vec, turbo = false, targetPlayer: number | null = null): Plan => ({ target, action: 'none', turbo, targetPlayer });

/** Where to run to catch `target`: his position plus his velocity times the time to reach him at run speed (at most PURSUIT_LEAD_MAX_TICKS of his travel), kept on the pitch. */
export function interceptPoint(chaser: PlayerState, target: PlayerState): Vec {
  const seconds = Math.min(dist(chaser.pos, target.pos) / RUN_SPEED, PURSUIT_LEAD_MAX_TICKS / TICK_HZ);
  return clampToPitch(add(target.pos, scale(target.vel, seconds)));
}

/** Linear blend from the formation spot (positioning 0) to the computed smart spot (1), kept on the pitch. */
export function smartSpot(anchor: Vec, smart: Vec, positioning: number): Vec {
  return clampToPitch(add(anchor, scale(sub(smart, anchor), positioning)));
}

/** The player's formation anchor moved toward the ball. */
export function shiftedAnchor(state: MatchState, p: PlayerState): Vec {
  const b = state.ball.pos;
  return clampToPitch({
    x: p.anchor.x + (b.x - FIELD_W / 2) * ANCHOR_SHIFT_X,
    y: p.anchor.y + (b.y - FIELD_MID_Y) * ANCHOR_SHIFT_Y,
  });
}

/** Whether this player may start a hit of his own: a player whose hit cooldown and attempt interval have both elapsed. */
const mayHit = (state: MatchState, p: PlayerState): boolean => p.hitCooldown === 0 && state.liveTicks >= state.defensiveHitAt[p.id];

/**
 * The plan for going in on `target` if he is within hitRange, else null. The hit is big (charged) against a slow
 * target or a keeper when the level and the meter allow, else a slide (turbo burst running or startable), else a
 * shoulder. The lunge heading is worked out at the release (live direction to the target turned by `aimError`, drawn here).
 */
function planHit(state: MatchState, p: PlayerState, target: PlayerState, level: LevelSpec): Plan | null {
  if (state.config.human[p.team] && state.config.human[otherTeam(p.team)]) return null;
  if (!mayHit(state, p) || dist(p.pos, target.pos) > level.hitRange) return null;
  const aimError = (nextRandom(state) * 2 - 1) * level.hitAimErrorRad;
  if (state.config.human[p.team]) return { target: { ...target.pos }, targetPlayer: target.id, action: 'tap', aimError, turbo: false };
  const hasMeter = state.turbo[p.team] >= TURBO_COST;
  const slow = target.role === 'gk' || len(target.vel) < BIG_TARGET_SLOW_SPEED;
  if (level.hitTypes.includes('big') && hasMeter && slow) return { target: { ...target.pos }, targetPlayer: target.id, action: 'chargeBig', aimError, turbo: false };
  const slide = level.hitTypes.includes('slide') && (p.turboTicks > 0 || (level.usesTurbo && hasMeter));
  return { target: { ...target.pos }, targetPlayer: target.id, action: 'tap', aimError, turbo: slide };
}

/** A marker or cover with an opponent (not the carrier) in range goes for him, per the level's lateHitChance. */
function planLateHit(state: MatchState, p: PlayerState, level: LevelSpec): Plan | null {
  if (state.config.human[p.team] || level.lateHitChance <= 0 || !mayHit(state, p)) return null;
  const others = state.players.filter(q => q.team !== p.team && q.role === 'out' && q.id !== state.ball.owner && !isDown(q));
  const victim = nearestTo(others, p.pos, level.hitRange); // ascending id: ties go to the lower id
  if (!victim || nextRandom(state) >= level.lateHitChance) return null;
  return planHit(state, p, victim, level);
}

/** Where the plan puts a defender who has the carrier's team against him, for roles presser, cover and marker (anything else holds the shifted anchor). */
export function planDefence(state: MatchState, p: PlayerState, role: BrainRole, level: LevelSpec): Plan {
  const carrier = state.ball.owner === null ? null : state.players[state.ball.owner];
  const anchor = shiftedAnchor(state, p);
  if (!carrier || carrier.team === p.team) return walkTo(anchor);
  const goal = goalCenter(p.team);
  switch (role) {
    case 'presser': {
      const hit = planHit(state, p, carrier, level);
      if (hit) return hit;
      if (!state.config.human[p.team] && state.config.human[carrier.team] && level.humanJockeyTicks > 0
        && state.liveTicks % (level.humanJockeyTicks + HUMAN_PRESS_TICKS) < level.humanJockeyTicks
        && dist(carrier.pos, goal) > level.shootRange) {
        return walkTo(clampToPitch(add(carrier.pos, scale(norm(sub(goal, carrier.pos)), JOCKEY_DIST))));
      }
      return walkTo(interceptPoint(p, carrier), level.usesTurbo && dist(p.pos, carrier.pos) > PRESS_TURBO_DIST, carrier.id);
    }
    case 'cover': {
      const ball = state.ball.pos;
      return planHit(state, p, carrier, level) ?? planLateHit(state, p, level) ?? walkTo(clampToPitch(add(ball, scale(norm(sub(goal, ball)), COVER_DIST))));
    }
    case 'marker': {
      const man = markedOpponent(state, p);
      const smart = man ? add(man.pos, scale(norm(sub(goal, man.pos)), MARK_DIST)) : anchor;
      return planLateHit(state, p, level) ?? walkTo(smartSpot(anchor, smart, level.positioning));
    }
    default:
      return walkTo(anchor);
  }
}
