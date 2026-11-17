import type { HitType, HurtTier, Vec } from './types';

export const TICK_HZ = 60;
export const FIELD_W = 480, FIELD_H = 124, FIELD_MID_Y = 62, GOAL_HALF = 16;
export const PLAYER_RADIUS = 4, BALL_RADIUS = 2;
export const RUN_SPEED = 60, TURBO_SPEED = 92;
export const GK_SPEED = 40; // units/s, keepers are slower than outfield players
export const TURBO_BURST_TICKS = 90, TURBO_COST = 1 / 3, TURBO_REFILL_PER_TICK = 1 / (12 * 60);
export const PASS_SPEED = 150, SHOT_SPEED = 220;
export const BALL_FRICTION = 0.985, BALL_STOP_SPEED = 4, WALL_RESTITUTION = 0.7;
export const PICKUP_RADIUS = 6, KICK_COOLDOWN_TICKS = 15, DRIBBLE_OFFSET = 7, KICK_ANIM_TICKS = 12;
export const PICKUP_MAX_BALL_SPEED = 170; // units/s; outfield players cannot trap a faster ball
export const PASS_CONE_RAD = Math.PI / 3;
export const KICKOFF_PAUSE_TICKS = 60, GOAL_PAUSE_TICKS = 120, HALFTIME_PAUSE_TICKS = 180;
export const KICKER_BEHIND_BALL = 6; // units behind the ball on the kicker's own side at kickoff
export const DEFAULT_HALF_SECONDS = 120;
export const CPU_SHOOT_RANGE = 90, GK_HOLD_TICKS = 30, GK_LINE_X = 12;
export const ANCHOR_SHIFT_X = 0.35, ANCHOR_SHIFT_Y = 0.3;
export const ARRIVE_DIST = 3; // units: closer than this to a stand-here target means stand still
export const JOCKEY_DIST = 12; // units; a chaser holds this far from an opponent who has the ball
export const SHOT_Y_MARGIN = 3; // units kept between a CPU shot's aim point and the post
export const FORMATION: Vec[] = [ // team 0; team 1 mirrors x -> FIELD_W - x. Index 0 is the keeper.
  { x: 12, y: 62 }, { x: 100, y: 62 }, { x: 160, y: 28 }, { x: 160, y: 96 }, { x: 220, y: 62 },
];
export const HITS: Record<HitType, { base: number; lungeTicks: number; lungeSpeed: number; reach: number; missTicks: number }> = {
  shoulder: { base: 10, lungeTicks: 8,  lungeSpeed: 110, reach: 7, missTicks: 12 },
  slide:    { base: 16, lungeTicks: 18, lungeSpeed: 130, reach: 9, missTicks: 40 },
  big:      { base: 24, lungeTicks: 14, lungeSpeed: 150, reach: 9, missTicks: 60 },
};
export const HURT: Record<HurtTier, { minDamage: number; downTicks: number; knockSpeed: number; rageGain: number; variants: number }> = {
  stumble:    { minDamage: 0,  downTicks: 24,  knockSpeed: 40,  rageGain: 10, variants: 2 },
  knockdown:  { minDamage: 15, downTicks: 72,  knockSpeed: 70,  rageGain: 14, variants: 2 },
  wipeout:    { minDamage: 30, downTicks: 132, knockSpeed: 110, rageGain: 18, variants: 2 },
  overTheTop: { minDamage: 45, downTicks: 210, knockSpeed: 170, rageGain: 22, variants: 3 },
};
export const HURT_TIERS: HurtTier[] = ['stumble', 'knockdown', 'wipeout', 'overTheTop']; // ascending
export const RAGE_MAX = 100, RAGE_DAMAGE_FACTOR = 1.5, RAGE_VICTIM_GAIN = 6, RAGE_CONCEDE_GAIN = 20;
export const RAGE_DECAY_DELAY_TICKS = 360, RAGE_DECAY_PER_TICK = 2 / 60, RAGE_BIG_HIT_SPEND = 30;
export const TURBO_HIT_FACTOR = 1.2, TEAM_POWER = 1;
export const BIG_HIT_CHARGE_TICKS = 30, BIG_HIT_MAX_HOLD_TICKS = 90, CHARGE_MOVE_FACTOR = 0.5;
export const HIT_COOLDOWN_TICKS = 20, LATE_HIT_COOLDOWN_TICKS = 90, HIT_LANDED_RECOVER_TICKS = 8;
export const KNOCK_DECAY = 0.9, LOOSE_BALL_SPEED = 60;
export const MAX_HEALTH = 100, DAZED_HEALTH = 35, DAZED_SPEED_FACTOR = 0.8, DAZED_FUMBLE_CHANCE = 0.15;
export const FUMBLE_COOLDOWN_TICKS = 20, HALFTIME_HEAL = 25;
export const CPU_HIT_RANGE = 10; // units; the placeholder chaser shoulder-charges a carrier this close
