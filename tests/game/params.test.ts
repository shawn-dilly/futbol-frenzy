import { expect, test } from 'vitest';
import { parseMatchParams } from '../../src/game/params';

test('defaults', () => {
  expect(parseMatchParams('')).toEqual({ demo: false, seed: 1, halfSeconds: 120, mute: false });
});
test('reads demo, seed, half and mute', () => {
  expect(parseMatchParams('?demo=1&seed=7&half=30&mute=1')).toEqual({ demo: true, seed: 7, halfSeconds: 30, mute: true });
});
test('junk numbers fall back to defaults', () => {
  expect(parseMatchParams('?seed=abc&half=-5')).toMatchObject({ seed: 1, halfSeconds: 120 });
});
