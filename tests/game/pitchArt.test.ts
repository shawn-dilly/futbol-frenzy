import { expect, test } from 'vitest';
import { CRATER_H, CRATER_W, drawCrater } from '../../src/game/pitchArt';

test('the crater decal is drawn inside its own bounds, symmetric left to right', () => {
  const rects: [number, number, number, number, string][] = [];
  drawCrater((x, y, w, h, c) => rects.push([x, y, w, h, c]));
  expect(rects.length).toBeGreaterThan(0);
  for (const [x, y, w, h] of rects) {
    expect(x).toBeGreaterThanOrEqual(0); expect(x + w).toBeLessThanOrEqual(CRATER_W);
    expect(y).toBeGreaterThanOrEqual(0); expect(y + h).toBeLessThanOrEqual(CRATER_H);
    expect(2 * x + w).toBe(CRATER_W); // centred in its row
  }
});
