import type { HitType, MatchState, PlayerState } from './types';
import {
  BIG_HIT_CHARGE_TICKS, BIG_HIT_MAX_HOLD_TICKS, CPU_HIT_COOLDOWN_TICKS, HIT_COOLDOWN_TICKS, HIT_LANDED_RECOVER_TICKS, HITS,
  LATE_HIT_COOLDOWN_TICKS, TURBO_COST,
} from './constants';
import type { BrainIntent } from './brain';
import { hurtPlayer } from './hurt';
import { hitDamage, rageAfterHit, tierFor } from './rage';
import { attackDir } from './setup';
import { isDown, isHumanControlled, setStatus } from './status';
import { dist, isZero, norm } from './vec';

/** The cooldown after a hit: the computer side waits at least CPU_HIT_COOLDOWN_TICKS, whatever the hit did. */
function cooldownAfter(state: MatchState, p: PlayerState, ticks: number): number {
  return state.config.human[p.team] ? ticks : Math.max(ticks, CPU_HIT_COOLDOWN_TICKS);
}

/** Starts the lunge: the facing is fixed here (the intent's heading if any, else the team's attack direction). */
function launch(p: PlayerState, hit: HitType, intent: BrainIntent): void {
  const heading = { x: intent.moveX, y: intent.moveY };
  if (!isZero(heading)) p.facing = norm(heading);
  if (isZero(p.facing)) p.facing = { x: attackDir(p.team), y: 0 };
  setStatus(p, { kind: 'lunging', hit }, HITS[hit].lungeTicks);
}

/** What a charge becomes on release: big with enough charge and turbo (spending it), else slide in a turbo burst, else shoulder. */
function releasedHit(state: MatchState, p: PlayerState): HitType {
  if (p.statusTick >= BIG_HIT_CHARGE_TICKS && state.turbo[p.team] >= TURBO_COST) {
    state.turbo[p.team] -= TURBO_COST;
    return 'big';
  }
  return p.turboTicks > 0 ? 'slide' : 'shoulder';
}

/** Charge start, release and launch for one player this tick. */
export function updateAttack(state: MatchState, p: PlayerState, intent: BrainIntent): void {
  if (p.status.kind === 'charging') {
    const stillHis = isHumanControlled(state, p);
    if (state.ball.owner === p.id || !stillHis) setStatus(p, { kind: 'free' }, 0); // picked the ball up, or control moved on: no hit
    else if (!intent.hitHeld || p.statusTick >= BIG_HIT_MAX_HOLD_TICKS) launch(p, releasedHit(state, p), intent);
    return;
  }
  // hitPress is an edge, so a button held through a hurt spell or a kickoff never starts a charge
  if (p.status.kind !== 'free' || p.hitCooldown > 0 || state.ball.owner === p.id) return;
  if (intent.hit) launch(p, intent.hit, intent);
  else if (intent.hitPress) setStatus(p, { kind: 'charging' }, 0);
}

/** The nearest opponent within reach who is not down and was not hurt earlier this tick. */
function findVictim(state: MatchState, tackler: PlayerState, reach: number): PlayerState | null {
  let best: PlayerState | null = null, bestDist = Infinity;
  for (const q of state.players) { // ascending id: ties go to the lower id
    if (q.team === tackler.team || isDown(q)) continue;
    if (q.status.kind === 'hurt' && q.statusTick === 0) continue;
    const d = dist(q.pos, tackler.pos);
    if (d <= reach && d < bestDist) { best = q; bestDist = d; }
  }
  return best;
}

function land(state: MatchState, tackler: PlayerState, victim: PlayerState, hit: HitType): void {
  const damage = hitDamage(hit, state.rage[tackler.team], tackler.turboTicks > 0);
  const tier = tierFor(damage);
  const late = state.ball.owner !== victim.id;
  const variant = hurtPlayer(state, victim, tier, tackler.facing, damage);
  rageAfterHit(state, tackler.team, tier);
  state.events.push({ type: 'hit', tackler: tackler.id, victim: victim.id, hit, tier, variant, damage, late });
  setStatus(tackler, { kind: 'recovering', hit, landed: true }, HIT_LANDED_RECOVER_TICKS);
  tackler.hitCooldown = cooldownAfter(state, tackler, late ? LATE_HIT_COOLDOWN_TICKS : HIT_COOLDOWN_TICKS);
}

function whiff(state: MatchState, tackler: PlayerState, hit: HitType): void {
  state.events.push({ type: 'whiff', player: tackler.id, hit });
  setStatus(tackler, { kind: 'recovering', hit, landed: false }, HITS[hit].missTicks);
  tackler.hitCooldown = cooldownAfter(state, tackler, HIT_COOLDOWN_TICKS);
}

/** After movement: every lunging player in ascending id lands on the nearest valid opponent, or whiffs on his last lunge tick. */
export function resolveContacts(state: MatchState): void {
  for (const p of state.players) {
    if (p.status.kind !== 'lunging') continue; // checked live: a player hurt earlier this tick no longer lunges
    const hit = p.status.hit;
    const victim = findVictim(state, p, HITS[hit].reach);
    if (victim) land(state, p, victim, hit);
    else if (p.statusTick >= HITS[hit].lungeTicks - 1) whiff(state, p, hit);
  }
}
