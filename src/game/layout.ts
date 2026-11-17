import { HIT_FEEDBACK } from './hitFeedback';
import { RAGE_MAX, TICK_HZ, TURBO_COST, type Phase, type Vec } from '../sim';

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

/** Height in pixels of the top bar, which also hides the gap a screen shake opens above the pitch. */
export const HUD_BAR_H = 11;

/** Extra pitch drawn past each screen edge (left, right, bottom): the biggest shake, so shaking never shows the background. */
export const PITCH_MARGIN_PX = Math.max(...Object.values(HIT_FEEDBACK).map(f => f.shakePx));
/** Size of the pre-drawn scrolling pitch texture: the whole camera travel plus one screen, plus the shake margin. */
export const PITCH_TEX_W = CAMERA_MAX_X - CAMERA_MIN_X + SCREEN_W + 2 * PITCH_MARGIN_PX;
export const PITCH_TEX_H = SCREEN_H + PITCH_MARGIN_PX;
/** Texture x of world x 0. */
export const PITCH_TEX_ORIGIN_X = -CAMERA_MIN_X + PITCH_MARGIN_PX;

/** Screen position of the pitch image's top-left for a camera x and this frame's shake offset. */
export function pitchImagePos(camX: number, shake: { x: number; y: number }): { x: number; y: number } {
  return { x: -PITCH_TEX_ORIGIN_X - camX + shake.x, y: shake.y };
}

/** Ticks the GOAL! banner stays up. */
export const GOAL_BANNER_TICKS = 90;

/** Draw order, back to front: pitch, crater decals, shadows, ball (plus its y), marker, touch controls, then callouts, then the HUD layer with banners, then the hit flash over everything. */
export const DEPTH = { pitch: -100, crater: -90, shadow: -50, ball: 0.1, marker: 1000, controls: 1500, callout: 1800, hud: 2000, flash: 2100 } as const;

/** Callout banner: centre y on screen and the widest a line may be (320 minus a 4 px margin each side). */
export const CALLOUT_CENTER_Y = 62;
export const CALLOUT_MAX_W = 312;

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

/** Pixels a sprite is lifted `tick` ticks into its air time: 0 at the start, `arcHeight` at half the air time, 0 from the end on. */
export function arcLift(arcHeight: number | undefined, tick: number, airTicks: number): number {
  if (!arcHeight || airTicks <= 0 || tick >= airTicks) return 0;
  return arcHeight * Math.sin(Math.PI * tick / airTicks);
}

/** Rage at or above this level makes the HUD meter flash: a big hit is nearly always affordable. */
export const RAGE_FLASH_AT = 80;
export const RAGE_FLASH_TICKS = 8;

/** Filled width in whole pixels of a rage meter `maxPx` wide. */
export function rageBarWidth(rage: number, maxPx: number): number {
  return Math.round(Math.min(1, Math.max(0, rage / RAGE_MAX)) * maxPx);
}

export function isRageFlashing(rage: number): boolean { return rage >= RAGE_FLASH_AT; }

/** True in the first, third, ... `periodTicks` of the tick count: a blink that starts lit. */
export function blinkOn(tick: number, periodTicks: number): boolean {
  return Math.floor(tick / periodTicks) % 2 === 0;
}
