import { expect, test } from 'vitest';
import { drawText, textWidth, type RectFn } from '../../src/art/pixelFont';

test('text width', () => { expect(textWidth('GOAL!')).toBe(19); expect(textWidth('GOAL!', 3)).toBe(57); expect(textWidth('')).toBe(0); });
test('draws lit pixels, uppercases, aligns', () => {
  const px: number[][] = []; const rect: RectFn = (x, y, w, h) => px.push([x, y, w, h]);
  drawText(rect, 'i', 10, 0, '#fff'); expect(px.length).toBe(9);              // I is 111 010 010 010 111
  expect(Math.min(...px.map(p => p[0]))).toBe(10);
  px.length = 0; drawText(rect, 'I', 10, 0, '#fff', 1, 'r'); expect(Math.max(...px.map(p => p[0]))).toBe(9);
  px.length = 0; drawText(rect, '~', 0, 0, '#fff'); expect(px.length).toBe(7); // falls back to '?' (111 001 011 000 010)
});

import { hasGlyph, wrapText } from '../../src/art/pixelFont';

test('hasGlyph knows the font, case-insensitively', () => {
  expect(hasGlyph('a')).toBe(true); expect(hasGlyph("'")).toBe(true); expect(hasGlyph('~')).toBe(false);
});
test('wrapText breaks on spaces so each line fits the width', () => {
  // 'ONE TWO' is 7 chars = 27 px at scale 1; 'ONE' is 11 px.
  expect(wrapText('ONE TWO', 27)).toEqual(['ONE TWO']);
  expect(wrapText('ONE TWO', 26)).toEqual(['ONE', 'TWO']);
  expect(wrapText('A BB CCC DDDD', 20)).toEqual(['A BB', 'CCC', 'DDDD']);
  expect(wrapText('ONE TWO', 13, 2)).toEqual(['ONE', 'TWO']); // scale 2: 'ONE' = 22 px > 13, never split a word
  expect(wrapText('', 100)).toEqual([]);
});
