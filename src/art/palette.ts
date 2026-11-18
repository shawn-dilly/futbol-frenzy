export const PAL = {
  g1: '#2f8f3a', g2: '#38a045', line: '#e8f5e0', navy: '#16162a', ink: '#0b0b10', red: '#e43b44', blue: '#3b7de4',
  yel: '#fee761', wht: '#f4f4f4', org: '#f77622', skin: '#f2c79b', skin2: '#8d5a3b', gry: '#5a6988', dk: '#262b44',
  pur: '#b55088', grn: '#63c74d',
} as const;

export interface Kit { jersey: string; trim: string; shorts: string; hair: string; skin: string }

export const KIT = { red: 0, blue: 1, cyanKeeper: 2, charcoalKeeper: 3, gold: 4, orange: 5, ivory: 6, violet: 7 } as const;
const regular: readonly Kit[] = [
  { jersey: PAL.red, trim: PAL.wht, shorts: PAL.wht, hair: '#3a2414', skin: PAL.skin },
  { jersey: PAL.blue, trim: PAL.yel, shorts: PAL.yel, hair: PAL.yel, skin: PAL.skin },
  { jersey: '#45fbeb', trim: PAL.ink, shorts: PAL.ink, hair: PAL.org, skin: PAL.skin },
  { jersey: PAL.navy, trim: PAL.yel, shorts: PAL.yel, hair: PAL.ink, skin: PAL.skin },
  { jersey: PAL.yel, trim: PAL.pur, shorts: PAL.pur, hair: PAL.ink, skin: PAL.skin2 },
  { jersey: PAL.org, trim: PAL.blue, shorts: PAL.blue, hair: PAL.ink, skin: PAL.skin },
  { jersey: PAL.wht, trim: '#702349', shorts: '#702349', hair: PAL.ink, skin: PAL.skin2 },
  { jersey: '#a646df', trim: PAL.wht, shorts: PAL.wht, hair: PAL.ink, skin: PAL.skin },
];

export const mirrorKit = (index: number): number => regular.length + index;
export const KITS: readonly Kit[] = [...regular, ...regular.map(kit => ({
  ...kit, jersey: kit.trim, trim: kit.jersey, shorts: kit.jersey,
}))];
