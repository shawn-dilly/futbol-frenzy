import type { MatchState, PlayerIntent, PlayerState, Vec } from './types';
import {
  ANCHOR_SHIFT_X, ARRIVE_DIST, BRAIN_TAP_TICKS, CPU_ENGAGE_RANGE, ANCHOR_SHIFT_Y, CPU_SHOOT_RANGE, FIELD_H, FIELD_MID_Y, FIELD_W, GK_HOLD_TICKS,
  GK_LINE_X, GOAL_HALF, JOCKEY_DIST, PLAYER_RADIUS, SHOT_Y_MARGIN,
} from './constants';
import { goalCenter, neutralIntent, otherTeam } from './setup';
import { LEVELS } from './levels';
import { nextRandom } from './rng';
import { nearestOutfield } from './possession';
import { add, clamp, dist, norm, scale, sub } from './vec';

export type BrainIntent = PlayerIntent & { kick?: 'pass' | 'shot'; aim?: Vec };

const PITCH_CENTER_X = FIELD_W / 2;

const move = (p: PlayerState, target: Vec): BrainIntent => {
  const d = norm(sub(target, p.pos));
  return { ...neutralIntent(), moveX: d.x, moveY: d.y };
};

/** Like `move`, but stands still once within ARRIVE_DIST of the target. */
const moveOrHold = (p: PlayerState, target: Vec): BrainIntent =>
  dist(p.pos, target) < ARRIVE_DIST ? move(p, p.pos) : move(p, target);

/**
 * The HIT button for a brain-driven player this tick, kept in his memory: a hold set by `startHoldTicks` runs
 * from this tick until `holdHitUntil`. `hitPress` is the first tick of a hold, and a hold never starts on the
 * tick after one ended, so a tap is always one tick down and at least one tick up.
 */
function hitButtons(state: MatchState, p: PlayerState, startHoldTicks: number | null): Pick<PlayerIntent, 'hitPress' | 'hitHeld'> {
  const mem = state.brain[p.id];
  if (mem.holdHitUntil > state.tick) return { hitPress: false, hitHeld: true };
  if (startHoldTicks === null || mem.holdHitUntil >= state.tick) return { hitPress: false, hitHeld: false };
  mem.holdHitUntil = state.tick + startHoldTicks;
  return { hitPress: true, hitHeld: true };
}

function isChaser(state: MatchState, p: PlayerState): boolean {
  if (p.role !== 'out') return false;
  const owner = state.ball.owner;
  if (owner !== null && state.players[owner].team === p.team) return false;
  if (state.config.human[p.team]) return false; // the controlled player is the chaser
  return nearestOutfield(state, p.team) === p.id;
}

function anchorTarget(state: MatchState, p: PlayerState): Vec {
  const b = state.ball.pos;
  return {
    x: clamp(p.anchor.x + (b.x - PITCH_CENTER_X) * ANCHOR_SHIFT_X, PLAYER_RADIUS, FIELD_W - PLAYER_RADIUS),
    y: clamp(p.anchor.y + (b.y - FIELD_MID_Y) * ANCHOR_SHIFT_Y, PLAYER_RADIUS, FIELD_H - PLAYER_RADIUS),
  };
}

/** Where a chaser stands against a carried ball: JOCKEY_DIST from it, on the line toward the chaser's own goal. */
function jockeyTarget(state: MatchState, p: PlayerState): Vec {
  const ball = state.ball.pos;
  return add(ball, scale(norm(sub(goalCenter(p.team), ball)), JOCKEY_DIST));
}

/** Placeholder computer brain; M3 replaces this. Move vectors are unit length or zero; never turbo. */
export function brainIntent(state: MatchState, p: PlayerState): BrainIntent {
  const ball = state.ball;
  const hasBall = ball.owner === p.id;

  if (p.role === 'gk') {
    if (hasBall) {
      const intent = move(p, p.pos);
      return ball.ownerTicks >= GK_HOLD_TICKS ? { ...intent, kick: 'pass' } : intent;
    }
    const lineX = p.team === 0 ? GK_LINE_X : FIELD_W - GK_LINE_X;
    const y = clamp(ball.pos.y, FIELD_MID_Y - GOAL_HALF, FIELD_MID_Y + GOAL_HALF);
    return moveOrHold(p, { x: lineX, y });
  }

  if (hasBall) {
    const goal = goalCenter(otherTeam(p.team));
    const intent = move(p, goal);
    if (dist(p.pos, goal) > CPU_SHOOT_RANGE) return intent;
    const aimY = FIELD_MID_Y + (nextRandom(state) * 2 - 1) * (GOAL_HALF - SHOT_Y_MARGIN);
    return { ...intent, kick: 'shot', aim: sub({ x: goal.x, y: aimY }, ball.pos) };
  }

  if (ball.owner === null && ball.passTarget === p.id) return move(p, ball.pos);
  if (isChaser(state, p)) {
    if (ball.owner === null) return move(p, ball.pos);
    const carrier = state.players[ball.owner];
    const gap = dist(p.pos, carrier.pos);
    if (p.hitCooldown === 0 && gap <= CPU_ENGAGE_RANGE) { // a ready chaser stops jockeying and goes in
      const wantsHit = gap <= LEVELS[state.config.level[p.team]].hitRange;
      return { ...move(p, carrier.pos), ...hitButtons(state, p, wantsHit ? BRAIN_TAP_TICKS : null) };
    }
    return moveOrHold(p, jockeyTarget(state, p));
  }
  return moveOrHold(p, anchorTarget(state, p));
}
