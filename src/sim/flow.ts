import type { MatchState, TeamId } from './types';
import { GOAL_PAUSE_TICKS, HALFTIME_HEAL, HALFTIME_PAUSE_TICKS, MAX_HEALTH, RAGE_CONCEDE_GAIN, TICK_HZ } from './constants';
import { addRage } from './rage';
import { otherTeam, placeForKickoff } from './setup';

/** Counts the current pause down; true on the tick it reaches 0. */
function pauseElapsed(state: MatchState): boolean {
  state.phaseTicks -= 1;
  return state.phaseTicks <= 0;
}

function advancePlay(state: MatchState, scored: TeamId | null): void {
  if (scored !== null) {
    state.score[scored] += 1;
    addRage(state, otherTeam(scored), RAGE_CONCEDE_GAIN);
    state.events.push({ type: 'goal', team: scored });
    state.phase = 'goal';
    state.phaseTicks = GOAL_PAUSE_TICKS;
    state.kickoffTeam = otherTeam(scored);
    return;
  }
  state.clockTicks -= 1;
  if (state.clockTicks > 0) return;
  if (state.half === 1) {
    for (const p of state.players) p.health = Math.min(MAX_HEALTH, p.health + HALFTIME_HEAL);
    state.phase = 'halftime';
    state.phaseTicks = HALFTIME_PAUSE_TICKS;
    state.events.push({ type: 'whistle', what: 'halftime' });
  } else {
    state.phase = 'fulltime';
    state.events.push({ type: 'whistle', what: 'fulltime' });
  }
}

/** Play has stopped: nobody keeps the velocity they had, so nobody animates as running. */
function stopPlayers(state: MatchState): void {
  for (const p of state.players) p.vel = { x: 0, y: 0 };
}

/** Called once at the end of every tick; `scored` is moveFreeBall's result (null outside 'play'). */
export function advanceFlow(state: MatchState, scored: TeamId | null): void {
  const wasPlaying = state.phase === 'play';
  runPhase(state, scored);
  if (wasPlaying && state.phase !== 'play') stopPlayers(state);
}

function runPhase(state: MatchState, scored: TeamId | null): void {
  switch (state.phase) {
    case 'kickoff':
      if (pauseElapsed(state)) state.phase = 'play';
      break;
    case 'play':
      advancePlay(state, scored);
      break;
    case 'goal':
      if (pauseElapsed(state)) placeForKickoff(state, state.kickoffTeam);
      break;
    case 'halftime':
      if (pauseElapsed(state)) {
        state.half = 2;
        state.clockTicks = state.config.halfSeconds * TICK_HZ;
        placeForKickoff(state, 1);
      }
      break;
    case 'fulltime':
      break;
  }
}
