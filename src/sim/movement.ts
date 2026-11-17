import type { MatchState, PlayerIntent, PlayerState } from './types';
import {
  FIELD_H, FIELD_W, GK_SPEED, PLAYER_RADIUS, RUN_SPEED, TICK_HZ,
  TURBO_BURST_TICKS, TURBO_COST, TURBO_REFILL_PER_TICK, TURBO_SPEED,
} from './constants';
import { clamp, clampLen, norm, scale } from './vec';

function startTurboIfPressed(state: MatchState, p: PlayerState, intent: PlayerIntent): void {
  if (p.role === 'gk' || !intent.turbo || p.turboTicks > 0 || state.turbo[p.team] < TURBO_COST) return;
  state.turbo[p.team] -= TURBO_COST;
  p.turboTicks = TURBO_BURST_TICKS;
}

/** Turbo press, then move (at turbo speed while a burst runs), then tick the burst down. */
export function applyMovement(state: MatchState, p: PlayerState, intent: PlayerIntent): void {
  startTurboIfPressed(state, p, intent);

  const dir = clampLen({ x: intent.moveX, y: intent.moveY }, 1);
  const speed = p.role === 'gk' ? GK_SPEED : p.turboTicks > 0 ? TURBO_SPEED : RUN_SPEED;
  p.vel = scale(dir, speed);
  p.pos = {
    x: clamp(p.pos.x + p.vel.x / TICK_HZ, PLAYER_RADIUS, FIELD_W - PLAYER_RADIUS),
    y: clamp(p.pos.y + p.vel.y / TICK_HZ, PLAYER_RADIUS, FIELD_H - PLAYER_RADIUS),
  };
  if (dir.x !== 0 || dir.y !== 0) p.facing = norm(dir);
  if (p.turboTicks > 0) p.turboTicks -= 1;
}

export function updateTurboMeters(state: MatchState): void {
  state.turbo[0] = Math.min(1, state.turbo[0] + TURBO_REFILL_PER_TICK);
  state.turbo[1] = Math.min(1, state.turbo[1] + TURBO_REFILL_PER_TICK);
}
