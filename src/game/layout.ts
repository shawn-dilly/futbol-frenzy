import { TICK_HZ, type Vec } from '../sim';

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
