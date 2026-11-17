import type { MatchState, PlayerIntent, PlayerState, Vec } from './types';
import {
  ANCHOR_SHIFT_X, ANCHOR_SHIFT_Y, CPU_SHOOT_RANGE, FIELD_H, FIELD_MID_Y, FIELD_W, GK_HOLD_TICKS,
  GK_LINE_X, GOAL_HALF, PLAYER_RADIUS,
} from './constants';
import { goalCenter } from './setup';
import { nextRandom } from './rng';
import { clamp, dist, norm, sub } from './vec';

export type BrainIntent = PlayerIntent & { kick?: 'pass' | 'shot'; aim?: Vec };

const ARRIVE_DIST = 3; // units: closer than this to a stand-here target means stand still
const SHOT_Y_MARGIN = 3; // units kept between the aim point and the post
const PITCH_CENTER_X = FIELD_W / 2;

const move = (p: PlayerState, target: Vec): BrainIntent => {
  const d = norm(sub(target, p.pos));
  return { moveX: d.x, moveY: d.y, pass: false, shoot: false, turbo: false };
};

/** Like `move`, but stands still once within ARRIVE_DIST of the target. */
const moveOrHold = (p: PlayerState, target: Vec): BrainIntent =>
  dist(p.pos, target) < ARRIVE_DIST ? move(p, p.pos) : move(p, target);

/** The team's outfield player nearest the ball (ties to the lower id). */
function nearestOutfield(state: MatchState, team: PlayerState['team']): number {
  let best = -1, bestDist = Infinity;
  for (const q of state.players) {
    const d = dist(q.pos, state.ball.pos);
    if (q.team === team && q.role === 'out' && d < bestDist) { best = q.id; bestDist = d; }
  }
  return best;
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
    const goal = goalCenter(p.team === 0 ? 1 : 0);
    const intent = move(p, goal);
    if (dist(p.pos, goal) > CPU_SHOOT_RANGE) return intent;
    const aimY = FIELD_MID_Y + (nextRandom(state) * 2 - 1) * (GOAL_HALF - SHOT_Y_MARGIN);
    return { ...intent, kick: 'shot', aim: sub({ x: goal.x, y: aimY }, ball.pos) };
  }

  if (ball.owner === null && ball.passTarget === p.id) return move(p, ball.pos);
  if (isChaser(state, p)) return move(p, ball.pos);
  return moveOrHold(p, anchorTarget(state, p));
}
