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
export const GK_HOLD_TICKS = 30, GK_LINE_X = 12;
export const ANCHOR_SHIFT_X = 0.35, ANCHOR_SHIFT_Y = 0.3;
export const ARRIVE_DIST = 3; // units: closer than this to a stand-here target means stand still
export const JOCKEY_DIST = 12; // units; the unit COVER_DIST is built from (the cover stands twice this far from the ball)
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
export const KNOCK_MIN_SPEED = 1; // units/s; knockback slower than this is zeroed
export const MAX_HEALTH = 100, DAZED_HEALTH = 35, DAZED_SPEED_FACTOR = 0.8, DAZED_FUMBLE_CHANCE = 0.15;
export const FUMBLE_COOLDOWN_TICKS = 20, HALFTIME_HEAL = 25;
export const BRAIN_TAP_TICKS = 1; // a computer tap holds HIT for this many ticks
export const HEALTH_REGEN_PER_TICK = 0.5 / 60; // health per tick (0.5 per second) for a player who is not hurt, during play only
export const PRESS_TURBO_DIST = 40; // units; a presser farther than this from the carrier uses turbo
export const COVER_DIST = JOCKEY_DIST * 2; // units; the cover stands this far from the ball on the line to his own goal
export const MARK_DIST = 8; // units; a marker stands this far from his man, on the line to his own goal
export const BIG_TARGET_SLOW_SPEED = RUN_SPEED / 2; // units/s; the computer charges a big hit at a target moving slower than this
export const BRAIN_BIG_HOLD_EXTRA_TICKS = 2; // a computer holds a big-hit charge this long past BIG_HIT_CHARGE_TICKS
export const PURSUIT_LEAD_MAX_TICKS = 45; // a presser aims ahead of the carrier by at most this many ticks of travel
export const CHARGE_ABORT_RANGE_FACTOR = 2; // a charging computer player releases once his target is farther than this x hitRange
export const LANE_HALF_WIDTH = 6; // units: a standing opponent this close to a pass or shot line blocks it
export const PASS_BACK_LIMIT = 40; // units: the computer will not pass to a teammate farther from the opposing goal than the carrier by more than this
export const DRIBBLE_SWERVE_RAD = 0.6; // radians: a dribbling computer carrier steers this far off the goal line, away from an opponent ahead
export const DRIBBLE_SWERVE_PRESSURE_FACTOR = 1.5; // an opponent ahead within this x pressureDist makes the carrier swerve
export const TURBO_SPACE_DIST = 30; // units: a computer carrier uses turbo only with no opponent ahead within this
export const SUPPORT_AHEAD = 50, SUPPORT_BEHIND = 40; // units: channel runners stand this far ahead of the ball, the safe man this far behind it
export const SUPPORT_GOAL_MARGIN = 30; // units: channel runners stay this far short of the opposing goal line
export const SUPPORT_CHANNEL_Y: [number, number] = [28, 96]; // the two wide lanes runners take (the lower y first)
export const LANE_SHIFT = 12; // units: a supporter with a blocked lane from the carrier slides this far in y, away from the blocker
export const GK_CLAIM_DIST = 30; // units from his goal inside which a keeper leaves his line for a free ball when he is nearest

export const CATCHUP_GOAL_GAP = 2, CATCHUP_SPEED_FACTOR = 1.06, CATCHUP_TURBO_REFILL_FACTOR = 1.5;

// Rating adjustments around neutral 0.5. Power spans 0.8–1.3.
export const RATING_SPEED_SPAN = 0.2, RATING_SKILL_KICK_SPAN = 0.2, RATING_DIRTY_LATE_DAMAGE_SPAN = 0.2;
export const RATING_POWER_MIN = 0.8, RATING_POWER_SPAN = 0.5;

/** Available substitutions per team per match. */
export const TEAM_RESERVES = 3;

/** First-to-five reaches halftime when a team scores three. */
export const TARGET_HALFTIME_GOALS = 3;
