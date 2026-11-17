import type { BrainMemory, BrainRole, MatchState, PlayerState, Vec } from './types';
import {
  ANCHOR_SHIFT_X, ANCHOR_SHIFT_Y, BIG_TARGET_SLOW_SPEED, COVER_DIST, FIELD_MID_Y, FIELD_W, MARK_DIST, PRESS_TURBO_DIST, TURBO_COST,
} from './constants';
import type { LevelSpec } from './levels';
import { clampToPitch } from './movement';
import { markedOpponent } from './brainRoles';
import { nextRandom } from './rng';
import { goalCenter } from './setup';
import { isDown } from './status';
import { add, dist, len, norm, rotate, scale, sub } from './vec';

export type Plan = Partial<BrainMemory>;

/** A plan that only moves: go to `target`, press nothing. */
const walkTo = (target: Vec, turbo = false): Plan => ({ target, action: 'none', turbo });

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

/** Whether this player may start a hit of his own: a computer team's player whose (team-wide) cooldown is over. */
const mayHit = (state: MatchState, p: PlayerState): boolean => !state.config.human[p.team] && p.hitCooldown === 0;

/**
 * The plan for going in on `target` if he is within hitRange, else null. The hit is big (charged) against a slow
 * target or a keeper when the level and the meter allow, else a slide (turbo burst running or startable), else a
 * shoulder. `aim` is the lunge heading: the direction to the target turned by a random error within the level's.
 */
function planHit(state: MatchState, p: PlayerState, target: PlayerState, level: LevelSpec): Plan | null {
  if (!mayHit(state, p) || dist(p.pos, target.pos) > level.hitRange) return null;
  const aim = rotate(norm(sub(target.pos, p.pos)), (nextRandom(state) * 2 - 1) * level.hitAimErrorRad);
  const hasMeter = state.turbo[p.team] >= TURBO_COST;
  const slow = target.role === 'gk' || len(target.vel) < BIG_TARGET_SLOW_SPEED;
  if (level.hitTypes.includes('big') && hasMeter && slow) return { target: { ...target.pos }, action: 'chargeBig', aim, turbo: false };
  const slide = level.hitTypes.includes('slide') && (p.turboTicks > 0 || (level.usesTurbo && hasMeter));
  return { target: { ...target.pos }, action: 'tap', aim, turbo: slide };
}

/** A marker or cover with an opponent (not the carrier) in range goes for him, per the level's lateHitChance. */
function planLateHit(state: MatchState, p: PlayerState, level: LevelSpec): Plan | null {
  if (level.lateHitChance <= 0 || !mayHit(state, p)) return null;
  let victim: PlayerState | null = null, best = level.hitRange;
  for (const q of state.players) { // ascending id: ties go to the lower id
    if (q.team === p.team || q.role !== 'out' || q.id === state.ball.owner || isDown(q)) continue;
    const d = dist(q.pos, p.pos);
    if (d <= best && (victim === null || d < best)) { victim = q; best = d; }
  }
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
    case 'presser':
      return planHit(state, p, carrier, level)
        ?? walkTo({ ...carrier.pos }, level.usesTurbo && dist(p.pos, carrier.pos) > PRESS_TURBO_DIST);
    case 'cover': {
      const ball = state.ball.pos;
      return planLateHit(state, p, level) ?? walkTo(clampToPitch(add(ball, scale(norm(sub(goal, ball)), COVER_DIST))));
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
