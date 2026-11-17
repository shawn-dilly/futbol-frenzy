import type { BrainMemory, MatchConfig, MatchState, PadInput, PlayerIntent, PlayerState, Ratings, TeamId, Vec } from './types';
import {
  FIELD_MID_Y, FIELD_W, FORMATION, KICKER_BEHIND_BALL, KICKOFF_PAUSE_TICKS, MAX_HEALTH, TICK_HZ,
} from './constants';
import { dist } from './vec';
import { LEVELS } from './levels';
import { setStatus } from './status';

const KICKOFF_SPOT: Vec = { x: FIELD_W / 2, y: FIELD_MID_Y };
const PLAYERS_PER_TEAM = FORMATION.length;
const KEEPER_INDEX = 0;
const STRIKER_INDEX = PLAYERS_PER_TEAM - 1;

export function attackDir(team: TeamId): 1 | -1 { return team === 0 ? 1 : -1; }

export function otherTeam(team: TeamId): TeamId { return team === 0 ? 1 : 0; }

/** Centre of the goal that `defending` protects. */
export function goalCenter(defending: TeamId): Vec {
  return { x: defending === 0 ? 0 : FIELD_W, y: FIELD_MID_Y };
}

export function neutralPad(): PadInput {
  return { moveX: 0, moveY: 0, pass: false, shoot: false, hit: false, turbo: false };
}

/** A fresh do-nothing intent; a new object every call so callers may extend it freely. */
export function neutralIntent(): PlayerIntent {
  return { moveX: 0, moveY: 0, pass: false, shoot: false, turbo: false, hitPress: false, hitHeld: false };
}

export function blankMemory(): BrainMemory {
  return { thinkAt: 0, role: 'support', target: { x: 0, y: 0 }, action: 'none', aim: { x: 0, y: 0 }, turbo: false, holdHitUntil: 0, thinkOwner: null, targetPlayer: null, aimError: 0 };
}

function makePlayer(team: TeamId, index: number): PlayerState {
  const f = FORMATION[index];
  const anchor = { x: team === 0 ? f.x : FIELD_W - f.x, y: f.y };
  return {
    id: team * PLAYERS_PER_TEAM + index, team, role: index === KEEPER_INDEX ? 'gk' : 'out',
    pos: { ...anchor }, vel: { x: 0, y: 0 }, facing: { x: attackDir(team), y: 0 }, anchor,
    kickCooldown: 0, turboTicks: 0,
    status: { kind: 'free' }, statusTick: 0, statusTicks: 0,
    health: MAX_HEALTH, hitCooldown: 0, knock: { x: 0, y: 0 },
  };
}

/** Resets every player and the ball for a kickoff by `kicking`. */
export function placeForKickoff(state: MatchState, kicking: TeamId): void {
  for (const p of state.players) {
    p.pos = { ...p.anchor };
    p.vel = { x: 0, y: 0 };
    p.facing = { x: attackDir(p.team), y: 0 };
    p.kickCooldown = 0; p.turboTicks = 0; p.hitCooldown = 0; p.knock = { x: 0, y: 0 };
    setStatus(p, { kind: 'free' }, 0);
  }
  state.brain = state.players.map(blankMemory);
  state.liveTicks = 0;
  state.defensiveHitAt = state.players.map(p => LEVELS[state.config.level[p.team]].defensiveHitIntervalTicks);
  state.ball = { pos: { ...KICKOFF_SPOT }, vel: { x: 0, y: 0 }, owner: null, ownerTicks: 0, passTarget: null };

  const kicker = state.players[kicking * PLAYERS_PER_TEAM + STRIKER_INDEX];
  kicker.pos = { x: KICKOFF_SPOT.x - attackDir(kicking) * KICKER_BEHIND_BALL, y: KICKOFF_SPOT.y };
  state.ball.owner = kicker.id;
  state.controlled[kicking] = kicker.id;

  const other = otherTeam(kicking);
  let nearest = -1, best = Infinity;
  for (const p of state.players) {
    if (p.team !== other || p.role === 'gk') continue;
    const d = dist(p.pos, state.ball.pos);
    if (d < best) { best = d; nearest = p.id; }
  }
  state.controlled[other] = nearest;

  state.phase = 'kickoff';
  state.phaseTicks = KICKOFF_PAUSE_TICKS;
  state.events.push({ type: 'whistle', what: 'kickoff' });
}

export function createMatch(config: MatchConfig): MatchState {
  const players: PlayerState[] = [];
  for (const team of [0, 1] as const) {
    for (let i = 0; i < PLAYERS_PER_TEAM; i++) players.push(makePlayer(team, i));
  }
  const normalize = (ratings?: Ratings): Ratings => {
    const value = (n: number | undefined) => Number.isFinite(n) ? Math.max(0, Math.min(1, n!)) : 0.5;
    return { speed: value(ratings?.speed), power: value(ratings?.power), skill: value(ratings?.skill), dirty: value(ratings?.dirty) };
  };
  const normalizedConfig = { ...config, human: [...config.human] as MatchConfig['human'], level: [...config.level] as MatchConfig['level'], ratings: [normalize(config.ratings?.[0]), normalize(config.ratings?.[1])] as [Ratings, Ratings] };
  const state: MatchState = {
    config: normalizedConfig, tick: 0, rng: config.seed,
    phase: 'kickoff', phaseTicks: 0, half: 1, clockTicks: config.halfSeconds * TICK_HZ,
    score: [0, 0], kickoffTeam: 0, rage: [0, 0], lastHitTick: [0, 0],
    players, ball: { pos: { ...KICKOFF_SPOT }, vel: { x: 0, y: 0 }, owner: null, ownerTicks: 0, passTarget: null },
    brain: players.map(blankMemory), liveTicks: 0, defensiveHitAt: [], controlled: [0, 0], turbo: [1, 1],
    prevInput: [neutralPad(), neutralPad()], events: [],
  };
  placeForKickoff(state, 0);
  return state;
}
