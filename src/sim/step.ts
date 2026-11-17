import type { MatchState, PadInput, PlayerIntent, PlayerState, TeamId, Vec } from './types';
import { applyKnockOnly, applyMovement, updateTurboMeters } from './movement';
import { moveFreeBall } from './ball';
import { advanceFlow } from './flow';
import { brainIntent, type BrainIntent } from './brain';
import { resolveContacts, updateAttack } from './attack';
import { neutralIntent } from './setup';
import { canAct, tickStatus } from './status';
import { decayRage } from './rage';
import { kick, switchControl, tickKickCooldowns, updatePossession } from './possession';

/** Pass/shoot/turbo are true only on the tick the button goes down. */
export function padToIntent(pad: PadInput, prev: PadInput): PlayerIntent {
  return {
    moveX: pad.moveX, moveY: pad.moveY,
    pass: pad.pass && !prev.pass,
    shoot: pad.shoot && !prev.shoot,
    turbo: pad.turbo && !prev.turbo,
    hitPress: pad.hit && !prev.hit,
    hitHeld: pad.hit,
  };
}

const isHumanControlled = (state: MatchState, p: PlayerState): boolean =>
  state.config.human[p.team] && state.controlled[p.team] === p.id;

/** The one place a player's intent is decided: nothing if he cannot act, else the pad for a human team's controlled player, the brain for everyone else. */
function intentFor(state: MatchState, p: PlayerState, inputs: [PadInput, PadInput]): BrainIntent {
  if (!canAct(p)) return neutralIntent();
  return isHumanControlled(state, p) ? padToIntent(inputs[p.team], state.prevInput[p.team]) : brainIntent(state, p);
}

/** The kick a player asks for this tick, if any (a human pass without the ball is not a kick). */
function kickRequest(state: MatchState, p: PlayerState, intent: BrainIntent): { kind: 'pass' | 'shot'; aim: Vec } | null {
  if (!isHumanControlled(state, p)) {
    return intent.kick ? { kind: intent.kick, aim: intent.aim ?? { x: 0, y: 0 } } : null;
  }
  if (state.ball.owner !== p.id) return null;
  const moveDir = { x: intent.moveX, y: intent.moveY };
  if (intent.pass) return { kind: 'pass', aim: moveDir };
  return intent.shoot ? { kind: 'shot', aim: moveDir } : null;
}

/** Kicks (human and brain, one path) and human control switching, from this tick's intents. */
function applyActions(state: MatchState, intents: BrainIntent[]): void {
  for (const p of state.players) {
    const req = kickRequest(state, p, intents[p.id]);
    if (req) kick(state, p, req.kind, req.aim);
    else if (isHumanControlled(state, p) && intents[p.id].pass && state.ball.owner !== p.id) switchControl(state, p.team);
  }
}

function stepPlay(state: MatchState, inputs: [PadInput, PadInput]): TeamId | null {
  tickKickCooldowns(state);
  for (const p of state.players) { p.hitCooldown = Math.max(0, p.hitCooldown - 1); tickStatus(p); }
  const intents = state.players.map(p => intentFor(state, p, inputs));
  for (const p of state.players) updateAttack(state, p, intents[p.id]);
  applyActions(state, intents);
  for (const p of state.players) applyMovement(state, p, intents[p.id]);
  updateTurboMeters(state);
  resolveContacts(state);
  updatePossession(state);
  const scored = moveFreeBall(state);
  decayRage(state);
  return scored;
}

/** Play is stopped (goal, halftime, full time): no hits, but a flattened player still finishes his animation and slide. */
function stepPause(state: MatchState): void {
  for (const p of state.players) {
    if (p.status.kind !== 'free') tickStatus(p);
    applyKnockOnly(p);
  }
}

export function step(state: MatchState, inputs: [PadInput, PadInput]): void {
  state.events = [];
  const finished = state.phase === 'fulltime'; // terminal: nothing changes but events and tick
  if (state.phase !== 'play') stepPause(state);
  const scored = state.phase === 'play' ? stepPlay(state, inputs) : null;
  advanceFlow(state, scored);
  if (!finished) state.prevInput = [{ ...inputs[0] }, { ...inputs[1] }];
  state.tick += 1;
}
