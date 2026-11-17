import { FIELD_H, FIELD_W, KNOCK_DECAY, KNOCK_MIN_SPEED, PLAYER_RADIUS, TICK_HZ, type PlayerState } from '../sim';

/** Reconstruct a presentation-only knocked-back actor without changing the event snapshot. */
export function outgoingAt(snapshot: PlayerState, elapsed: number): PlayerState {
  let { x, y } = snapshot.pos;
  let knock = { ...snapshot.knock };
  for (let i = 0; i < elapsed; i++) {
    x = Math.max(PLAYER_RADIUS, Math.min(FIELD_W - PLAYER_RADIUS, x + knock.x / TICK_HZ));
    y = Math.max(PLAYER_RADIUS, Math.min(FIELD_H - PLAYER_RADIUS, y + knock.y / TICK_HZ));
    knock = { x: knock.x * KNOCK_DECAY, y: knock.y * KNOCK_DECAY };
    if (Math.hypot(knock.x, knock.y) < KNOCK_MIN_SPEED) knock = { x: 0, y: 0 };
  }
  return { ...snapshot, pos: { x, y }, knock, statusTick: elapsed };
}
