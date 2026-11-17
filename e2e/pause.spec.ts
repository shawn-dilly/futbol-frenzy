import { test, expect } from '@playwright/test';

test('pause preserves match and recording and resumes without stale input', async ({ page }) => {
  await page.goto('/?seed=7&mute=1');
  await page.waitForFunction(() => window.__ff && window.__ff.state.tick > 10);
  await page.keyboard.down('l');
  const before = await page.evaluate(() => {
    window.__ff!.pause();
    return JSON.stringify({ state: window.__ff!.state, replay: window.__ff!.replay() });
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => JSON.stringify({ state: window.__ff!.state, replay: window.__ff!.replay() }))).toBe(before);
  await page.evaluate(() => window.__ff!.resume());
  await page.waitForFunction(() => window.__ff!.replay().inputs.length > 15);
  const last = await page.evaluate(() => window.__ff!.replay().inputs.at(-1));
  expect(last?.[0].hit).toBe(false);
  await page.keyboard.up('l');
});
