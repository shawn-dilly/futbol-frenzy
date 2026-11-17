import type { HitType, HurtTier, MatchState, TeamId } from './types';
import {
  HITS, HURT, HURT_TIERS, RAGE_BIG_HIT_SPEND, RAGE_DAMAGE_FACTOR, RAGE_DECAY_DELAY_TICKS, RAGE_DECAY_PER_TICK,
  RAGE_MAX, RAGE_VICTIM_GAIN, TEAM_POWER, TURBO_HIT_FACTOR,
} from './constants';
import { clamp } from './vec';

/** Damage of a hit: base, scaled up by the tackler's team rage, team power and an active turbo burst. */
export function hitDamage(hit: HitType, rage: number, turboActive: boolean): number {
  return HITS[hit].base * (1 + RAGE_DAMAGE_FACTOR * rage / RAGE_MAX) * TEAM_POWER * (turboActive ? TURBO_HIT_FACTOR : 1);
}

/** The highest tier whose minimum damage the hit reaches. */
export function tierFor(damage: number): HurtTier {
  let tier = HURT_TIERS[0];
  for (const t of HURT_TIERS) if (damage >= HURT[t].minDamage) tier = t;
  return tier;
}

export function addRage(state: MatchState, team: TeamId, amount: number): void {
  state.rage[team] = clamp(state.rage[team] + amount, 0, RAGE_MAX);
}

/** A hit landed: the tackler's team gains rage (and spends some on a wipeout or worse), the victim's team gains a little. */
export function rageAfterHit(state: MatchState, tacklerTeam: TeamId, tier: HurtTier): void {
  const victimTeam: TeamId = tacklerTeam === 0 ? 1 : 0;
  addRage(state, tacklerTeam, HURT[tier].rageGain);
  if (tier === 'wipeout' || tier === 'overTheTop') addRage(state, tacklerTeam, -RAGE_BIG_HIT_SPEND);
  addRage(state, victimTeam, RAGE_VICTIM_GAIN);
  state.lastHitTick[tacklerTeam] = state.tick;
}

/** Once per tick: a team that has not landed a hit for RAGE_DECAY_DELAY_TICKS loses rage steadily. */
export function decayRage(state: MatchState): void {
  for (const team of [0, 1] as const) {
    if (state.tick - state.lastHitTick[team] >= RAGE_DECAY_DELAY_TICKS) addRage(state, team, -RAGE_DECAY_PER_TICK);
  }
}
