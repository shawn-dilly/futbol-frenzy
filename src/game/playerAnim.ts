import { GETUP_TICKS, hurtAnimKey } from '../content/animations';
import type { PlayerState } from '../sim';

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
  if (getsUp(s)) {
    // A landed hit is all get-up; otherwise the get-up fills the last GETUP_TICKS of a timed status.
    if (s.kind === 'recovering' && s.landed) return { key: 'getup', tick: p.statusTick };
    const getupStart = p.statusTicks - GETUP_TICKS;
    if (p.statusTicks > 0 && p.statusTick >= getupStart) return { key: 'getup', tick: p.statusTick - getupStart };
  }
  switch (s.kind) {
    case 'kicking': return { key: 'kick', tick: p.statusTick };
    case 'charging': return { key: 'charge', tick: p.statusTick };
    case 'lunging': return { key: `lunge_${s.hit}`, tick: p.statusTick };
    case 'recovering': return { key: s.landed ? 'idle' : `recover_${s.hit}`, tick: p.statusTick };
    case 'hurt': return { key: hurtAnimKey(s.tier, s.variant), tick: p.statusTick };
  }
}
