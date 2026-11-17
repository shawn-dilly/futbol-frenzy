import type { MatchState, PlayerIntent, PlayerState, Vec } from './types';
import {
  CHARGE_MOVE_FACTOR, DAZED_SPEED_FACTOR, FIELD_H, FIELD_W, GK_SPEED, HITS, KNOCK_DECAY, KNOCK_MIN_SPEED, PLAYER_RADIUS, RUN_SPEED, TICK_HZ,
  TURBO_BURST_TICKS, TURBO_COST, TURBO_REFILL_PER_TICK, TURBO_SPEED,
} from './constants';
import { isDazed } from './status';
import { add, clamp, clampLen, len, norm, scale } from './vec';

function startTurboIfPressed(state: MatchState, p: PlayerState, intent: PlayerIntent): void {
  if (p.role === 'gk' || !intent.turbo || p.turboTicks > 0 || state.turbo[p.team] < TURBO_COST) return;
  state.turbo[p.team] -= TURBO_COST;
  p.turboTicks = TURBO_BURST_TICKS;
}

/** Units per second a player runs at on his own: turbo, Dazed and charging all change it. */
function ownSpeed(p: PlayerState): number {
  const base = p.role === 'gk' ? GK_SPEED : p.turboTicks > 0 ? TURBO_SPEED : RUN_SPEED;
  return base * (isDazed(p) ? DAZED_SPEED_FACTOR : 1) * (p.status.kind === 'charging' ? CHARGE_MOVE_FACTOR : 1);
}

/** The nearest point to `v` where a player can stand. */
export function clampToPitch(v: Vec): Vec {
  return { x: clamp(v.x, PLAYER_RADIUS, FIELD_W - PLAYER_RADIUS), y: clamp(v.y, PLAYER_RADIUS, FIELD_H - PLAYER_RADIUS) };
}

function displace(p: PlayerState, perSecond: Vec): void {
  p.pos = clampToPitch({ x: p.pos.x + perSecond.x / TICK_HZ, y: p.pos.y + perSecond.y / TICK_HZ });
}

function decayKnock(p: PlayerState): void {
  p.knock = scale(p.knock, KNOCK_DECAY);
  if (len(p.knock) < KNOCK_MIN_SPEED) p.knock = { x: 0, y: 0 };
}

/** While play is stopped a flattened player still slides on his knockback. */
export function applyKnockOnly(p: PlayerState): void {
  displace(p, p.knock);
  decayKnock(p);
}

/** Turbo press, then move (at turbo speed while a burst runs), then tick the burst down. */
export function applyMovement(state: MatchState, p: PlayerState, intent: PlayerIntent): void {
  startTurboIfPressed(state, p, intent);

  const dir = clampLen({ x: intent.moveX, y: intent.moveY }, 1);
  p.vel = p.status.kind === 'lunging' ? scale(p.facing, HITS[p.status.hit].lungeSpeed) : scale(dir, ownSpeed(p));
  displace(p, add(p.vel, p.knock)); // knockback is on top of the player's own movement
  decayKnock(p);
  if (dir.x !== 0 || dir.y !== 0) p.facing = norm(dir); // a lunge's facing is fixed: its intent is neutral
  if (p.turboTicks > 0) p.turboTicks -= 1;
}

export function updateTurboMeters(state: MatchState): void {
  state.turbo[0] = Math.min(1, state.turbo[0] + TURBO_REFILL_PER_TICK);
  state.turbo[1] = Math.min(1, state.turbo[1] + TURBO_REFILL_PER_TICK);
}
