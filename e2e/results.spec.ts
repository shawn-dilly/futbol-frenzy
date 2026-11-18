import { expect, test, type Page } from '@playwright/test';
import { TEAMS } from '../src/content/teams';
import { createMatch } from '../src/sim';

async function whistle(page: Page) {
  await page.waitForFunction(() => window.__ff?.state.phase === 'fulltime');
}

test('short friendly freezes at fulltime, returns from replay, rematches and exits to title', async ({ page }) => {
  await page.goto('/?match=1&mute=1');
  await page.waitForFunction(() => !!window.__ff);
  await page.evaluate(() => window.__ff!.launch({ mode: 'friendly', matchId: null, mute: true, teamNames: ['Rhinos', 'Vipers'],
    config: { seed: 1, halfSeconds: 1, human: [false, false], level: ['psycho', 'psycho'] } }));
  for (const seed of [1, 2]) {
    await page.waitForFunction(s => window.__ff?.state.config.seed === s && window.__ff.halftimeGate(), seed);
    await page.keyboard.press('Enter');
    await whistle(page);
    const before = await page.evaluate(() => ({ state: window.__ff!.state, record: window.__ff!.replay() }));
    if (seed === 1) await page.screenshot({ path: 'artifacts/fulltime.png' });
    await page.keyboard.press('r');
    if (seed === 1) {
      const hit = before.state.halfHits[1]!;
      expect(hit.tick).toBeGreaterThan(before.state.halfHits[0]!.tick);
      await page.waitForFunction(first => (window.__ff!.replayTick() ?? 0) > first, hit.tick - 60);
      expect(await page.evaluate(() => window.__ff!.replayTick())).toBeLessThanOrEqual(hit.tick + 60);
      await page.screenshot({ path: 'artifacts/fulltime-replay.png' });
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__ff!.replayTick() === null);
    expect(await page.evaluate(() => ({ state: window.__ff!.state, record: window.__ff!.replay() }))).toEqual(before);
    if (seed === 1) {
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__ff?.state.config.seed === 2, null, { timeout: 5000 });
    } else {
      const box = (await page.locator('canvas').boundingBox())!;
      await page.mouse.click(box.x + box.width * 153 / 320, box.y + box.height * 157 / 180);
    }
  }
  await page.waitForFunction(() => !window.__ff);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__ff?.state.config.halfSeconds === 120);
});

test('Cup advances once, retries the lost round and finishes the ladder', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto('/?mute=1&seed=17');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(500);
  await page.mouse.click(320, 298);
  await page.waitForTimeout(100);
  await page.mouse.click(420, 314);
  const rounds = [[1, 1], [2, -1], [2, 0], [2, 1], [3, 1], [4, 1], [5, 1]];
  for (const [opponent, margin] of rounds) {
    await page.waitForFunction(() => window.__ff?.state.phase === 'kickoff' && window.__ff.state.half === 1);
    const fresh = await page.evaluate(() => ({ state: window.__ff!.state, history: window.__ff!.replay().inputs.length }));
    expect(fresh.state.config.ratings).toEqual([TEAMS[0].ratings, TEAMS[opponent].ratings]);
    expect(fresh.state.config).toMatchObject({ seed: 17, halfSeconds: 120, level: ['pro', 'pro'] });
    expect(fresh.state.stats).toEqual(createMatch(fresh.state.config).stats);
    expect(fresh.state.reserves).toEqual([3, 3]);
    expect(fresh.history).toBeLessThan(60);
    // Script a last-second scoreline, then let the live sim issue its whistle.
    await page.evaluate(margin => {
      const s = window.__ff!.state;
      s.half = 2;
      s.clockTicks = 1;
      s.score = [Math.max(margin, 0), Math.max(-margin, 0)];
      s.stats[0].bigHits = 3;
      s.reserves[1] = 0;
    }, margin);
    await whistle(page);
    if (opponent === 1) {
      // Recreate the scene with the same launch and report a conflicting score.
      // The first result must still own exactly one advance.
      await page.evaluate(() => window.__ff!.launch());
      await page.waitForFunction(() => window.__ff?.state.phase === 'kickoff');
      await page.evaluate(() => {
        const s = window.__ff!.state;
        s.half = 2;
        s.clockTicks = 1;
        s.score = [0, 1];
      });
      await whistle(page);
    }
    if (margin < 0) await page.screenshot({ path: 'artifacts/cup-elimination.png' });
    if (opponent === 5) await page.screenshot({ path: 'artifacts/cup-champions.png' });
    await page.mouse.click(102, 314);
    await page.waitForTimeout(80);
    await page.mouse.click(558, 64);
    await page.waitForTimeout(80);
    if (opponent === 5) await page.keyboard.press('Enter');
    else await page.mouse.dblclick(514, 314);
  }
  await page.waitForFunction(() => !window.__ff);
  expect(errors).toEqual([]);
});

async function friendlyFulltime(page: Page) {
  await page.goto('/?match=1&mute=1');
  await page.waitForFunction(() => !!window.__ff);
  await page.evaluate(() => window.__ff!.launch({ mode: 'friendly', matchId: null, mute: true,
    config: { ...window.__ff!.state.config, seed: 77 } }));
  await page.waitForFunction(() => window.__ff?.state.config.seed === 77);
  await page.evaluate(() => {
    window.__ff!.state.half = 2;
    window.__ff!.state.clockTicks = 1;
  });
  await whistle(page);
}

// Synchronous dispatch keeps every down/up pair in the same Phaser frame.
async function pressInOneFrame(page: Page, keys: string[]) {
  await page.evaluate(keys => {
    const codes: Record<string, number> = { Enter: 13, ArrowUp: 38, Escape: 27 };
    for (const key of keys) {
      for (const type of ['keydown', 'keyup']) {
        window.dispatchEvent(new KeyboardEvent(type, { key, code: key, keyCode: codes[key], bubbles: true, cancelable: true }));
      }
    }
  }, keys);
}

test('same-frame setup presses launch once with the selected teams', async ({ page }) => {
  await friendlyFulltime(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__ff);
  await pressInOneFrame(page, ['Enter', 'ArrowUp', 'Enter']);
  await page.waitForFunction(() => !!window.__ff, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__ff!.state.config.ratings)).toEqual([TEAMS[0].ratings, TEAMS[1].ratings]);
});

test('same-frame replay return and rematch act on successive screens', async ({ page }) => {
  await friendlyFulltime(page);
  await page.evaluate(() => window.__ff!.startReplay(1));
  await pressInOneFrame(page, ['Escape', 'Enter']);
  await page.waitForFunction(() => window.__ff?.state.config.seed === 78, null, { timeout: 5000 });
});
