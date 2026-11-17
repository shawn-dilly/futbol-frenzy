import { expect, test } from 'vitest';
import { parseMatchParams } from '../../src/game/params';

test('defaults', () => {
  expect(parseMatchParams('')).toEqual({ demo: false, seed: 1, halfSeconds: 120, mute: false, level: 'pro', level2: null });
});
test('reads demo, seed, half and mute', () => {
  expect(parseMatchParams('?demo=1&seed=7&half=30&mute=1')).toEqual({ demo: true, seed: 7, halfSeconds: 30, mute: true, level: 'pro', level2: null });
});
test('junk numbers fall back to defaults', () => {
  expect(parseMatchParams('?seed=abc&half=-5')).toMatchObject({ seed: 1, halfSeconds: 120 });
});
test('reads level and level2', () => {
  expect(parseMatchParams('?level=psycho&level2=rookie')).toMatchObject({ level: 'psycho', level2: 'rookie' });
  expect(parseMatchParams('?level=bruiser')).toMatchObject({ level: 'bruiser', level2: null });
});
test('unknown levels fall back to pro and null', () => {
  expect(parseMatchParams('?level=god&level2=PRO')).toMatchObject({ level: 'pro', level2: null });
});
