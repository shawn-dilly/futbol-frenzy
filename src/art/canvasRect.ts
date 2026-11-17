import type { RectFn } from './pixelFont';

/** A RectFn that fills solid, unsmoothed rectangles on a 2D canvas context, offset by (ox, oy). */
export function canvasRect(ctx: CanvasRenderingContext2D, ox = 0, oy = 0): RectFn {
  return (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x) + ox, Math.round(y) + oy, w, h);
  };
}
