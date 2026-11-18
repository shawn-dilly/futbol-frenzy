import Phaser from 'phaser';
import { initialRoute } from './launch';
import { canvasRect } from '../art/canvasRect';
import { KITS, PAL } from '../art/palette';
import { FRAME_H, FRAME_W, ORIGIN_X, ORIGIN_Y, atlasLayout, drawFrame, frameKey } from '../art/sprites';
import { ANIMATIONS } from '../content/animations';

export const ATLAS_KEY = 'atlas';
export const INJURY_KEY = 'injury';
export const BALL_KEY = 'ball';
/** Ball sprite size in pixels. */
export const BALL_PX = 3;

/** Draws the sprite atlas and the ball into canvas textures, then starts the match. */
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create(): void {
    const slots = new Map(atlasLayout().map(s => [s.key, s]));
    const width = Math.max(...[...slots.values()].map(s => s.x)) + FRAME_W;
    const height = Math.max(...[...slots.values()].map(s => s.y)) + FRAME_H;
    const atlas = this.textures.createCanvas(ATLAS_KEY, width, height);
    if (!atlas) throw new Error('atlas texture could not be created');
    KITS.forEach((kit, k) => {
      for (const [key, def] of Object.entries(ANIMATIONS)) {
        for (let f = 0; f < def.frames.length; f++) {
          const slot = slots.get(frameKey(k, key, f));
          if (!slot) throw new Error(`no atlas slot for ${frameKey(k, key, f)}`);
          drawFrame(canvasRect(atlas.context, slot.x, slot.y), kit, key, f);
          atlas.add(slot.key, 0, slot.x, slot.y, FRAME_W, FRAME_H);
        }
      }
    });
    atlas.refresh();
    // Both overlays use the same frame origin and flip as the underlying sprite.
    const upright = ['idle', 'run', 'kick', 'charge'].flatMap(key =>
      ANIMATIONS[key].frames.map((pixels, frame) => ({ key, frame, pixels })));
    const injury = this.textures.createCanvas(INJURY_KEY, upright.length * FRAME_W, 2 * FRAME_H);
    if (!injury) throw new Error('injury texture could not be created');
    upright.forEach(({ key, frame, pixels }, i) => {
      const x = i * FRAME_W;
      const rect = canvasRect(injury.context, x + ORIGIN_X, ORIGIN_Y);
      for (const [dx, dy, w, h] of pixels) rect(dx, dy, w, h, '#ff333e');
      injury.add(`pulse_${key}_${frame}`, 0, x, 0, FRAME_W, FRAME_H);
      const [hx, hy, width] = pixels.find(pixel => pixel[4] === 'hair')!;
      const wrap = canvasRect(injury.context, x + ORIGIN_X + hx, FRAME_H + ORIGIN_Y + hy);
      wrap(-1, -1, width + 2, 4, '#583443');
      wrap(-1, 0, width + 2, 2, '#ffe5bd');
      wrap(1, 0, 1, 2, '#bb7560');
      injury.add(`bandage_${key}_${frame}`, 0, x, FRAME_H, FRAME_W, FRAME_H);
    });
    injury.refresh();

    const ball = this.textures.createCanvas(BALL_KEY, BALL_PX, BALL_PX);
    if (!ball) throw new Error('ball texture could not be created');
    const rect = canvasRect(ball.context);
    rect(0, 0, BALL_PX, BALL_PX, PAL.wht);
    rect(1, 1, 1, 1, PAL.ink);
    ball.refresh();

    this.scene.start(initialRoute(window.location.search));
  }
}
