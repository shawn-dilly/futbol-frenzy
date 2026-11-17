import type { MatchState, TeamId } from './types';
import {
  TICK_HZ, FIELD_W, FIELD_H, FIELD_MID_Y, GOAL_HALF, BALL_RADIUS,
  BALL_FRICTION, BALL_STOP_SPEED, WALL_RESTITUTION,
} from './constants';
import { add, scale, len } from './vec';

/**
 * Moves a free ball one tick: travel, end-line goal check, wall bounces, friction.
 * Returns the scoring team if the ball crossed a goal line inside the mouth, else null.
 */
export function moveFreeBall(state: MatchState): TeamId | null {
  const ball = state.ball;
  if (ball.owner !== null) return null;

  const prev = ball.pos;
  ball.pos = add(prev, scale(ball.vel, 1 / TICK_HZ));

  if (ball.pos.x < 0 || ball.pos.x > FIELD_W) {
    const lineX = ball.pos.x < 0 ? 0 : FIELD_W;
    const crossedFromPitch = lineX === 0 ? prev.x >= 0 : prev.x <= FIELD_W;
    if (crossedFromPitch) {
      const t = (lineX - prev.x) / (ball.pos.x - prev.x);
      const crossY = prev.y + t * (ball.pos.y - prev.y);
      if (Math.abs(crossY - FIELD_MID_Y) <= GOAL_HALF) {
        ball.vel = { x: 0, y: 0 };
        return lineX === 0 ? 1 : 0;
      }
    }
    ball.pos.x = crossedFromPitch ? 2 * lineX - ball.pos.x : lineX;
    ball.vel.x *= -WALL_RESTITUTION;
    state.events.push({ type: 'bounce' });
  }

  const wallY = ball.pos.y < BALL_RADIUS ? BALL_RADIUS
    : ball.pos.y > FIELD_H - BALL_RADIUS ? FIELD_H - BALL_RADIUS : null;
  if (wallY !== null) {
    ball.pos.y = 2 * wallY - ball.pos.y;
    ball.vel.y *= -WALL_RESTITUTION;
    state.events.push({ type: 'bounce' });
  }

  ball.vel = scale(ball.vel, BALL_FRICTION);
  if (len(ball.vel) < BALL_STOP_SPEED) ball.vel = { x: 0, y: 0 };
  return null;
}
