import type { BrainMemory, MatchState, PlayerState } from './types';
import { FIELD_MID_Y, FIELD_W, GK_CLAIM_DIST, GK_HOLD_TICKS, GK_LINE_X, GOAL_HALF, PICKUP_MAX_BALL_SPEED, PLAYER_RADIUS } from './constants';
import type { LevelSpec } from './levels';
import { laneIsOpen } from './brainAttack';
import { goalCenter } from './setup';
import { isDown } from './status';
import { clamp, dist, nearestTo, sub } from './vec';

type Plan = Partial<BrainMemory>;

/** With the ball: hold for GK_HOLD_TICKS (his next think is on that tick), then pass to the open teammate farthest from any opponent. */
function distribute(state: MatchState, p: PlayerState): Plan {
  const wait = GK_HOLD_TICKS - state.ball.ownerTicks;
  if (wait > 0) return { target: { ...p.pos }, thinkAt: state.tick + wait };
  const opponents = state.players.filter(q => q.team !== p.team);
  const nearestOpponent = (m: PlayerState): number => Math.min(...opponents.map(q => dist(q.pos, m.pos)));
  const mates = state.players.filter(m => m.team === p.team && m.role === 'out' && !isDown(m) && laneIsOpen(state, state.ball.pos, m.pos, p.team));
  let best: PlayerState | null = null, bestSpace = -Infinity;
  for (const m of mates) { // ascending id: ties go to the lower id
    const space = nearestOpponent(m);
    if (space > bestSpace) { best = m; bestSpace = space; }
  }
  return best ? { target: { ...p.pos }, action: 'pass', aim: sub(best.pos, p.pos) } : { target: { ...p.pos }, action: 'none' };
}

/** The keeper: distributes with the ball; saves a fast shot by going to where it crosses his line; claims a loose ball near his goal when nearest; else tracks the ball's y. */
export function planKeeper(state: MatchState, p: PlayerState, level: LevelSpec): Plan {
  if (state.ball.owner === p.id) return distribute(state, p);
  const lineX = p.team === 0 ? GK_LINE_X : FIELD_W - GK_LINE_X;
  const ball = state.ball;
  const mouthLo = FIELD_MID_Y - GOAL_HALF, mouthHi = FIELD_MID_Y + GOAL_HALF;
  const towardGoal = (p.team === 0 ? -1 : 1) * ball.vel.x; // units/s along x toward his goal
  if (ball.owner === null && towardGoal > PICKUP_MAX_BALL_SPEED / 2) {
    const seconds = (lineX - ball.pos.x) / ball.vel.x;
    if (seconds >= 0) {
      const tracking = clamp(ball.pos.y, mouthLo, mouthHi);
      const predicted = clamp(ball.pos.y + ball.vel.y * seconds, mouthLo + PLAYER_RADIUS, mouthHi - PLAYER_RADIUS);
      return { target: { x: lineX, y: tracking + (predicted - tracking) * level.positioning } };
    }
  }
  if (ball.owner === null && dist(ball.pos, goalCenter(p.team)) <= GK_CLAIM_DIST && nearestTo(state.players.filter(q => !isDown(q)), ball.pos) === p) {
    return { target: { ...ball.pos } };
  }
  return { target: { x: lineX, y: clamp(ball.pos.y, mouthLo, mouthHi) } };
}
