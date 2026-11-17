import type { Vec } from './types';

export const TICK_HZ = 60;
export const FIELD_W = 480, FIELD_H = 124, FIELD_MID_Y = 62, GOAL_HALF = 16;
export const PLAYER_RADIUS = 4, BALL_RADIUS = 2;
export const RUN_SPEED = 60, TURBO_SPEED = 92;
export const TURBO_BURST_TICKS = 90, TURBO_COST = 1 / 3, TURBO_REFILL_PER_TICK = 1 / (12 * 60);
export const PASS_SPEED = 150, SHOT_SPEED = 220;
export const BALL_FRICTION = 0.985, BALL_STOP_SPEED = 4, WALL_RESTITUTION = 0.7;
export const PICKUP_RADIUS = 6, KICK_COOLDOWN_TICKS = 15, DRIBBLE_OFFSET = 7, KICK_ANIM_TICKS = 12;
export const PICKUP_MAX_BALL_SPEED = 170; // units/s; outfield players cannot trap a faster ball
export const PASS_CONE_RAD = Math.PI / 3;
export const KICKOFF_PAUSE_TICKS = 60, GOAL_PAUSE_TICKS = 120, HALFTIME_PAUSE_TICKS = 180;
export const KICKER_BEHIND_BALL = 6; // units behind the ball on the kicker's own side at kickoff
export const DEFAULT_HALF_SECONDS = 120;
export const CPU_SHOOT_RANGE = 120, GK_HOLD_TICKS = 30, GK_LINE_X = 12;
export const ANCHOR_SHIFT_X = 0.6, ANCHOR_SHIFT_Y = 0.3;
export const FORMATION: Vec[] = [ // team 0; team 1 mirrors x -> FIELD_W - x. Index 0 is the keeper.
  { x: 12, y: 62 }, { x: 100, y: 62 }, { x: 160, y: 28 }, { x: 160, y: 96 }, { x: 220, y: 62 },
];
