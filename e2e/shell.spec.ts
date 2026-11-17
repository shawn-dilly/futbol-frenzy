import { test, expect } from '@playwright/test';

test('title, setup, back and kickoff work with keyboard', async ({ page }) => {
  await page.goto('/?seed=42&mute=1');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => !!window.__ff)).toBe(false);
  await page.screenshot({ path: 'artifacts/title.png' });
  await page.waitForTimeout(50); await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'artifacts/setup.png' });
  await page.waitForTimeout(50); await page.keyboard.press('ArrowRight'); // team
  await page.waitForTimeout(50); await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(50); await page.keyboard.press('ArrowRight'); // opponent
  await page.waitForTimeout(50); await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(50); await page.keyboard.press('ArrowRight'); // difficulty
  await page.waitForTimeout(50); await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(50); await page.keyboard.press('ArrowRight'); // length
  await page.waitForTimeout(50); await page.keyboard.press('Escape');
  await page.waitForTimeout(50); await page.keyboard.press('Enter');
  await page.waitForTimeout(50); await page.keyboard.press('ArrowUp'); // kickoff
  await page.waitForTimeout(50); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !!window.__ff);
  expect(await page.evaluate(() => window.__ff!.state.config)).toMatchObject({ seed: 42, halfSeconds: 240, human: [true, false], level: ['bruiser', 'bruiser'] });
});

test('demo bypasses the shell', async ({ page }) => {
  await page.goto('/?demo=1&match=1&mute=1');
  await page.waitForFunction(() => !!window.__ff);
  expect(await page.evaluate(() => window.__ff!.state.config.human)).toEqual([false, false]);
});

test('setup direction targets fit at 640 by 360', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto('/?seed=42&mute=1');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(300);
  await page.mouse.click(320, 246);
  await page.waitForTimeout(100);
  // Each half of each selector is at least 44px high and 128px wide.
  for (const [x, y] of [[50, 198], [240, 198], [390, 198], [570, 198], [60, 246], [250, 246], [380, 246], [570, 246]]) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(30);
  }
  await page.mouse.click(410, 314);
  await page.waitForFunction(() => !!window.__ff);
  expect(await page.evaluate(() => window.__ff!.state.config)).toMatchObject({ seed: 42, halfSeconds: 120, level: ['pro', 'pro'] });
});

test('Cup starts against the first other team', async ({ page }) => {
  await page.goto('/?seed=19&mute=1');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(60);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(60);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(60);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !!window.__ff);
  expect(await page.evaluate(() => window.__ff!.state.config)).toMatchObject({ seed: 19, ratings: [
    { speed: 0.4, power: 0.8, skill: 0.5, dirty: 0.6 },
    { speed: 0.8, power: 0.4, skill: 0.6, dirty: 0.5 },
  ] });
});
