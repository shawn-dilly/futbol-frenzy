import { test, expect } from '@playwright/test';
import { reconstructReplay, type ReplayRecord } from '../src/game/replay';
import type { MatchState } from '../src/sim';
import type { MatchLaunch } from '../src/game/launch';

import type {} from '../src/game/MatchScene';

test('live steps are recorded and reconstruct the scene', async ({ page }) => {
  await page.goto('/?match=1&seed=3&mute=1&half=20');
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

test('restarting during replay creates a fresh match without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?demo=1&seed=3&mute=1&half=20');
  await page.waitForFunction(() => !!window.__ff?.state.halfHits[0], null, { timeout: 90000 });
  await page.evaluate(() => {
    const hook = window.__ff! as typeof window.__ff & { startReplay: (half: 0) => void };
    hook!.startReplay(0);
    hook!.launch({ mode: 'demo', mute: true, config: { ...hook!.state.config, seed: 42 } } as MatchLaunch);
  });
  await page.waitForFunction(() => window.__ff?.state.config.seed === 42 && window.__ff.state.tick > 0);
  expect(errors).toEqual([]);
});

test('lethal replay animates the outgoing victim alongside the reserve', async ({ page }) => {
  await page.goto('/?demo=1&seed=8&half=20&level=psycho&mute=1');
  await page.waitForFunction(() => window.__ff?.state.phase === 'halftime');
  const before = await page.evaluate(() => {
    const hook = window.__ff!;
    hook.pause();
    return { state: hook.state, record: hook.replay() };
  });
  expect(before.state.halfHits[0]?.tick).toBe(1123);
  const clip = reconstructReplay(before.record, before.state.halfHits[0], 0, 0);
  if (clip.kind !== 'window') throw new Error('Missing hit');
  const hit = clip.states[0].events[clip.hit.eventIndex];
  if (hit.type !== 'hit' || !hit.substituted || hit.tier !== 'wipeout') throw new Error('Expected lethal wipeout');
  const sample = await page.evaluate(async ({ tick, victim }) => {
    const hook = window.__ff!;
    hook.startReplay(0);
    const frames = [];
    while ((hook.replayTick() ?? 0) < tick + 24) {
      await new Promise(requestAnimationFrame);
      if (hook.replayTick()! >= tick) frames.push(hook.renderedPlayers(victim));
    }
    return frames;
  }, { tick: clip.hit.tick, victim: hit.victim });
  const hurt = sample.flatMap(pair => pair.filter(actor => actor.frame.includes('hurt_wipeout')));
  expect(new Set(hurt.map(actor => actor.frame)).size).toBeGreaterThan(1);
  expect(new Set(hurt.map(actor => actor.y)).size).toBeGreaterThan(1);
  expect(sample.some(pair => pair.length === 2 && pair.some(actor => /_(idle|run)_/.test(actor.frame)))).toBe(true);
  await page.screenshot({ path: 'artifacts/lethal-replay.png' });
  const after = await page.evaluate(victim => {
    const hook = window.__ff!;
    hook.endReplay();
    return { actors: hook.renderedPlayers(victim), state: hook.state, record: hook.replay() };
  }, hit.victim);
  expect(after.actors).toHaveLength(1);
  expect(after.state).toEqual(before.state);
  expect(after.record).toEqual(before.record);
});
