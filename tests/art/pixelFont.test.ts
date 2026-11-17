import { expect, test } from 'vitest';
import { centeredLineTops, drawText, hasGlyph, textHeight, textWidth, wrapText, type RectFn } from '../../src/art/pixelFont';

test('text width', () => { expect(textWidth('GOAL!')).toBe(19); expect(textWidth('GOAL!', 3)).toBe(57); expect(textWidth('')).toBe(0); });
test('draws lit pixels, uppercases, aligns', () => {
  const px: number[][] = []; const rect: RectFn = (x, y, w, h) => px.push([x, y, w, h]);
  drawText(rect, 'i', 10, 0, '#fff'); expect(px.length).toBe(9);              // I is 111 010 010 010 111
  expect(Math.min(...px.map(p => p[0]))).toBe(10);
  px.length = 0; drawText(rect, 'I', 10, 0, '#fff', 1, 'r'); expect(Math.max(...px.map(p => p[0]))).toBe(9);
  px.length = 0; drawText(rect, '~', 0, 0, '#fff'); expect(px.length).toBe(7); // falls back to '?' (111 001 011 000 010)
});

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

test('comma has a glyph and draws', () => {
  expect(hasGlyph(',')).toBe(true);
  const px: number[][] = []; drawText((x, y, w, h) => px.push([x, y, w, h]), ',', 0, 0, '#fff');
  expect(px.length).toBe(2); // 010 / 100 on the bottom two rows
});
test('textHeight is the glyph height times the scale', () => { expect(textHeight(1)).toBe(5); expect(textHeight(2)).toBe(10); });
test('centeredLineTops centres a block of lines on a y', () => {
  // scale 2: line height 10, gap 2 glyph px = 4 px; two lines = 24 px tall; centre 62 -> top 50, next 64.
  expect(centeredLineTops(2, 2, 62)).toEqual([50, 64]);
  expect(centeredLineTops(1, 2, 62)).toEqual([57]);
  expect(centeredLineTops(1, 1, 62)).toEqual([59.5]);
  expect(centeredLineTops(0, 1, 62)).toEqual([]);
});
