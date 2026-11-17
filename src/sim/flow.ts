import type { MatchState, TeamId } from './types';
import { GOAL_PAUSE_TICKS, HALFTIME_PAUSE_TICKS, TICK_HZ } from './constants';
import { placeForKickoff } from './setup';

/** Counts the current pause down; true on the tick it reaches 0. */
function pauseElapsed(state: MatchState): boolean {
  state.phaseTicks -= 1;
  return state.phaseTicks <= 0;
}

function advancePlay(state: MatchState, scored: TeamId | null): void {
  if (scored !== null) {
    state.score[scored] += 1;
    state.events.push({ type: 'goal', team: scored });
    state.phase = 'goal';
    state.phaseTicks = GOAL_PAUSE_TICKS;
    state.kickoffTeam = scored === 0 ? 1 : 0;
    return;
  }
  state.clockTicks -= 1;
  if (state.clockTicks > 0) return;
  if (state.half === 1) {
    state.phase = 'halftime';
    state.phaseTicks = HALFTIME_PAUSE_TICKS;
    state.events.push({ type: 'whistle', what: 'halftime' });
  } else {
    state.phase = 'fulltime';
    state.events.push({ type: 'whistle', what: 'fulltime' });
  }
}

/** Called once at the end of every tick; `scored` is moveFreeBall's result (null outside 'play'). */
export function advanceFlow(state: MatchState, scored: TeamId | null): void {
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
