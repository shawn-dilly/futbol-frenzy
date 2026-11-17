import Phaser from 'phaser';
import { canvasRect } from '../art/canvasRect';
import { PAL } from '../art/palette';
import { drawText } from '../art/pixelFont';
import { TURBO_COST, type MatchState } from '../sim';
import { SCREEN_H, SCREEN_W, formatClock } from './layout';

const HUD_KEY = 'hud';
const DEPTH_HUD = 2000;
const BAR_H = 11;
const BADGE = { y: 2, size: 7 }, TEXT_Y = 3;
const LEFT = { badgeX: 4, nameX: 14, scoreX: 46 };
const RIGHT = { badgeX: 309, nameRightX: 304, scoreX: 270 };
const PIP = { count: 3, w: 6, h: 4, gap: 2, y: 174 };
const PIP_UNLIT = PAL.dk;
const BANNER = { y: 56, scale: 3, shadowDx: 1, shadowDy: 1 };
const HALF_LABEL = { 1: '1ST', 2: '2ND' } as const;

/** Top bar, turbo pips and centre banner, drawn into one canvas redrawn only when what it shows changes. */
export class Hud {
  private readonly texture: Phaser.Textures.CanvasTexture;
  private lastKey = '';
  private lastTick = 0;
  private banner: { text: string; untilTick: number } | null = null;

  constructor(scene: Phaser.Scene) {
    const tex = scene.textures.createCanvas(HUD_KEY, SCREEN_W, SCREEN_H);
    if (!tex) throw new Error('hud texture could not be created');
    this.texture = tex;
    scene.add.image(0, 0, HUD_KEY).setOrigin(0, 0).setDepth(DEPTH_HUD);
    scene.events.once('shutdown', () => scene.textures.remove(HUD_KEY));
  }

  /** Shows `text` for `ticks` sim ticks from the last synced tick. */
  showBanner(text: string, ticks: number): void {
    this.banner = { text, untilTick: this.lastTick + ticks };
  }

  sync(state: MatchState): void {
    this.lastTick = state.tick;
    if (this.banner && state.tick >= this.banner.untilTick) this.banner = null;
    const lit = Math.floor(state.turbo[0] / TURBO_COST + 1e-9);
    const clock = `${HALF_LABEL[state.half]} ${formatClock(state.clockTicks)}`;
    const bannerText = this.banner?.text ?? '';
    const key = [state.score[0], state.score[1], clock, lit, bannerText].join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.draw(state.score, clock, lit, bannerText);
  }

  private draw(score: [number, number], clock: string, lit: number, bannerText: string): void {
    const ctx = this.texture.context;
    ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
    const rect = canvasRect(ctx);
    rect(0, 0, SCREEN_W, BAR_H, PAL.ink);
    rect(LEFT.badgeX, BADGE.y, BADGE.size, BADGE.size, PAL.red);
    drawText(rect, 'RHINOS', LEFT.nameX, TEXT_Y, PAL.wht);
    drawText(rect, String(score[0]), LEFT.scoreX, TEXT_Y, PAL.yel);
    drawText(rect, clock, SCREEN_W / 2, TEXT_Y, PAL.wht, 1, 'c');
    drawText(rect, String(score[1]), RIGHT.scoreX, TEXT_Y, PAL.yel);
    drawText(rect, 'VIPERS', RIGHT.nameRightX, TEXT_Y, PAL.wht, 1, 'r');
    rect(RIGHT.badgeX, BADGE.y, BADGE.size, BADGE.size, PAL.blue);
    const pipsW = PIP.count * PIP.w + (PIP.count - 1) * PIP.gap;
    for (let i = 0; i < PIP.count; i++) {
      rect((SCREEN_W - pipsW) / 2 + i * (PIP.w + PIP.gap), PIP.y, PIP.w, PIP.h, i < lit ? PAL.org : PIP_UNLIT);
    }
    if (bannerText) {
      drawText(rect, bannerText, SCREEN_W / 2 + BANNER.shadowDx, BANNER.y + BANNER.shadowDy, PAL.ink, BANNER.scale, 'c');
      drawText(rect, bannerText, SCREEN_W / 2, BANNER.y, PAL.yel, BANNER.scale, 'c');
    }
    this.texture.refresh();
  }
}
