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

test('visibility transitions respect manual pause in either order', async ({ page }) => {
  await page.goto('/?seed=7&mute=1');
  await page.waitForFunction(() => window.__ff && window.__ff.state.tick > 10);
  for (const manualFirst of [true, false]) {
    const frozen = await page.evaluate((first) => {
      const visibility = (hidden: boolean) => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
        document.dispatchEvent(new Event('visibilitychange'));
      };
      if (first) window.__ff!.pause();
      visibility(true);
      if (!first) window.__ff!.pause();
      visibility(false);
      return JSON.stringify({ state: window.__ff!.state, replay: window.__ff!.replay() });
    }, manualFirst);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => JSON.stringify({ state: window.__ff!.state, replay: window.__ff!.replay() }))).toBe(frozen);
    const tick = await page.evaluate(() => { const t = window.__ff!.state.tick; window.__ff!.resume(); return t; });
    await page.waitForFunction(t => window.__ff!.state.tick > t, tick);
  }
});

test('held movement and button inputs are cleared across a long pause', async ({ page }) => {
  await page.goto('/?seed=7&mute=1');
  await page.waitForFunction(() => window.__ff && window.__ff.state.tick > 10);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('l');
  const tick = await page.evaluate(() => { window.__ff!.pause(); return window.__ff!.state.tick; });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__ff!.state.tick)).toBe(tick);
  await page.evaluate(() => window.__ff!.resume());
  await page.waitForFunction(t => window.__ff!.state.tick >= t + 3, tick);
  const inputs = await page.evaluate(t => window.__ff!.replay().inputs.slice(t), tick);
  expect(inputs.length).toBeLessThan(15);
  for (const [pad] of inputs) {
    expect(pad.moveX).toBe(0);
    expect(pad.moveY).toBe(0);
    expect(pad.hit).toBe(false);
  }
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('l');
});
