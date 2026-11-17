import type { MatchConfig, MatchState, PadInput, PlayerState, TeamId, Vec } from './types';
import {
  FIELD_MID_Y, FIELD_W, FORMATION, KICKER_BEHIND_BALL, KICKOFF_PAUSE_TICKS, TICK_HZ,
} from './constants';
import { dist } from './vec';

const KICKOFF_SPOT: Vec = { x: FIELD_W / 2, y: FIELD_MID_Y };
const PLAYERS_PER_TEAM = FORMATION.length;
const KEEPER_INDEX = 0;
const STRIKER_INDEX = PLAYERS_PER_TEAM - 1;

export function attackDir(team: TeamId): 1 | -1 { return team === 0 ? 1 : -1; }

/** Centre of the goal that `defending` protects. */
export function goalCenter(defending: TeamId): Vec {
  return { x: defending === 0 ? 0 : FIELD_W, y: FIELD_MID_Y };
}

export function neutralPad(): PadInput {
  return { moveX: 0, moveY: 0, pass: false, shoot: false, hit: false, turbo: false };
}

function makePlayer(team: TeamId, index: number): PlayerState {
  const f = FORMATION[index];
  const anchor = { x: team === 0 ? f.x : FIELD_W - f.x, y: f.y };
  return {
    id: team * PLAYERS_PER_TEAM + index, team, role: index === KEEPER_INDEX ? 'gk' : 'out',
    pos: { ...anchor }, vel: { x: 0, y: 0 }, facing: { x: attackDir(team), y: 0 }, anchor,
    kickCooldown: 0, turboTicks: 0, anim: 'idle', animTick: 0,
  };
}

/** Resets every player and the ball for a kickoff by `kicking`. */
export function placeForKickoff(state: MatchState, kicking: TeamId): void {
  for (const p of state.players) {
    p.pos = { ...p.anchor };
    p.vel = { x: 0, y: 0 };
    p.facing = { x: attackDir(p.team), y: 0 };
    p.kickCooldown = 0; p.turboTicks = 0; p.anim = 'idle'; p.animTick = 0;
  }
  state.ball = { pos: { ...KICKOFF_SPOT }, vel: { x: 0, y: 0 }, owner: null, ownerTicks: 0, passTarget: null };

  const kicker = state.players[kicking * PLAYERS_PER_TEAM + STRIKER_INDEX];
  kicker.pos = { x: KICKOFF_SPOT.x - attackDir(kicking) * KICKER_BEHIND_BALL, y: KICKOFF_SPOT.y };
  state.ball.owner = kicker.id;
  state.controlled[kicking] = kicker.id;

  const other: TeamId = kicking === 0 ? 1 : 0;
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
  const state: MatchState = {
    config, tick: 0, rng: config.seed,
    phase: 'kickoff', phaseTicks: 0, half: 1, clockTicks: config.halfSeconds * TICK_HZ,
    score: [0, 0], kickoffTeam: 0,
    players, ball: { pos: { ...KICKOFF_SPOT }, vel: { x: 0, y: 0 }, owner: null, ownerTicks: 0, passTarget: null },
    controlled: [0, 0], turbo: [1, 1],
    prevInput: [neutralPad(), neutralPad()], events: [],
  };
  placeForKickoff(state, 0);
  return state;
}
