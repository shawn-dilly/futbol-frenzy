import type { HurtTier, MatchState, PlayerState, Vec } from './types';
import { HURT, LOOSE_BALL_SPEED } from './constants';
import { nextRandom } from './rng';
import { isDown, isHumanControlled, setStatus } from './status';
import { switchControl } from './possession';
import { norm, scale } from './vec';

export { isDazed } from './status';

/**
 * Applies a landed hit to the victim: status, knockback, facing along it, health (never below 1), a dropped ball, and control
 * hand-over if a human's controlled player is now down. Returns the chosen animation variant.
 */
export function hurtPlayer(state: MatchState, victim: PlayerState, tier: HurtTier, dir: Vec, damage: number): number {
  const spec = HURT[tier];
  const variant = Math.floor(nextRandom(state) * spec.variants);
  setStatus(victim, { kind: 'hurt', tier, variant }, spec.downTicks);
  const thrown = norm(dir);
  if (thrown.x !== 0 || thrown.y !== 0) victim.facing = thrown; // lands facing the way they are thrown
  victim.knock = scale(thrown, spec.knockSpeed);
  victim.health = Math.max(1, victim.health - damage);
  if (state.ball.owner === victim.id) {
    state.ball.owner = null; state.ball.ownerTicks = 0; state.ball.passTarget = null;
    state.ball.vel = scale(norm(dir), LOOSE_BALL_SPEED);
    victim.kickCooldown = Math.max(victim.kickCooldown, spec.downTicks);
  }
  if (isDown(victim) && isHumanControlled(state, victim)) {
    switchControl(state, victim.team);
  }
  return variant;
}
