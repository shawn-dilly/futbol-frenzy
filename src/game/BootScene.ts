import Phaser from 'phaser';
import { initialRoute } from './launch';
import { canvasRect } from '../art/canvasRect';
import { KITS, PAL } from '../art/palette';
import { FRAME_H, FRAME_W, atlasLayout, drawFrame, frameKey } from '../art/sprites';
import { ANIMATIONS } from '../content/animations';

export const ATLAS_KEY = 'atlas';
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

    const ball = this.textures.createCanvas(BALL_KEY, BALL_PX, BALL_PX);
    if (!ball) throw new Error('ball texture could not be created');
    const rect = canvasRect(ball.context);
    rect(0, 0, BALL_PX, BALL_PX, PAL.wht);
    rect(1, 1, 1, 1, PAL.ink);
    ball.refresh();

    this.scene.start(initialRoute(window.location.search));
  }
}
