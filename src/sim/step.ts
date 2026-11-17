import type { MatchState, PadInput, PlayerIntent, PlayerState } from './types';
import { applyMovement, updateTurboMeters } from './movement';
import { moveFreeBall } from './ball';
import { kick, switchControl, tickKickCooldowns, updatePossession } from './possession';

const idleIntent = (): PlayerIntent => ({ moveX: 0, moveY: 0, pass: false, shoot: false, turbo: false });

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
  return human ? padToIntent(inputs[p.team], state.prevInput[p.team]) : idleIntent();
}

function stepKickoff(state: MatchState): void {
  state.phaseTicks -= 1;
  if (state.phaseTicks <= 0) state.phase = 'play';
}

/** Human kicks and control switching, from this tick's intents. */
function applyHumanActions(state: MatchState, intents: PlayerIntent[]): void {
  for (const team of [0, 1] as const) {
    if (!state.config.human[team]) continue;
    const p = state.players[state.controlled[team]];
    const intent = intents[p.id];
    const hasBall = state.ball.owner === p.id;
    const moveDir = { x: intent.moveX, y: intent.moveY };
    if (intent.pass) {
      if (hasBall) kick(state, p, 'pass', moveDir); else switchControl(state, team);
    } else if (intent.shoot && hasBall) kick(state, p, 'shot', moveDir);
  }
}

function stepPlay(state: MatchState, inputs: [PadInput, PadInput]): void {
  tickKickCooldowns(state);
  const intents = state.players.map(p => intentFor(state, p, inputs));
  applyHumanActions(state, intents);
  for (const p of state.players) applyMovement(state, p, intents[p.id]);
  updateTurboMeters(state);
  updatePossession(state);
  moveFreeBall(state);
}

export function step(state: MatchState, inputs: [PadInput, PadInput]): void {
  state.events = [];
  if (state.phase === 'kickoff') stepKickoff(state);
  else if (state.phase === 'play') stepPlay(state, inputs);
  state.prevInput = [{ ...inputs[0] }, { ...inputs[1] }];
  state.tick += 1;
}
