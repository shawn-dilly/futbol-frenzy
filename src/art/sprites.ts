import { ANIMATIONS, type ColorRole } from '../content/animations';
import { KITS, PAL, type Kit } from './palette';
import type { RectFn } from './pixelFont';

export const FRAME_W = 24;
export const FRAME_H = 20;
/** Feet centre inside a frame; animation rects are offsets from it, facing right. */
export const ORIGIN_X = 12;
export const ORIGIN_Y = 18;
/** The atlas texture is at most this many pixels wide. */
const ATLAS_MAX_W = 1024;
const ATLAS_COLUMNS = Math.floor(ATLAS_MAX_W / FRAME_W);

const colorOf = (kit: Kit, role: ColorRole): string => {
  switch (role) {
    case 'skin': return kit.skin;
    case 'hair': return kit.hair;
    case 'jersey': return kit.jersey;
    case 'trim': return kit.trim;
    case 'shorts': return kit.shorts;
    case 'boot': case 'eye': return PAL.ink;
    case 'star': return PAL.yel;
  }
};

export function drawFrame(rect: RectFn, kit: Kit, key: string, frame: number): void {
  for (const [dx, dy, w, h, role] of ANIMATIONS[key].frames[frame]) rect(ORIGIN_X + dx, ORIGIN_Y + dy, w, h, colorOf(kit, role));
}

/** Which frame of an animation shows `tick` ticks in: loops wrap, the rest hold their last frame. */
export function frameIndex(key: string, tick: number): number {
  const { frames, ticksPerFrame, loop } = ANIMATIONS[key];
  const n = Math.floor(tick / ticksPerFrame);
  return loop ? n % frames.length : Math.min(n, frames.length - 1);
}

export function frameKey(kitIndex: number, key: string, frame: number): string {
  return `k${kitIndex}_${key}_${frame}`;
}

/** Cell positions for every frame of every kit, wrapped into rows so the atlas stays within ATLAS_MAX_W. */
export function atlasLayout(): { key: string; x: number; y: number }[] {
  const perKit = Object.entries(ANIMATIONS).flatMap(([key, def]) => def.frames.map((_, f) => ({ key, f })));
  const rowsPerKit = Math.ceil(perKit.length / ATLAS_COLUMNS);
  return KITS.flatMap((_, k) => perKit.map(({ key, f }, i) => ({
    key: frameKey(k, key, f),
    x: (i % ATLAS_COLUMNS) * FRAME_W,
    y: (k * rowsPerKit + Math.floor(i / ATLAS_COLUMNS)) * FRAME_H,
  })));
}
