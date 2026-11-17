import { hurtAnimKey } from '../content/animations';
import type { PlayerState } from '../sim';

export type AnimKey = string;

/** The animation a player should show, derived from sim state. Free players loop on the match tick; every other status plays from its own start. */
export function animFor(p: PlayerState, matchTick: number): { key: AnimKey; tick: number } {
  const s = p.status;
  switch (s.kind) {
    case 'free': return { key: p.vel.x !== 0 || p.vel.y !== 0 ? 'run' : 'idle', tick: matchTick };
    case 'kicking': return { key: 'kick', tick: p.statusTick };
    case 'charging': return { key: 'charge', tick: p.statusTick };
    case 'lunging': return { key: `lunge_${s.hit}`, tick: p.statusTick };
    case 'recovering': return { key: s.landed ? 'idle' : `recover_${s.hit}`, tick: p.statusTick };
    case 'hurt': return { key: hurtAnimKey(s.tier, s.variant), tick: p.statusTick };
  }
}
