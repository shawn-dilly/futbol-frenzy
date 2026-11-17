import Phaser from 'phaser';
import { canvasRect } from '../art/canvasRect';
import { PAL } from '../art/palette';
import { drawText } from '../art/pixelFont';
import type { MatchState } from '../sim';
import {
  DEPTH, RAGE_FLASH_TICKS, SCREEN_H, SCREEN_W, TEAM_NAMES, TURBO_PIPS, blinkOn, canRestart, formatClock, fullTimeLines, isRageFlashing, rageBarWidth, turboPips,
} from './layout';

const HUD_KEY = 'hud';
const BAR_H = 11;
const BADGE = { y: 2, size: 7 }, TEXT_Y = 3;
const LEFT = { badgeX: 4, nameX: 14, scoreX: 46 };
const RIGHT = { badgeX: 309, nameRightX: 304, scoreX: 270 };
const PIP = { count: TURBO_PIPS, w: 6, h: 4, gap: 2, y: 174 };
/** Rage meters hang under the top bar, each starting at its team's badge edge: a 1 px ink frame round a pur fill that flashes white when nearly full. */
const RAGE = { y: BAR_H + 1, maxPx: 60, h: 3, frame: 1, leftX: LEFT.badgeX, rightEdgeX: RIGHT.badgeX + BADGE.size };
const RAGE_FILL = PAL.pur, RAGE_FLASH = PAL.wht;
const PIP_UNLIT = PAL.dk;
const BANNER = { y: 56, shadowDx: 1, shadowDy: 1 };
/** Text scale and the y step to the next line, per banner line (the first is the title). */
const BANNER_LINES = [{ scale: 3, advance: 28 }, { scale: 2, advance: 20 }, { scale: 2, advance: 0 }];
const HALF_LABEL = { 1: '1ST', 2: '2ND' } as const;

/** Top bar, rage meters, turbo pips and centre banner, drawn into one canvas redrawn only when what it shows changes. */
export class Hud {
  private readonly texture: Phaser.Textures.CanvasTexture;
  private lastKey = '';
  private banner: { text: string; untilTick: number } | null = null;
  private fulltimeTick: number | null = null;

  constructor(scene: Phaser.Scene) {
    const tex = scene.textures.createCanvas(HUD_KEY, SCREEN_W, SCREEN_H);
    if (!tex) throw new Error('hud texture could not be created');
    this.texture = tex;
    scene.add.image(0, 0, HUD_KEY).setOrigin(0, 0).setDepth(DEPTH.hud);
    scene.events.once('shutdown', () => scene.textures.remove(HUD_KEY));
  }

  /** Shows `text` for `ticks` sim ticks counted from `nowTick`, the tick of the event that asked for it. */
  showBanner(text: string, ticks: number, nowTick: number): void {
    this.banner = { text, untilTick: nowTick + ticks };
  }

  /** Switches the banner to the full-time result; `tick` is the tick of the whistle. */
  showFullTime(tick: number): void { this.fulltimeTick = tick; }

  sync(state: MatchState): void {
    if (this.banner && state.tick >= this.banner.untilTick) this.banner = null;
    const lit = turboPips(state.turbo[0]);
    const clock = `${HALF_LABEL[state.half]} ${formatClock(state.clockTicks)}`;
    const lines = this.fulltimeTick !== null
      ? fullTimeLines(state.score, canRestart(state.phase, state.tick, this.fulltimeTick))
      : this.banner ? [this.banner.text] : [];
    const rage = state.rage.map(r => ({ px: rageBarWidth(r, RAGE.maxPx), flashOn: isRageFlashing(r) && blinkOn(state.tick, RAGE_FLASH_TICKS) }));
    const key = [state.score[0], state.score[1], clock, lit, lines.join('/'), rage.map(r => `${r.px}${r.flashOn ? 'f' : ''}`).join(',')].join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.draw(state.score, clock, lit, lines, rage);
  }

  private draw(score: [number, number], clock: string, lit: number, bannerLines: string[], rage: { px: number; flashOn: boolean }[]): void {
    const ctx = this.texture.context;
    ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
    const rect = canvasRect(ctx);
    rect(0, 0, SCREEN_W, BAR_H, PAL.ink);
    rect(LEFT.badgeX, BADGE.y, BADGE.size, BADGE.size, PAL.red);
    drawText(rect, TEAM_NAMES[0], LEFT.nameX, TEXT_Y, PAL.wht);
    drawText(rect, String(score[0]), LEFT.scoreX, TEXT_Y, PAL.yel);
    drawText(rect, clock, SCREEN_W / 2, TEXT_Y, PAL.wht, 1, 'c');
    drawText(rect, String(score[1]), RIGHT.scoreX, TEXT_Y, PAL.yel);
    drawText(rect, TEAM_NAMES[1], RIGHT.nameRightX, TEXT_Y, PAL.wht, 1, 'r');
    rect(RIGHT.badgeX, BADGE.y, BADGE.size, BADGE.size, PAL.blue);
    rage.forEach((r, team) => {
      const frameW = RAGE.maxPx + 2 * RAGE.frame;
      const x = team === 0 ? RAGE.leftX : RAGE.rightEdgeX - frameW; // the right meter mirrors the left: it fills from the screen edge
      rect(x, RAGE.y, frameW, RAGE.h + 2 * RAGE.frame, PAL.ink);
      rect(team === 0 ? x + RAGE.frame : x + RAGE.frame + RAGE.maxPx - r.px, RAGE.y + RAGE.frame, r.px, RAGE.h, r.flashOn ? RAGE_FLASH : RAGE_FILL);
    });
    const pipsW = PIP.count * PIP.w + (PIP.count - 1) * PIP.gap;
    for (let i = 0; i < PIP.count; i++) {
      rect((SCREEN_W - pipsW) / 2 + i * (PIP.w + PIP.gap), PIP.y, PIP.w, PIP.h, i < lit ? PAL.org : PIP_UNLIT);
    }
    let y = BANNER.y;
    bannerLines.forEach((text, i) => {
      const { scale, advance } = BANNER_LINES[i];
      drawText(rect, text, SCREEN_W / 2 + BANNER.shadowDx, y + BANNER.shadowDy, PAL.ink, scale, 'c');
      drawText(rect, text, SCREEN_W / 2, y, PAL.yel, scale, 'c');
      y += advance;
    });
    this.texture.refresh();
  }
}
