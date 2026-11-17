import Phaser from 'phaser';
import { canvasRect } from '../art/canvasRect';
import { PAL } from '../art/palette';
import { centeredLineTops, drawText, wrapText } from '../art/pixelFont';
import { calloutDrawKey, calloutStyle } from './calloutPicker';
import { CALLOUT_CENTER_Y, CALLOUT_MAX_W, DEPTH, SCREEN_H, SCREEN_W } from './layout';
import type { HurtTier } from '../sim';

const KEY = 'callout';
const SHADOW_OFFSET_PX = 1;

interface Shown { text: string; tier: HurtTier; tick: number }

/** One callout (wrapped if long) centred above the pitch, on its own canvas below the HUD; a new callout replaces the current one. */
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
    this.shown = { text, tier, tick: nowTick };
  }

  /** Removes the callout at once (goal and whistle banners take the space). */
  clear(): void { this.shown = null; }

  sync(nowTick: number): void {
    const key = calloutDrawKey(this.shown, nowTick);
    if (key === this.drawnKey) return;
    this.drawnKey = key;
    this.draw(key !== '' ? this.shown : null);
  }

  private draw(shown: Shown | null): void {
    const ctx = this.texture.context;
    ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
    if (shown) {
      const style = calloutStyle(shown.tier);
      const lines = wrapText(shown.text, CALLOUT_MAX_W, style.scale);
      const rect = canvasRect(ctx);
      const tops = centeredLineTops(lines.length, style.scale, CALLOUT_CENTER_Y);
      lines.forEach((line, i) => {
        drawText(rect, line, SCREEN_W / 2 + SHADOW_OFFSET_PX, tops[i] + SHADOW_OFFSET_PX, PAL.ink, style.scale, 'c');
        drawText(rect, line, SCREEN_W / 2, tops[i], style.color, style.scale, 'c');
      });
    }
    this.texture.refresh();
  }
}
