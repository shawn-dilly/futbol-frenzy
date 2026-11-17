import { test, expect } from '@playwright/test';
import { reconstructReplay, type ReplayRecord } from '../src/game/replay';
import type { MatchState } from '../src/sim';
import type { MatchLaunch } from '../src/game/launch';

declare global {
  interface Window {
    __ff?: { state: MatchState; replay: () => ReplayRecord; pause: () => void; resume: () => void; launch: (launch: MatchLaunch) => void; halftimeGate: () => boolean; continueHalftime: () => void };
  }
}

test('live steps are recorded and reconstruct the scene', async ({ page }) => {
  await page.goto('/?seed=3&mute=1&half=20');
  await page.waitForFunction(() => (window.__ff?.state.tick ?? 0) >= 180);
  await page.keyboard.down('ArrowLeft');
  const heldStart = await page.evaluate(() => window.__ff!.state.tick);
  await page.waitForFunction(() => window.__ff!.state.tick >= 240);
  const heldEnd = await page.evaluate(() => window.__ff!.state.tick);
  await page.keyboard.up('ArrowLeft');
  const { state, record }: { state: MatchState; record: ReplayRecord } = await page.evaluate(() => ({ state: window.__ff!.state, record: window.__ff!.replay() }));
  expect(record.inputs.length).toBe(state.tick);
  expect(record.inputs.slice(heldStart, heldEnd).some((pair) => pair[0].moveX < 0)).toBe(true);
  const replay = reconstructReplay(record, { tick: state.tick, eventIndex: 0, damage: 0 }, 0, 0);
  expect(replay.kind).toBe('window');
  if (replay.kind === 'window') expect(replay.states[0]).toEqual(state);
});

test('plays a recorded hit without advancing the paused match', async ({ page }) => {
  await page.goto('/?demo=1&seed=3&mute=1&half=60');
  await page.waitForFunction(() => !!window.__ff?.state.halfHits[0], null, { timeout: 90000 });
  const before = await page.evaluate(() => {
    const hook = window.__ff!;
    hook.pause();
    const state = structuredClone(hook.state);
    const record = hook.replay();
    (hook as unknown as { startReplay: (half: 0) => void }).startReplay(0);
    return { state, record };
  });
  const tick = await page.evaluate(() => (window.__ff as unknown as { replayTick: () => number }).replayTick());
  await page.waitForFunction((first) => (window.__ff as unknown as { replayTick: () => number }).replayTick() > first, tick);
  await page.screenshot({ path: 'artifacts/replay-playback.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ state: window.__ff!.state, record: window.__ff!.replay() }));
  expect(after).toEqual(before);
});
