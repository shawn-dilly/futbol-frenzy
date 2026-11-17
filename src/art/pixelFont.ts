export type RectFn = (x: number, y: number, w: number, h: number, color: string) => void;

const GLYPH_W = 3;
const GLYPH_H = 5;
const GLYPH_ADVANCE = 4; // 3 columns plus 1 column of spacing

/** 3x5 glyphs, row-major, '1' = lit. */
const FONT: Record<string, string> = {
  A: '111101111101101', B: '110101110101110', C: '111100100100111', D: '110101101101110', E: '111100111100111',
  F: '111100111100100', G: '111100101101111', H: '101101111101101', I: '111010010010111', J: '001001001101111',
  K: '101101110101101', L: '100100100100111', M: '111111101101101', N: '110101101101101', O: '111101101101111',
  P: '111101111100100', Q: '111101101111001', R: '111101110101101', S: '111100111001111', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '111001111100111',
  '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111',
  '7': '111001001001001', '8': '111101111101111', '9': '111101111001111', '!': '010010010000010',
  ':': '000010000010000', '-': '000000111000000', '.': '000000000000010', "'": '010010000000000',
  '/': '001001010100100', '>': '100010001010100', '+': '000010111010000', '?': '111001011000010',
  '<': '001010100010001', ' ': '000000000000000',
};

export function textWidth(s: string, scale = 1): number {
  return s.length === 0 ? 0 : s.length * GLYPH_ADVANCE * scale - scale;
}

export function drawText(
  rect: RectFn, s: string, x: number, y: number, color: string, scale = 1, align: 'l' | 'c' | 'r' = 'l',
): void {
  const text = s.toUpperCase();
  const w = textWidth(text, scale);
  const left = Math.round(align === 'c' ? x - w / 2 : align === 'r' ? x - w : x);
  const top = Math.round(y);
  for (let i = 0; i < text.length; i++) {
    const glyph = FONT[text[i]] ?? FONT['?'];
    for (let k = 0; k < GLYPH_W * GLYPH_H; k++) {
      if (glyph[k] !== '1') continue;
      rect(left + i * GLYPH_ADVANCE * scale + (k % GLYPH_W) * scale, top + Math.floor(k / GLYPH_W) * scale, scale, scale, color);
    }
  }
}
