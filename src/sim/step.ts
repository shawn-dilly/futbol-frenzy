import type { MatchState, PadInput, PlayerIntent, PlayerState, TeamId, Vec } from './types';
import { applyMovement, updateTurboMeters } from './movement';
import { moveFreeBall } from './ball';
import { advanceFlow } from './flow';
import { brainIntent, type BrainIntent } from './brain';
import { kick, switchControl, tickKickCooldowns, updatePossession } from './possession';

/** Pass/shoot/turbo are true only on the tick the button goes down. */
export function padToIntent(pad: PadInput, prev: PadInput): PlayerIntent {
  return {
    moveX: pad.moveX, moveY: pad.moveY,
    pass: pad.pass && !prev.pass,
    shoot: pad.shoot && !prev.shoot,
    turbo: pad.turbo && !prev.turbo,
  };
}

/** The one place a player's intent is decided: the pad for a human team's controlled player, the brain for everyone else. */
function intentFor(state: MatchState, p: PlayerState, inputs: [PadInput, PadInput]): BrainIntent {
  const human = state.config.human[p.team] && state.controlled[p.team] === p.id;
  return human ? padToIntent(inputs[p.team], state.prevInput[p.team]) : brainIntent(state, p);
}

/** The kick a player asks for this tick, if any. A human pass without the ball switches control instead. */
function requestedKick(state: MatchState, p: PlayerState, intent: BrainIntent): { kind: 'pass' | 'shot'; aim: Vec } | null {
  if (!(state.config.human[p.team] && state.controlled[p.team] === p.id)) {
    return intent.kick ? { kind: intent.kick, aim: intent.aim ?? { x: 0, y: 0 } } : null;
  }
  const hasBall = state.ball.owner === p.id;
  const moveDir = { x: intent.moveX, y: intent.moveY };
  if (intent.pass) {
    if (hasBall) return { kind: 'pass', aim: moveDir };
    switchControl(state, p.team);
    return null;
  }
  return intent.shoot && hasBall ? { kind: 'shot', aim: moveDir } : null;
}

/** Kicks and control switching, from this tick's intents. */
function applyActions(state: MatchState, intents: BrainIntent[]): void {
  for (const p of state.players) {
    const req = requestedKick(state, p, intents[p.id]);
    if (req) kick(state, p, req.kind, req.aim);
  }
}

function stepPlay(state: MatchState, inputs: [PadInput, PadInput]): TeamId | null {
  tickKickCooldowns(state);
  const intents = state.players.map(p => intentFor(state, p, inputs));
  applyActions(state, intents);
  for (const p of state.players) applyMovement(state, p, intents[p.id]);
  updateTurboMeters(state);
  updatePossession(state);
  return moveFreeBall(state);
}

export function step(state: MatchState, inputs: [PadInput, PadInput]): void {
  state.events = [];
  const finished = state.phase === 'fulltime'; // terminal: nothing changes but events and tick
  const scored = state.phase === 'play' ? stepPlay(state, inputs) : null;
  advanceFlow(state, scored);
  if (!finished) state.prevInput = [{ ...inputs[0] }, { ...inputs[1] }];
  state.tick += 1;
}
