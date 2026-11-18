import Phaser from 'phaser';
import { PAL } from '../art/palette';
import { canvasRect } from '../art/canvasRect';
import { centeredLineTops, drawShadowedText, textHeight, textWidth, wrapText } from '../art/pixelFont';
import { calloutDrawKey, calloutStyle } from './calloutPicker';
import { CALLOUT_CENTER_Y, CALLOUT_MAX_W, DEPTH, SCREEN_H, SCREEN_W } from './layout';
import type { HurtTier } from '../sim';

const KEY = 'callout';

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

  /** The text on screen at `nowTick` ('' when none; a flashing line counts as shown through its off beats). */
  visibleText(nowTick: number): string {
    const s = this.shown;
    return s && nowTick - s.tick < calloutStyle(s.tier).ticks ? s.text : '';
  }

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
      const width = Math.max(...lines.map(line => textWidth(line, style.scale))) + 8;
      rect((SCREEN_W - width) / 2, tops[0] - 2, width, tops[tops.length - 1] - tops[0] + textHeight(style.scale) + 4, PAL.ink);
      lines.forEach((line, i) => {
        drawShadowedText(rect, line, SCREEN_W / 2, tops[i], style.color, style.scale, 'c');
      });
    }
    this.texture.refresh();
  }
}
