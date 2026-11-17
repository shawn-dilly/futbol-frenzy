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
