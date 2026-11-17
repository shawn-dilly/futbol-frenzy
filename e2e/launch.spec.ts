import { test, expect } from '@playwright/test';
import { createMatch } from '../src/sim';

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

for (const mode of ['friendly', 'cup'] as const) {
  test(`${mode} gate resumes the existing countdown and a new launch clears it`, async ({ page }) => {
    await page.goto('/?mute=1');
    await page.waitForFunction(() => !!window.__ff);
    await page.evaluate(mode => window.__ff!.launch({ mode, matchId: 'first', mute: true, config: { seed: 31, halfSeconds: 1, human: [false, false], level: ['rookie', 'pro'] } }), mode);
    await page.waitForFunction(() => window.__ff?.halftimeGate(), null, { timeout: 30000 });
    const before = await page.evaluate(() => structuredClone({ state: window.__ff!.state, replay: window.__ff!.replay() }));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => ({ state: window.__ff!.state, replay: window.__ff!.replay() }))).toEqual(before);
    await page.evaluate(() => window.__ff!.continueHalftime());
    await page.waitForFunction(t => window.__ff!.state.phaseTicks !== t, before.state.phaseTicks);
    expect(await page.evaluate(() => window.__ff!.halftimeGate())).toBe(false);
    await page.waitForFunction(() => window.__ff!.state.half === 2, null, { timeout: 30000 });
    expect(await page.evaluate(() => window.__ff!.halftimeGate())).toBe(false);
    await page.evaluate(() => window.__ff!.launch({ mode: 'cup', matchId: 'second', mute: true, config: { seed: 77, halfSeconds: 1, human: [false, false], level: ['pro', 'rookie'] } }));
    await page.waitForFunction(() => window.__ff?.state.config.seed === 77);
    const fresh = await page.evaluate(() => { window.__ff!.pause(); return { state: structuredClone(window.__ff!.state), replay: window.__ff!.replay(), gate: window.__ff!.halftimeGate() }; });
    expect(fresh.state.config).toMatchObject({ seed: 77, halfSeconds: 1, human: [false, false], level: ['pro', 'rookie'] });
    const initial = createMatch(fresh.state.config);
    expect(fresh.state.stats).toEqual(initial.stats);
    expect(fresh.state.reserves).toEqual(initial.reserves);
    expect(fresh.state.halfHits).toEqual(initial.halfHits);
    expect(fresh.gate).toBe(false);
    expect(fresh.replay.inputs.length).toBeLessThan(5);
  });
}

for (const query of ['match=1', 'demo=1&match=1']) {
  test(`${query} runs halftime automatically`, async ({ page }) => {
    await page.goto(`/?${query}&seed=9&half=1&mute=1&level=rookie&level2=pro`);
    await page.waitForFunction(() => window.__ff?.state.half === 2, null, { timeout: 30000 });
    const result = await page.evaluate(() => ({ config: window.__ff!.state.config, gate: window.__ff!.halftimeGate() }));
    expect(result.config).toMatchObject({ seed: 9, halfSeconds: 1, human: [!query.startsWith('demo'), false], level: ['pro', 'rookie'] });
    expect(result.gate).toBe(false);
  });
}
