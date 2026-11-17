import { expect, test } from 'vitest';
import { KITS } from '../../src/art/palette';
import { ANIMS, POSES, FRAME_H, FRAME_W, atlasLayout, drawPlayerFrame, frameIndex, frameKey } from '../../src/art/sprites';
import type { AnimName } from '../../src/sim';

const grid = (anim: AnimName, f: number) => { const g = new Map<string, string>(); let out = false;
  drawPlayerFrame((x, y, w, h, c) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
    if (x + i < 0 || y + j < 0 || x + i >= FRAME_W || y + j >= FRAME_H) out = true; g.set(`${x + i},${y + j}`, c); } }, KITS[0], anim, f);
  return { key: JSON.stringify([...g].sort()), out, size: g.size }; };
test('every frame of every anim draws inside its box and is not empty', () => {
  for (const a of Object.keys(ANIMS) as AnimName[]) for (let f = 0; f < ANIMS[a].frames; f++) {
    const r = grid(a, f); expect(r.out, `${a}${f}`).toBe(false); expect(r.size).toBeGreaterThan(40); }
});
test('the run cycle has six distinct frames', () => {
  expect(new Set([0, 1, 2, 3, 4, 5].map(f => grid('run', f).key)).size).toBe(6);
});
test('frameIndex loops run and holds the last kick frame', () => {
  expect(frameIndex('run', 0)).toBe(0); expect(frameIndex('run', 29)).toBe(5); expect(frameIndex('run', 30)).toBe(0);
  expect(frameIndex('kick', 11)).toBe(2); expect(frameIndex('kick', 500)).toBe(2);
});
test('atlas layout has one unique slot per kit, anim, and frame', () => {
  const l = atlasLayout(); expect(l.length).toBe(4 * (2 + 6 + 3));
  expect(new Set(l.map(e => e.key)).size).toBe(l.length);
  expect(l).toContainEqual({ key: frameKey(1, 'idle', 0), x: 0, y: 20 });
});
test('every animation has as many poses as its declared frame count', () => {
  for (const a of Object.keys(ANIMS) as AnimName[]) expect(POSES[a].length, a).toBe(ANIMS[a].frames);
});
test('run frame 5 is frame 2 on the other leg: support leg mirrored, trailing leg and boots unchanged', () => {
  const mirror = ([x, y, w, h]: number[]) => [0 - (x + w - 1), y, w, h];
  const [f2, f5] = [POSES.run[2], POSES.run[5]];
  expect(f5.legs[0]).toEqual(mirror(f2.legs[0]));
  expect(f5.legs.slice(1)).toEqual(f2.legs.slice(1));
  expect(f5.boots).toEqual(f2.boots);
});
