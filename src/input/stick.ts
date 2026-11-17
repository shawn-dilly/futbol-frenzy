import { neutralPad, type PadInput, type Vec } from '../sim';

/** All coordinates here are in the game's 320x180 logical space. */
export const STICK_RADIUS = 26, STICK_DEADZONE = 0.18;
/** A pointer going down left of this x (45% of the screen) may become the stick. */
export const STICK_ZONE_MAX_X = 144;
/** Extra pixels around a button that still count as a hit. */
const BUTTON_HIT_MARGIN = 4;

/** Stick deflection in [-1, 1]: zero inside the deadzone, then rescaled so the rim of the deadzone is 0 and the stick radius is 1. */
export function stickVector(origin: Vec, pointer: Vec): { x: number; y: number } {
  const dx = pointer.x - origin.x, dy = pointer.y - origin.y;
  const d = Math.hypot(dx, dy);
  const n = d / STICK_RADIUS;
  if (n < STICK_DEADZONE) return { x: 0, y: 0 };
  const magnitude = Math.min(1, (n - STICK_DEADZONE) / (1 - STICK_DEADZONE));
  return { x: (dx / d) * magnitude, y: (dy / d) * magnitude };
}

export type ButtonName = 'pass' | 'shoot' | 'hit' | 'turbo';
export const BUTTONS: Record<ButtonName, { x: number; y: number; r: number }> = {
  pass: { x: 248, y: 150, r: 15 },
  shoot: { x: 276, y: 124, r: 13 },
  hit: { x: 302, y: 152, r: 13 },
  turbo: { x: 222, y: 166, r: 10 },
};
const BUTTON_NAMES = Object.keys(BUTTONS) as ButtonName[];

/** The button under `p`, or the nearest centre when hit areas overlap, or null. */
export function buttonAt(p: Vec): ButtonName | null {
  let best: ButtonName | null = null;
  let bestDist = Infinity;
  for (const name of BUTTON_NAMES) {
    const b = BUTTONS[name];
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (d <= b.r + BUTTON_HIT_MARGIN && d < bestDist) { best = name; bestDist = d; }
  }
  return best;
}

/** Remembers buttons pressed since the last read, so a tap that ends between two reads is not lost. */
export class PressLatch {
  private readonly pending = new Set<ButtonName>();

  press(name: ButtonName): void { this.pending.add(name); }

  /** True once per press since the last take of this button. */
  take(name: ButtonName): boolean { return this.pending.delete(name); }

  clear(): void { this.pending.clear(); }
}

/** Pointer bookkeeping: one floating-stick pointer plus any number of button-holding pointers. */
export class PadTracker {
  private stickId: number | null = null;
  private origin: Vec = { x: 0, y: 0 };
  private pointer: Vec = { x: 0, y: 0 };
  private readonly held = new Map<number, ButtonName>();
  private readonly latch = new PressLatch();

  down(id: number, p: Vec): void {
    this.up(id);
    const button = buttonAt(p);
    if (button) { this.held.set(id, button); this.latch.press(button); }
    else if (p.x < STICK_ZONE_MAX_X && this.stickId === null) {
      this.stickId = id;
      this.origin = { x: p.x, y: p.y };
      this.pointer = { x: p.x, y: p.y };
    }
  }

  move(id: number, p: Vec): void {
    if (id === this.stickId) this.pointer = { x: p.x, y: p.y };
  }

  up(id: number): void {
    if (id === this.stickId) this.stickId = null;
    this.held.delete(id);
  }

  cancelAll(): void {
    this.stickId = null;
    this.held.clear();
    this.latch.clear();
  }

  /** Where to draw the stick: its base at the floating origin and the knob at the pointer, or null when not held. */
  stick(): { origin: Vec; pointer: Vec } | null {
    return this.stickId === null ? null : { origin: this.origin, pointer: this.pointer };
  }

  read(): PadInput {
    const pad = neutralPad();
    if (this.stickId !== null) {
      const v = stickVector(this.origin, this.pointer);
      pad.moveX = v.x;
      pad.moveY = v.y;
    }
    for (const name of this.held.values()) pad[name] = true;
    for (const name of BUTTON_NAMES) if (this.latch.take(name)) pad[name] = true;
    return pad;
  }
}

/** Buttons OR-ed; movement from whichever pad pushes harder. */
export function mergePads(a: PadInput, b: PadInput): PadInput {
  const mover = Math.hypot(b.moveX, b.moveY) > Math.hypot(a.moveX, a.moveY) ? b : a;
  return {
    moveX: mover.moveX, moveY: mover.moveY,
    pass: a.pass || b.pass, shoot: a.shoot || b.shoot, hit: a.hit || b.hit, turbo: a.turbo || b.turbo,
  };
}
