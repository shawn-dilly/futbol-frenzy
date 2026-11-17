import Phaser from 'phaser';
import { canvasRect } from '../art/canvasRect';
import { PAL } from '../art/palette';
import { drawText, wrapText } from '../art/pixelFont';
import { calloutStyle, calloutVisible, type CalloutStyle } from './calloutPicker';
import { CALLOUT_CENTER_Y, CALLOUT_MAX_W, DEPTH, SCREEN_H, SCREEN_W } from './layout';
import type { HurtTier } from '../sim';

const KEY = 'callout';
const SHADOW_OFFSET_PX = 1;
const GLYPH_H_PX = 5;
/** Gap between wrapped lines, in font pixels (multiplied by the scale). */
const LINE_GAP = 2;

interface Shown { lines: string[]; style: CalloutStyle; tick: number }

/** One callout line (wrapped if long) centred above the pitch, on its own canvas below the HUD; a new callout replaces the current one. */
export class CalloutBanner {
  private readonly texture: Phaser.Textures.CanvasTexture;
  private shown: Shown | null = null;
  private drawnKey = '';

  constructor(scene: Phaser.Scene) {
    const tex = scene.textures.createCanvas(KEY, SCREEN_W, SCREEN_H);
    if (!tex) throw new Error('callout texture could not be created');
    this.texture = tex;
    scene.add.image(0, 0, KEY).setOrigin(0, 0).setDepth(DEPTH.callout);
    scene.events.once('shutdown', () => scene.textures.remove(KEY));
  }

  show(text: string, tier: HurtTier, nowTick: number): void {
    const style = calloutStyle(tier);
    this.shown = { lines: wrapText(text, CALLOUT_MAX_W, style.scale), style, tick: nowTick };
  }

  sync(nowTick: number): void {
    const on = this.shown !== null && calloutVisible(this.shown.tick, nowTick, this.shown.style);
    const key = on && this.shown ? this.shown.lines.join('/') : '';
    if (key === this.drawnKey) return;
    this.drawnKey = key;
    this.draw(on);
  }

  private draw(on: boolean): void {
    const ctx = this.texture.context;
    ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
    if (on && this.shown) {
      const { lines, style } = this.shown;
      const rect = canvasRect(ctx);
      const lineH = (GLYPH_H_PX + LINE_GAP) * style.scale;
      const blockH = lines.length * lineH - LINE_GAP * style.scale;
      lines.forEach((line, i) => {
        const y = CALLOUT_CENTER_Y - blockH / 2 + i * lineH;
        drawText(rect, line, SCREEN_W / 2 + SHADOW_OFFSET_PX, y + SHADOW_OFFSET_PX, PAL.ink, style.scale, 'c');
        drawText(rect, line, SCREEN_W / 2, y, style.color, style.scale, 'c');
      });
    }
    this.texture.refresh();
  }
}
