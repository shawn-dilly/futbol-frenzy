import { ANIMATIONS, GETUP_TICKS, hurtAnimKey } from '../content/animations';
import { clamp, FIELD_W, FORMATION, KICKOFF_PAUSE_TICKS, type PlayerState } from '../sim';

const CONTACT_POSE_TICKS = 5;

export type AnimKey = string;

/** Whether the status ends with the player getting up: knocked down or worse, or a slide or big hit (they end lying or diving). */
function getsUp(s: PlayerState['status']): boolean {
  if (s.kind === 'hurt') return s.tier !== 'stumble';
  return s.kind === 'recovering' && s.hit !== 'shoulder';
}

/** The animation a player should show, derived from sim state. Free players loop on the match tick; every other status plays from its own start. */
export function animFor(p: PlayerState, matchTick: number): { key: AnimKey; tick: number } {
  const s = p.status;
  if (s.kind === 'free') return { key: p.vel.x !== 0 || p.vel.y !== 0 ? 'run' : 'idle', tick: matchTick };
  if (s.kind === 'recovering' && s.landed) {
    // Contact may resolve on the launch tick before a lunge was ever drawn.
    if (p.statusTick < CONTACT_POSE_TICKS) {
      const key = `lunge_${s.hit}`;
      const def = ANIMATIONS[key];
      return { key, tick: (def.frames.length - 1) * def.ticksPerFrame };
    }
    return { key: s.hit === 'shoulder' ? 'recover_shoulder' : 'getup', tick: p.statusTick };
  }
  if (getsUp(s)) {
    const getupStart = p.statusTicks - GETUP_TICKS;
    if (p.statusTicks > 0 && p.statusTick >= getupStart) return { key: 'getup', tick: p.statusTick - getupStart };
  }
  switch (s.kind) {
    case 'kicking': return { key: 'kick', tick: p.statusTick };
    case 'charging': return { key: 'charge', tick: p.statusTick };
    case 'lunging': return { key: `lunge_${s.hit}`, tick: p.statusTick };
    case 'recovering': return { key: `recover_${s.hit}`, tick: p.statusTick };
    case 'hurt': return { key: hurtAnimKey(s.tier, s.variant), tick: p.statusTick };
  }
}

const RUN_ON = {
  staggerTicks: 2, travelTicks: KICKOFF_PAUSE_TICKS - 16, easing: 1.4,
  entryY: 0, teamOffsetX: 46, playerSpacingX: 9,
};

/** Render both teams entering from the far touchline, settling before the whistle. */
export function runOnPlayer(p: PlayerState, phaseTicks: number): PlayerState {
  const slot = p.id % FORMATION.length;
  const elapsed = KICKOFF_PAUSE_TICKS - phaseTicks;
  const travel = clamp((elapsed - slot * RUN_ON.staggerTicks) / RUN_ON.travelTicks, 0, 1);
  const remaining = (1 - travel) ** RUN_ON.easing;
  const entryX = FIELD_W / 2 + (p.team ? 1 : -1) * (RUN_ON.teamOffsetX + slot * RUN_ON.playerSpacingX);
  const pos = { x: p.pos.x + (entryX - p.pos.x) * remaining, y: p.pos.y + (RUN_ON.entryY - p.pos.y) * remaining };
  if (remaining === 0) return p;
  const facing = { x: Math.sign(p.pos.x - entryX), y: 1 };
  return { ...p, pos, facing, vel: facing };
}
