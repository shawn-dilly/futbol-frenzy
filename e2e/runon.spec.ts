import { expect, test } from '@playwright/test';
import { createMatch, neutralPad, step } from '../src/sim';

test.use({ hasTouch: true, viewport: { width: 640, height: 360 } });

test('2ND HALF reveals the runners immediately, settles, and records the transition', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?match=1&mute=1');
  await page.waitForFunction(() => !!window.__ff);
  await page.evaluate(() => window.__ff!.launch({ mode: 'friendly', matchId: null, mute: true,
    config: { seed: 9, halfSeconds: 1, human: [true, false], level: ['rookie', 'rookie'] } }));
  await page.waitForFunction(() => window.__ff?.halftimeGate());
  await page.clock.pauseAt(new Date(Date.now() + 500));
  const frames = () => page.evaluate(() => window.__ff!.state.players.map(p => window.__ff!.renderedPlayers(p.id)[0]));
  const capture = (i: number) => page.screenshot({ path: 'artifacts/run-on/frame-' + String(i).padStart(2, '0') + '.png' });
  await capture(0);
  await page.touchscreen.tap(496, 300);
  await page.clock.runFor(16);
  expect(await page.evaluate(() => window.__ff!.state.half)).toBe(2);
  const entry = await frames();
  expect(entry.every(p => p.y >= 32 && p.y < 40 && p.frame.includes('run'))).toBe(true);
  await capture(1);
  for (let i = 2; i <= 17; i++) {
    await page.clock.runFor(64);
    await capture(i);
  }
  const settled = await frames();
  expect(settled.every((p, i) => p.y > entry[i].y)).toBe(true);
  const { record, live } = await page.evaluate(() => ({ record: window.__ff!.replay(), live: window.__ff!.state }));
  const copy = createMatch(record.config);
  for (const pads of record.inputs) step(copy, pads);
  expect(copy).toEqual(live);
  expect(live.phase).toBe('play');
  expect(record.inputs.every(pair => Object.keys(neutralPad()).every(key => !pair[0][key as keyof typeof pair[0]]))).toBe(true);
});

test('pausing during entry freezes the runners and a restart retires them', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?match=1&mute=1');
  await page.waitForFunction(() => !!window.__ff);
  await page.evaluate(() => window.__ff!.launch({ mode: 'friendly', matchId: null, mute: true,
    config: { seed: 21, halfSeconds: 1, human: [true, false], level: ['rookie', 'rookie'] } }));
  await page.waitForFunction(() => window.__ff?.halftimeGate());
  await page.clock.pauseAt(new Date(Date.now() + 500));
  await page.touchscreen.tap(496, 300);
  await page.clock.runFor(192);
  const pose = () => page.evaluate(() => ({
    tick: window.__ff!.state.tick, frame: window.__ff!.renderedPlayers(3)[0],
  }));
  await page.evaluate(() => window.__ff!.pause());
  const before = await pose();
  expect(before.frame.frame).toContain('run');
  await page.clock.runFor(320);
  expect(await pose()).toEqual(before);
  await page.evaluate(() => window.__ff!.resume());
  await page.clock.runFor(128);
  expect((await pose()).frame.y).toBeGreaterThan(before.frame.y);
  await page.evaluate(() => window.__ff!.launch());
  await page.clock.runFor(96);
  expect(await page.evaluate(() => window.__ff!.state.half)).toBe(1);
  expect((await pose()).frame.frame).toContain('idle');
});
