import type { BrainMemory, BrainRole, MatchState, PlayerIntent, PlayerState, Vec } from './types';
import {
  ARRIVE_DIST, BIG_HIT_CHARGE_TICKS, BRAIN_BIG_HOLD_EXTRA_TICKS, BRAIN_TAP_TICKS, CHARGE_ABORT_RANGE_FACTOR, TURBO_COST,
} from './constants';
import { neutralIntent } from './setup';
import { LEVELS, type LevelSpec } from './levels';
import { ballSide, roleOf } from './brainRoles';
import { interceptPoint, planDefence } from './brainDefend';
import { planCarrier, planSupport } from './brainAttack';
import { planKeeper } from './brainKeeper';
import { isHumanTeammate } from './status';
import { dist, norm, rotate, sub } from './vec';

export type BrainIntent = PlayerIntent & { kick?: 'pass' | 'shot'; aim?: Vec };

const ZERO: Vec = { x: 0, y: 0 };

const move = (p: PlayerState, target: Vec): BrainIntent => {
  const d = norm(sub(target, p.pos));
  return { ...neutralIntent(), moveX: d.x, moveY: d.y };
};

/** Like `move`, but stands still once within ARRIVE_DIST of the target. */
const moveOrHold = (p: PlayerState, target: Vec): BrainIntent =>
  dist(p.pos, target) < ARRIVE_DIST ? move(p, p.pos) : move(p, target);

// ---- choosing the plan for a role ----

function planFor(state: MatchState, p: PlayerState, role: BrainRole, level: LevelSpec): Partial<BrainMemory> {
  switch (role) {
    case 'keeper': return planKeeper(state, p, level);
    case 'carrier': return planCarrier(state, p, level);
    case 'presser': case 'cover': case 'marker': return planDefence(state, p, role, level);
    case 'chaser': case 'receiver': return { target: { ...state.ball.pos } };
    default: return planSupport(state, p, level);
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
    state.defensiveHitAt[p.id] = state.liveTicks + LEVELS[state.config.level[p.team]].defensiveHitIntervalTicks;
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
