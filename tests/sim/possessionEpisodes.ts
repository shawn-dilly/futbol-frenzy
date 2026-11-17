import type { MatchState } from '../../src/sim/types';

export type Reason = 'hit' | 'kick' | 'transfer' | 'control-switch' | 'loss' | 'phase';
export interface Episode { ticks: number; reason: Reason; censored: boolean }
type Sample = Pick<MatchState, 'phase' | 'ball' | 'controlled' | 'players' | 'events'>;

/** Tracks consecutive play ticks owned by the human-controlled player. */
export class PossessionEpisodes {
  episodes: Episode[] = [];
  private owner: number | null = null;
  private ticks = 0;
  observe(s: Sample, liveStep: boolean) {
    const owner = s.ball.owner;
    if (this.owner !== null && (s.phase !== 'play' || owner !== this.owner || s.controlled[0] !== this.owner)) {
      const previous = this.owner;
      const reason: Reason = s.phase !== 'play' ? 'phase'
        : s.events.some(e => e.type === 'hit' && e.victim === previous) ? 'hit'
        : s.events.some(e => e.type === 'kick' && e.player === previous) ? 'kick'
        : owner === previous ? 'control-switch'
        : owner !== null && s.players[owner].team === s.players[previous].team ? 'transfer' : 'loss';
      this.episodes.push({ ticks: this.ticks, reason, censored: reason === 'phase' });
      this.owner = null; this.ticks = 0;
    }
    if (liveStep && s.phase === 'play' && owner !== null && owner === s.controlled[0]) {
      this.owner = owner; this.ticks++;
    }
  }
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
