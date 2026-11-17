import { test, expect } from '@playwright/test';
import { createMatch } from '../src/sim';

test('repeated full-time restarts create fresh matches and retire old hooks', async ({ page }) => {
  await page.goto('/?demo=1&seed=21&half=1&mute=1&level=psycho&level2=rookie');
  for (const seed of [22, 23]) {
    await page.waitForFunction(() => window.__ff?.state.phase === 'fulltime', null, { timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => { (window as any).oldHook = window.__ff; });
    await page.keyboard.press('Enter');
    await page.waitForFunction(s => window.__ff?.state.config.seed === s, seed);
    const result = await page.evaluate(() => {
      const old = (window as any).oldHook;
      const current = window.__ff!;
      current.pause();
      old.resume(); old.showCallout('wipeout', 'big');
      return { state: structuredClone(current.state), replay: current.replay(), text: (current as any).calloutText(), distinct: old.state !== current.state };
    });
    const initial = createMatch(result.state.config);
    expect(result.distinct).toBe(true);
    expect(result.state.config).toMatchObject({ seed, halfSeconds: 1, human: [false, false], level: ['rookie', 'psycho'] });
    expect(result.state.stats).toEqual(initial.stats);
    expect(result.state.reserves).toEqual(initial.reserves);
    expect(result.state.halfHits).toEqual(initial.halfHits);
    expect(result.replay.inputs.length).toBeLessThan(5);
    expect(result.text).toBe('');
    const tick = result.state.tick;
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__ff!.state.tick)).toBe(tick);
    await page.evaluate(() => window.__ff!.resume());
  }
});

test('restart closes the scene audio context and creates a new one on gesture', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    (window as any).audioCounts = { made: 0, closed: 0 };
    window.AudioContext = class extends Native {
      constructor() { super(); (window as any).audioCounts.made++; }
      close() { (window as any).audioCounts.closed++; return super.close(); }
    };
  });
  await page.goto('/?demo=1&half=1');
  await page.keyboard.press('a');
  await page.waitForFunction(() => window.__ff?.state.phase === 'fulltime', null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__ff?.state.config.seed === 2);
  await page.keyboard.press('a');
  expect(await page.evaluate(() => (window as any).audioCounts)).toEqual({ made: 2, closed: 1 });
});
