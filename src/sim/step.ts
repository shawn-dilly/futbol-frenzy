import type { MatchState, PadInput, PlayerIntent, PlayerState } from './types';
import { applyMovement, updateTurboMeters } from './movement';
import { moveFreeBall } from './ball';

const NO_INTENT: PlayerIntent = { moveX: 0, moveY: 0, pass: false, shoot: false, turbo: false };

/** Pass/shoot/turbo are true only on the tick the button goes down. */
export function padToIntent(pad: PadInput, prev: PadInput): PlayerIntent {
  return {
    moveX: pad.moveX, moveY: pad.moveY,
    pass: pad.pass && !prev.pass,
    shoot: pad.shoot && !prev.shoot,
    turbo: pad.turbo && !prev.turbo,
  };
}

/** The one place a player's intent is decided. Brain-driven players arrive in a later task. */
function intentFor(state: MatchState, p: PlayerState, inputs: [PadInput, PadInput]): PlayerIntent {
  const human = state.config.human[p.team] && state.controlled[p.team] === p.id;
  return human ? padToIntent(inputs[p.team], state.prevInput[p.team]) : NO_INTENT;
}

function stepKickoff(state: MatchState): void {
  state.phaseTicks -= 1;
  if (state.phaseTicks <= 0) state.phase = 'play';
}

function stepPlay(state: MatchState, inputs: [PadInput, PadInput]): void {
  for (const p of state.players) applyMovement(state, p, intentFor(state, p, inputs));
  updateTurboMeters(state);
  moveFreeBall(state);
}

export function step(state: MatchState, inputs: [PadInput, PadInput]): void {
  state.events = [];
  if (state.phase === 'kickoff') stepKickoff(state);
  else if (state.phase === 'play') stepPlay(state, inputs);
  state.prevInput = [{ ...inputs[0] }, { ...inputs[1] }];
  state.tick += 1;
}
