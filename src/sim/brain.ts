import type { BrainMemory, BrainRole, MatchState, PlayerIntent, PlayerState, Vec } from './types';
import {
  ARRIVE_DIST, BIG_HIT_CHARGE_TICKS, BRAIN_BIG_HOLD_EXTRA_TICKS, BRAIN_TAP_TICKS, CHARGE_ABORT_RANGE_FACTOR, FIELD_MID_Y, FIELD_W,
  GK_HOLD_TICKS, GK_LINE_X, GOAL_HALF, SHOT_Y_MARGIN, TURBO_COST,
} from './constants';
import { goalCenter, neutralIntent, otherTeam } from './setup';
import { LEVELS, type LevelSpec } from './levels';
import { nextRandom } from './rng';
import { ballSide, roleOf } from './brainRoles';
import { interceptPoint, planDefence, shiftedAnchor, type Plan } from './brainDefend';
import { isHumanTeammate } from './status';
import { clamp, dist, norm, rotate, sub } from './vec';

export type BrainIntent = PlayerIntent & { kick?: 'pass' | 'shot'; aim?: Vec };

const ZERO: Vec = { x: 0, y: 0 };

const move = (p: PlayerState, target: Vec): BrainIntent => {
  const d = norm(sub(target, p.pos));
  return { ...neutralIntent(), moveX: d.x, moveY: d.y };
};

/** Like `move`, but stands still once within ARRIVE_DIST of the target. */
const moveOrHold = (p: PlayerState, target: Vec): BrainIntent =>
  dist(p.pos, target) < ARRIVE_DIST ? move(p, p.pos) : move(p, target);

// ---- plans for the roles with no defending in them (Task 3 replaces the own-ball and keeper ones) ----

/** The carrier runs at goal and shoots from inside the level's shootRange, aiming at a random point of the goal mouth. */
function planCarrier(state: MatchState, p: PlayerState, level: LevelSpec): Plan {
  const goal = goalCenter(otherTeam(p.team));
  if (dist(p.pos, goal) > level.shootRange) return { target: goal };
  const aimY = FIELD_MID_Y + (nextRandom(state) * 2 - 1) * (GOAL_HALF - SHOT_Y_MARGIN);
  return { target: goal, action: 'shot', aim: sub({ x: goal.x, y: aimY }, state.ball.pos) };
}

/** The keeper holds the ball for GK_HOLD_TICKS and then passes (his next think is on that tick); otherwise he tracks the ball along his line. */
function planKeeper(state: MatchState, p: PlayerState): Plan {
  if (state.ball.owner === p.id) {
    const wait = GK_HOLD_TICKS - state.ball.ownerTicks;
    return wait > 0 ? { target: { ...p.pos }, thinkAt: state.tick + wait } : { target: { ...p.pos }, action: 'pass' };
  }
  const lineX = p.team === 0 ? GK_LINE_X : FIELD_W - GK_LINE_X;
  return { target: { x: lineX, y: clamp(state.ball.pos.y, FIELD_MID_Y - GOAL_HALF, FIELD_MID_Y + GOAL_HALF) } };
}

function planFor(state: MatchState, p: PlayerState, role: BrainRole, level: LevelSpec): Plan {
  switch (role) {
    case 'keeper': return planKeeper(state, p);
    case 'carrier': return planCarrier(state, p, level);
    case 'presser': case 'cover': case 'marker': return planDefence(state, p, role, level);
    case 'chaser': case 'receiver': return { target: { ...state.ball.pos } };
    default: return { target: shiftedAnchor(state, p) };
  }
}

// ---- thinking ----

function think(state: MatchState, p: PlayerState, mem: BrainMemory): void {
  const level = LEVELS[state.config.level[p.team]], role = roleOf(state, p);
  Object.assign(mem, {
    thinkAt: state.tick + level.reactionTicks, role, target: { ...p.pos }, action: 'none', aim: { ...ZERO }, turbo: false,
    thinkOwner: state.ball.owner, targetPlayer: null, aimError: 0,
  }, planFor(state, p, role, level));
}

