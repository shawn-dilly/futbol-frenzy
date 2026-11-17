import { test, expect } from '@playwright/test';
import { reconstructReplay } from '../src/game/replay';

test('live steps are recorded and reconstruct the scene', async ({ page }) => {
  await page.goto('/?seed=3&mute=1&half=20');
  await page.waitForFunction(() => (window as any).__ff?.state.tick >= 180);
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => (window as any).__ff.state.tick >= 240);
  await page.keyboard.up('ArrowLeft');
  const { state, record } = await page.evaluate(() => ({ state: (window as any).__ff.state, record: (window as any).__ff.replay() }));
  expect(record.inputs.length).toBe(state.tick);
  expect(record.inputs.some((pair: any[]) => pair[0].x !== 0 || pair[0].y !== 0)).toBe(true);
  const replay = reconstructReplay(record, { tick: state.tick, eventIndex: 0, damage: 0 }, 0, 0);
  expect(replay.kind).toBe('window');
  if (replay.kind === 'window') expect(replay.states[0]).toEqual(state);
});
