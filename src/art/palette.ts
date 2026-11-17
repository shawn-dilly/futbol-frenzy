export const PAL = {
  g1: '#2f8f3a', g2: '#38a045', line: '#e8f5e0', navy: '#16162a', ink: '#0b0b10', red: '#e43b44', blue: '#3b7de4',
  yel: '#fee761', wht: '#f4f4f4', org: '#f77622', skin: '#f2c79b', skin2: '#8d5a3b', gry: '#5a6988', dk: '#262b44',
  pur: '#b55088', grn: '#63c74d',
} as const;

export interface Kit { jersey: string; trim: string; shorts: string; hair: string; skin: string }

/** 0 Rhinos outfield, 1 Vipers outfield, 2 Rhinos keeper, 3 Vipers keeper. */
export const KITS: [Kit, Kit, Kit, Kit] = [
  { jersey: PAL.red, trim: PAL.wht, shorts: PAL.wht, hair: '#3a2414', skin: PAL.skin },
  { jersey: PAL.blue, trim: PAL.yel, shorts: PAL.navy, hair: PAL.yel, skin: PAL.skin },
  { jersey: PAL.grn, trim: PAL.ink, shorts: PAL.ink, hair: PAL.org, skin: PAL.skin },
  { jersey: PAL.org, trim: PAL.ink, shorts: PAL.ink, hair: PAL.ink, skin: PAL.skin },
];
