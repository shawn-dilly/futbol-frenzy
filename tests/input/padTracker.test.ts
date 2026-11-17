import { expect, test } from 'vitest';
import { PadTracker, PressLatch, mergePads } from '../../src/input/stick';
import { neutralPad } from '../../src/sim';

test('stick and a button at the same time', () => {
  const t = new PadTracker(); t.down(1, { x: 40, y: 140 }); t.move(1, { x: 80, y: 140 }); t.down(2, { x: 276, y: 124 });
  const r = t.read(); expect(r.moveX).toBeCloseTo(1, 5); expect(r.shoot).toBe(true); expect(r.pass).toBe(false);
});
test('releasing the stick returns to neutral; the button stays held', () => {
  const t = new PadTracker(); t.down(1, { x: 40, y: 140 }); t.move(1, { x: 80, y: 140 }); t.down(2, { x: 302, y: 152 }); t.up(1);
  expect(t.read()).toMatchObject({ moveX: 0, moveY: 0, hit: true });
});
test('a second left-side touch does not steal the stick', () => {
  const t = new PadTracker(); t.down(1, { x: 40, y: 140 }); t.move(1, { x: 40, y: 100 }); t.down(2, { x: 100, y: 60 }); t.move(2, { x: 140, y: 60 });
  const r = t.read(); expect(r.moveX).toBeCloseTo(0, 5); expect(r.moveY).toBeCloseTo(-1, 5);
});
test('sliding off a button keeps it held and presses nothing else', () => {
  const t = new PadTracker(); t.down(1, { x: 248, y: 150 }); t.move(1, { x: 276, y: 124 });
  expect(t.read()).toMatchObject({ pass: true, shoot: false });
});
test('cancelAll clears a stuck stick and stuck buttons', () => {
  const t = new PadTracker(); t.down(1, { x: 40, y: 140 }); t.move(1, { x: 80, y: 140 }); t.down(2, { x: 248, y: 150 }); t.cancelAll();
  expect(t.read()).toEqual({ moveX: 0, moveY: 0, pass: false, shoot: false, hit: false, turbo: false });
});
test('a touch on the right half that is not on a button does nothing', () => {
  const t = new PadTracker(); t.down(1, { x: 200, y: 80 }); t.move(1, { x: 250, y: 80 });
  expect(t.read()).toEqual(neutralPad());
});
test('accepts a pointer whose x and y are prototype accessors, as Phaser pointers are', () => {
  class FakePointer { constructor(private px: number, private py: number) {} get x() { return this.px; } get y() { return this.py; } }
  const t = new PadTracker(); t.down(1, new FakePointer(40, 140)); t.move(1, new FakePointer(80, 140));
  expect(t.read().moveX).toBeCloseTo(1, 5);
});
test('mergePads', () => {
  const m = mergePads({ ...neutralPad(), moveX: 0.2, pass: true }, { ...neutralPad(), moveY: -1, shoot: true });
  expect(m).toMatchObject({ moveX: 0, moveY: -1, pass: true, shoot: true });
});

const PASS_POS = { x: 248, y: 150 }, SHOOT_POS = { x: 276, y: 124 };
test('a tap released before the first read still reads true once', () => {
  const t = new PadTracker(); t.down(1, PASS_POS); t.up(1);
  expect(t.read().pass).toBe(true);
  expect(t.read().pass).toBe(false);
});
test('a held button stays true across reads and goes false once released', () => {
  const t = new PadTracker(); t.down(1, PASS_POS);
  expect(t.read().pass).toBe(true);
  expect(t.read().pass).toBe(true);
  t.up(1);
  expect(t.read().pass).toBe(false);
});
test('cancelAll clears latched presses', () => {
  const t = new PadTracker(); t.down(1, PASS_POS); t.up(1); t.cancelAll();
  expect(t.read().pass).toBe(false);
});
test('quick taps on two different buttons both read true once', () => {
  const t = new PadTracker(); t.down(1, PASS_POS); t.up(1); t.down(2, SHOOT_POS); t.up(2);
  expect(t.read()).toMatchObject({ pass: true, shoot: true });
  expect(t.read()).toMatchObject({ pass: false, shoot: false });
});
test('PressLatch reports a press once and can be cleared', () => {
  const l = new PressLatch(); l.press('hit'); l.press('turbo');
  expect(l.take('hit')).toBe(true);
  expect(l.take('hit')).toBe(false);
  l.clear();
  expect(l.take('turbo')).toBe(false);
});