/** Time to re-think: the plan is due, the player gained or lost the ball, or the ball changed team (or became loose / free). */
function needsThink(state: MatchState, p: PlayerState, mem: BrainMemory): boolean {
  const owner = state.ball.owner;
  if (state.tick >= mem.thinkAt) return true;
  if ((mem.thinkOwner === p.id) !== (owner === p.id)) return true;
  return ballSide(state, p.team, mem.thinkOwner) !== ballSide(state, p.team, owner);
}

// ---- replaying the plan ----

function endHold(mem: BrainMemory): void {
  mem.holdHitUntil = 0;
  mem.aimError = 0;
}

/** Where the plan's target is right now: the player it names (live), else the planned spot. */
function targetNow(state: MatchState, mem: BrainMemory): Vec {
  return mem.targetPlayer === null ? mem.target : state.players[mem.targetPlayer].pos;
}

/** Where to move while walking the plan: toward the intercept point of the player it names (live), else the planned spot. */
function walkTarget(state: MatchState, p: PlayerState, mem: BrainMemory): Vec {
  return mem.targetPlayer === null ? mem.target : interceptPoint(p, state.players[mem.targetPlayer]);
}

/** A charge that cannot complete is released as whatever it becomes (target out of reach), or ends (he has the ball). */
function settleHold(state: MatchState, p: PlayerState, mem: BrainMemory, level: LevelSpec): void {
  if (state.ball.owner === p.id) endHold(mem);
  else if (state.tick < mem.holdHitUntil && dist(p.pos, targetNow(state, mem)) > CHARGE_ABORT_RANGE_FACTOR * level.hitRange) mem.holdHitUntil = state.tick;
}

function startHold(state: MatchState, mem: BrainMemory, ticks: number): void {
  mem.holdHitUntil = state.tick + ticks;
}

/** One tick of the stored plan: move toward the target, press each stored button once, and run a hit hold to its release. */
function replay(state: MatchState, p: PlayerState, mem: BrainMemory): BrainIntent {
  if (mem.holdHitUntil > 0) {
    const releasing = state.tick >= mem.holdHitUntil;
    const heading = rotate(norm(sub(targetNow(state, mem), p.pos)), mem.aimError); // the lunge goes where the target is now, off by the drawn error
    const intent = releasing ? { ...neutralIntent(), moveX: heading.x, moveY: heading.y } : moveOrHold(p, targetNow(state, mem));
    if (releasing) endHold(mem);
    return { ...intent, hitHeld: !releasing };
  }
  const intent: BrainIntent = moveOrHold(p, walkTarget(state, p, mem));
  intent.turbo = mem.turbo && !isHumanTeammate(state, p) && p.turboTicks === 0 && state.turbo[p.team] >= TURBO_COST;
  const action = mem.action;
  mem.action = 'none'; // a stored button is pressed once
  if (action === 'tap' || action === 'chargeBig') {
    startHold(state, mem, action === 'tap' ? BRAIN_TAP_TICKS : BIG_HIT_CHARGE_TICKS + BRAIN_BIG_HOLD_EXTRA_TICKS);
    return { ...intent, hitPress: true, hitHeld: true };
  }
  if ((action === 'pass' || action === 'shot') && state.ball.owner === p.id) { // a plan for a ball he no longer has is dropped
    return { ...intent, kick: action, aim: { ...mem.aim } };
  }
  return intent;
}

/**
 * The computer's intent for one player this tick. He re-thinks when `state.tick >= thinkAt` or the ball situation changed
 * for him, and otherwise replays the stored plan. (A player who cannot act has his memory reset by `step`.)
 */
export function brainIntent(state: MatchState, p: PlayerState): BrainIntent {
  const mem = state.brain[p.id];
  const level = LEVELS[state.config.level[p.team]];
  if (mem.holdHitUntil > 0) settleHold(state, p, mem, level); // a hit in progress is not re-planned
  else if (needsThink(state, p, mem)) think(state, p, mem);
  return replay(state, p, mem);
}
