import { test, expect } from '@playwright/test';

test('shell halftime gates once and composes with manual pause', async ({ page }) => {
  await page.goto('/?mute=1');
  await page.waitForFunction(() => !!window.__ff);
  await page.evaluate(() => window.__ff!.launch({ mode: 'friendly', matchId: 'one', mute: true, config: { seed: 17, halfSeconds: 1, human: [false, false], level: ['pro', 'pro'] } }));
  await page.waitForFunction(() => window.__ff?.halftimeGate(), null, { timeout: 30000 });
  const frozen = await page.evaluate(() => JSON.stringify({ state: window.__ff!.state, replay: window.__ff!.replay() }));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => JSON.stringify({ state: window.__ff!.state, replay: window.__ff!.replay() }))).toBe(frozen);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.__ff!.pause(); window.__ff!.continueHalftime();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => JSON.stringify({ state: window.__ff!.state, replay: window.__ff!.replay() }))).toBe(frozen);
  await page.evaluate(() => window.__ff!.resume());
  await page.waitForFunction(() => window.__ff!.state.half === 2, null, { timeout: 30000 });
  expect(await page.evaluate(() => window.__ff!.halftimeGate())).toBe(false);
});
