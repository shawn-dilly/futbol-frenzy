import type { HitType, MatchState, PlayerIntent, PlayerState, TeamId } from './types';
import {
  BIG_HIT_CHARGE_TICKS, BIG_HIT_MAX_HOLD_TICKS, HIT_COOLDOWN_TICKS, HIT_LANDED_RECOVER_TICKS, HITS,
  LATE_HIT_COOLDOWN_TICKS, TURBO_COST, RATING_POWER_MIN, RATING_POWER_SPAN, RATING_DIRTY_LATE_DAMAGE_SPAN,
} from './constants';
import { hurtPlayer } from './hurt';
import { LEVELS } from './levels';
import { hitDamage, rageAfterHit, tierFor } from './rage';
import { attackDir } from './setup';
import { isDown, isHumanTeammate, setStatus } from './status';
import { isZero, nearestTo, norm } from './vec';

/** How long a computer team waits between hits (its level's value). */
const teamCooldown = (state: MatchState, team: TeamId): number => LEVELS[state.config.level[team]].teamHitCooldownTicks;

/** The cooldown after a hit: the computer side waits at least its level's team cooldown, whatever the hit did. */
function cooldownAfter(state: MatchState, p: PlayerState, ticks: number): number {
  return state.config.human[p.team] ? ticks : Math.max(ticks, teamCooldown(state, p.team));
}

/** The computer's hit cooldown is team-wide: a hit launched by one of its players holds the whole team back. */
function holdComputerTeam(state: MatchState, team: TeamId): void {
  for (const q of state.players) if (q.team === team) q.hitCooldown = Math.max(q.hitCooldown, teamCooldown(state, team));
}

/** Starts the lunge: the facing is fixed here (the intent's heading if any, else the team's attack direction). */
function launch(state: MatchState, p: PlayerState, hit: HitType, intent: PlayerIntent): void {
  if (!state.config.human[p.team]) holdComputerTeam(state, p.team);
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
export function updateAttack(state: MatchState, p: PlayerState, intent: PlayerIntent): void {
  if (p.status.kind === 'charging') {
    if (state.ball.owner === p.id || Boolean(p.status.teammate) !== isHumanTeammate(state, p)) setStatus(p, { kind: 'free' }, 0); // picked the ball up, or a human's control moved on: no hit
    else if (!intent.hitHeld || p.statusTick >= BIG_HIT_MAX_HOLD_TICKS) launch(state, p, releasedHit(state, p), intent);
    return;
  }
  // hitPress is an edge, so a button held through a hurt spell or a kickoff never starts a charge
  if (p.status.kind !== 'free' || p.hitCooldown > 0 || state.ball.owner === p.id) return;
  if (intent.hitPress) setStatus(p, isHumanTeammate(state, p) ? { kind: 'charging', teammate: true } : { kind: 'charging' }, 0);
}

/** The nearest opponent within reach who is not down and was not hurt earlier this tick. */
function findVictim(state: MatchState, tackler: PlayerState, reach: number, hitVictims: Set<number>): PlayerState | null {
  const candidates = state.players.filter(q => q.team !== tackler.team && !hitVictims.has(q.id) && !isDown(q) && !(q.status.kind === 'hurt' && q.statusTick === 0));
  return nearestTo(candidates, tackler.pos, reach); // ascending id: ties go to the lower id
}

function land(state: MatchState, tackler: PlayerState, victim: PlayerState, hit: HitType): void {
  const late = state.ball.owner !== victim.id;
  const ratings = state.config.ratings[tackler.team];
  const power = RATING_POWER_MIN + RATING_POWER_SPAN * ratings.power;
  // Dirty teams hit harder when the victim is away from the ball.
  const damage = hitDamage(hit, state.rage[tackler.team], tackler.turboTicks > 0, power) * (late ? 1 + (ratings.dirty - 0.5) * RATING_DIRTY_LATE_DAMAGE_SPAN : 1);
  const tier = tierFor(damage);
  const lethal = victim.health <= damage;
  const variant = hurtPlayer(state, victim, tier, tackler.facing, damage);
  const impact = { ...victim, pos: { ...victim.pos }, vel: { ...victim.vel }, facing: { ...victim.facing }, anchor: { ...victim.anchor }, knock: { ...victim.knock }, status: { ...victim.status } } as PlayerState;
  const substituted = state.players[victim.id] !== victim;
  const stats = state.stats[tackler.team];
  if (hit === 'big') stats.bigHits++;
  if (lethal) stats.kos++;
  if (!late) stats.steals++;
  rageAfterHit(state, tackler.team, tier);
  const eventIndex = state.events.length;
  state.events.push({ type: 'hit', tackler: tackler.id, victim: victim.id, hit, tier, variant, damage, late, ...(substituted ? { impact, substituted } : {}) });
  const halfIndex = state.half - 1;
  const previous = state.halfHits[halfIndex];
  if (!previous || damage > previous.damage) state.halfHits[halfIndex] = { tick: state.tick + 1, eventIndex, damage };
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
  const hitVictims = new Set<number>();
  for (const p of state.players) {
    if (p.status.kind !== 'lunging') continue; // checked live: a player hurt earlier this tick no longer lunges
    const hit = p.status.hit;
    const victim = findVictim(state, p, HITS[hit].reach, hitVictims);
    if (victim) { hitVictims.add(victim.id); land(state, p, victim, hit); }
    else if (p.statusTick >= HITS[hit].lungeTicks - 1) whiff(state, p, hit);
  }
}
