import { describe, expect, test } from 'vitest';
import { KITS } from '../../src/art/palette';
import { ATLAS_MAX_W, FRAME_H, FRAME_W, atlasLayout, drawFrame, frameIndex, frameKey } from '../../src/art/sprites';
import { ANIMATIONS } from '../../src/content/animations';
import legacy from './fixtures/legacy-frames.json';

const pixels = (key: string, f: number): string[] => {
  const g = new Map<string, string>();
  drawFrame((x, y, w, h, c) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) g.set(`${x + i},${y + j}`, c); }, KITS[0], key, f);
  return [...g].map(([k, c]) => `${k},${c}`).sort();
};

describe('sprites', () => {
  test('idle, run and kick draw the same pixels as before the data rewrite', () => {
    const expected = legacy as Record<string, string[]>;
    expect(Object.keys(expected).length).toBe(11);
    for (const [name, px] of Object.entries(expected)) {
      const cut = name.lastIndexOf('_');
      expect(pixels(name.slice(0, cut), Number(name.slice(cut + 1))), name).toEqual(px);
    }
  });

  test('the run cycle has six distinct frames', () => {
    expect(new Set([0, 1, 2, 3, 4, 5].map(f => pixels('run', f).join())).size).toBe(6);
  });

  test('frameIndex wraps looping animations and clamps the rest', () => {
    expect(frameIndex('run', 0)).toBe(0); expect(frameIndex('run', 29)).toBe(5); expect(frameIndex('run', 30)).toBe(0);
    expect(frameIndex('kick', 11)).toBe(2); expect(frameIndex('kick', 500)).toBe(2);
    expect(ANIMATIONS.hurt_wipeout_0.loop).toBe(true);
    const wipe = ANIMATIONS.hurt_wipeout_0;
    expect(frameIndex('hurt_wipeout_0', wipe.frames.length * wipe.ticksPerFrame)).toBe(0);
    const knock = ANIMATIONS.hurt_knockdown_0;
    expect(frameIndex('hurt_knockdown_0', 10000)).toBe(knock.frames.length - 1);
  });

  test('atlas keys are unique, aligned to cells and within the atlas width', () => {
    const layout = atlasLayout();
    const frameCount = Object.values(ANIMATIONS).reduce((n, a) => n + a.frames.length, 0);
    expect(layout.length).toBe(KITS.length * frameCount);
    expect(new Set(layout.map(e => e.key)).size).toBe(layout.length);
    expect(new Set(layout.map(e => `${e.x},${e.y}`)).size).toBe(layout.length);
    for (const e of layout) {
      expect(e.x + FRAME_W).toBeLessThanOrEqual(ATLAS_MAX_W);
      expect(e.x % FRAME_W).toBe(0);
      expect(e.y % FRAME_H).toBe(0);
    }
    expect(layout[0]).toEqual({ key: frameKey(0, 'idle', 0), x: 0, y: 0 });
  });
});
