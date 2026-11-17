import { TICK_HZ, TURBO_COST, type Phase, type Vec } from '../sim';

export const SCREEN_W = 320;
export const SCREEN_H = 180;
/** Screen y of the top touchline. */
export const FIELD_TOP = 50;
export const CAMERA_MIN_X = -16;
export const CAMERA_MAX_X = 176;
const CAMERA_HALF_SCREEN = SCREEN_W / 2;

export function cameraTarget(ballX: number): number {
  return Math.min(CAMERA_MAX_X, Math.max(CAMERA_MIN_X, ballX - CAMERA_HALF_SCREEN));
}

export function worldToScreen(pos: Vec, camX: number): { x: number; y: number } {
  return { x: pos.x - camX, y: pos.y + FIELD_TOP };
}

/** 'M:SS', rounded up to the next whole second, never negative. */
export function formatClock(clockTicks: number): string {
  const seconds = Math.ceil(Math.max(0, clockTicks) / TICK_HZ);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Width of the pre-drawn scrolling pitch texture: the whole camera travel plus one screen. */
export const PITCH_TEX_W = CAMERA_MAX_X - CAMERA_MIN_X + SCREEN_W;
/** Texture x of world x 0. */
export const PITCH_TEX_ORIGIN_X = -CAMERA_MIN_X;

/** Ticks the GOAL! banner stays up. */
export const GOAL_BANNER_TICKS = 90;

/** Draw order, back to front: pitch, shadows, ball (plus its y), marker, touch controls, then the HUD layer with banners. */
export const DEPTH = { pitch: -100, shadow: -50, ball: 0.1, marker: 1000, controls: 1500, hud: 2000 } as const;

export const TURBO_PIPS = 3;

/** How many turbo pips (0..TURBO_PIPS) a meter value lights; a pip is lit once the meter covers it. */
export function turboPips(meter: number): number {
  const lit = Math.floor(meter / TURBO_COST + 1e-9);
  return Math.min(TURBO_PIPS, Math.max(0, lit));
}

/** Whether a sprite is mirrored: follows horizontal facing, keeps its last side on purely vertical moves. */
export function nextFlip(prevFlip: boolean, facingX: number): boolean {
  if (facingX < 0) return true;
  return facingX > 0 ? false : prevFlip;
}

export const TEAM_NAMES = ['RHINOS', 'VIPERS'] as const;

/** Ticks after the full-time whistle during which a press does not restart the match. */
export const FULLTIME_RESTART_DELAY_TICKS = 120;

/** Whether a press restarts the match: only at full time, once the delay since the whistle has passed. */
export function canRestart(phase: Phase, tick: number, fulltimeTick: number | null): boolean {
  return phase === 'fulltime' && fulltimeTick !== null && tick - fulltimeTick >= FULLTIME_RESTART_DELAY_TICKS;
}

/** Banner lines at full time: title, result, and the restart hint once a press would restart. */
export function fullTimeLines(score: readonly [number, number], restartAllowed: boolean): string[] {
  const lines = ['FULL TIME', `${TEAM_NAMES[0]} ${score[0]} - ${score[1]} ${TEAM_NAMES[1]}`];
  if (restartAllowed) lines.push('TAP TO PLAY AGAIN');
  return lines;
}

/** Pixels a sprite is lifted `statusTick` ticks into a status of `statusTicks`: 0 at both ends, `arcHeight` at the midpoint. */
export function arcLift(arcHeight: number | undefined, statusTick: number, statusTicks: number): number {
  if (!arcHeight || statusTicks <= 0) return 0;
  return arcHeight * Math.sin(Math.PI * Math.min(statusTick, statusTicks) / statusTicks);
}
