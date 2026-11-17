import Phaser from 'phaser';
import { canvasRect } from '../art/canvasRect';
import { PAL } from '../art/palette';
import { drawText } from '../art/pixelFont';
import type { PadInput } from '../sim';
import { DEPTH, SCREEN_H, SCREEN_W } from '../game/layout';
import { BUTTONS, PadTracker, STICK_RADIUS, type ButtonName } from './stick';

const KEY = 'touch-controls';
const SIMULTANEOUS_POINTERS = 3;
const STICK_REST = { x: 40, y: 140 };
const KNOB = { r: 10, restDx: 7, restDy: -5 };
const ALPHA = { base: 0.28, ring: 0.55, knob: 0.55, button: 0.6, pressed: 1 };
const RING_PX = 1.5, BUTTON_RING_PX = 1.5;
const LABEL_DY = -2, LABEL_DX = 1;
/** The turbo disc is 20px wide, too small for the word TURBO, so it shows a double chevron. */
const FACE: Record<ButtonName, { label: string; color: string }> = {
  pass: { label: 'PASS', color: PAL.blue },
  shoot: { label: 'SHOOT', color: PAL.yel },
  hit: { label: 'HIT', color: PAL.red },
  turbo: { label: '>>', color: PAL.org },
};
const BUTTON_ORDER = Object.keys(FACE) as ButtonName[];

/** Floating stick and action buttons: reads pointers into a PadTracker and draws itself on the HUD layer. */
export class TouchControls {
  private readonly tracker = new PadTracker();
  private readonly texture: Phaser.Textures.CanvasTexture;
  private lastKey = '';

  constructor(scene: Phaser.Scene) {
    // Pointers live on the game-wide input manager and survive scene restarts, so top up rather than add.
    const missing = SIMULTANEOUS_POINTERS - scene.input.manager.pointersTotal;
    if (missing > 0) scene.input.addPointer(missing);
    const tex = scene.textures.createCanvas(KEY, SCREEN_W, SCREEN_H);
    if (!tex) throw new Error('touch controls texture could not be created');
    this.texture = tex;
    scene.add.image(0, 0, KEY).setOrigin(0, 0).setDepth(DEPTH.controls);

    const { input } = scene;
    // Pointer.x and .y are accessors on the prototype, so a Pointer must not be spread or copied; pass plain points.
    input.on('pointerdown', (p: Phaser.Input.Pointer) => this.tracker.down(p.id, { x: p.x, y: p.y }));
    input.on('pointermove', (p: Phaser.Input.Pointer) => this.tracker.move(p.id, { x: p.x, y: p.y }));
    const release = (p: Phaser.Input.Pointer) => this.tracker.up(p.id);
    input.on('pointerup', release);
    input.on('pointerupoutside', release);

    const cancel = () => this.tracker.cancelAll();
    const onVisibility = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', onVisibility);
    scene.events.once('shutdown', () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', onVisibility);
      scene.textures.remove(KEY);
    });
  }

  read(): PadInput {
    const pad = this.tracker.read();
    this.redraw(pad);
    return pad;
  }

  private redraw(pad: PadInput): void {
    const stick = this.tracker.stick();
    const key = [stick ? `${stick.origin.x},${stick.origin.y},${stick.pointer.x},${stick.pointer.y}` : '-',
      BUTTON_ORDER.map((b) => (pad[b] ? 1 : 0)).join('')].join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;
    const ctx = this.texture.context;
    ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
    const disc = (cx: number, cy: number, r: number, color: string, alpha: number, ring = 0) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d = dx * dx + dy * dy;
          if (d <= r * r && (!ring || d > (r - ring) * (r - ring))) ctx.fillRect(Math.round(cx) + dx, Math.round(cy) + dy, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    };
    const base = stick ? stick.origin : STICK_REST;
    let knob = { x: base.x + KNOB.restDx, y: base.y + KNOB.restDy };
    if (stick) {
      const dx = stick.pointer.x - base.x, dy = stick.pointer.y - base.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(d, STICK_RADIUS) / d;
      knob = { x: base.x + dx * reach, y: base.y + dy * reach };
    }
    disc(base.x, base.y, STICK_RADIUS, PAL.wht, ALPHA.base);
    disc(base.x, base.y, STICK_RADIUS, PAL.wht, ALPHA.ring, RING_PX);
    disc(knob.x, knob.y, KNOB.r, PAL.wht, stick ? ALPHA.pressed : ALPHA.knob);

    const rect = canvasRect(ctx);
    for (const name of BUTTON_ORDER) {
      const b = BUTTONS[name];
      disc(b.x, b.y, b.r, FACE[name].color, pad[name] ? ALPHA.pressed : ALPHA.button);
      disc(b.x, b.y, b.r, PAL.ink, 1, BUTTON_RING_PX);
      drawText(rect, FACE[name].label, b.x + LABEL_DX, b.y + LABEL_DY, PAL.ink, 1, 'c');
    }
    this.texture.refresh();
  }
}
