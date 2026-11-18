import { expect, test, type Page } from '@playwright/test';
import { TEAMS } from '../src/content/teams';
import { FULLTIME_RESTART_DELAY_TICKS } from '../src/game/layout';
import type { MatchLaunch } from '../src/game/launch';

declare global {
  interface Window { launches: MatchLaunch[] }
}

// init clones the supplied launch exactly once per match scene entry. Capture the
// entire sequence: checking only the final seed hides identical queued restarts.
async function observeEntries(page: Page) {
  await page.addInitScript(() => {
    window.launches = [];
    const clone = window.structuredClone;
    window.structuredClone = (value, options) => {
      const copy = clone(value, options);
      if (copy && typeof copy === 'object' && 'config' in copy && 'matchId' in copy && 'mode' in copy && 'mute' in copy) window.launches.push(copy as MatchLaunch);
      return copy;
    };
  });
}

async function burst(page: Page, commands: string[]) {
  await page.evaluate(commands => {
    for (const key of commands) {
      if (key === 'click') {
        const canvas = document.querySelector('canvas')!;
        const rect = canvas.getBoundingClientRect();
        const coords = { clientX: rect.left + rect.width * 0.7, clientY: rect.top + rect.height * 0.87, bubbles: true };
        for (const type of ['mousedown', 'mouseup']) canvas.dispatchEvent(new MouseEvent(type, coords));
      } else {
        for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { key, code: key, bubbles: true }));
      }
    }
  }, commands);
}

async function openFriendly(page: Page) {
  await page.goto('/?match=1&seed=17&mute=1');
  await page.waitForFunction(() => !!window.__ff);
  await page.evaluate(() => window.__ff!.launch({ mode: 'friendly', matchId: null, mute: true, config: window.__ff!.state.config }));
  await page.waitForFunction(() => window.launches.length === 1);
}

async function reachFulltime(page: Page) {
  await page.evaluate(() => {
    window.__ff!.state.half = 2;
    window.__ff!.state.clockTicks = 1;
  });
  await page.waitForFunction(() => window.__ff?.state.phase === 'fulltime');
}

async function returnToShell(page: Page) {
  await reachFulltime(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__ff);
}

test('friendly kickoff keeps the first matchup through a same-frame burst and accepts a new entry', async ({ page }) => {
  await observeEntries(page);
  await openFriendly(page);
  for (let entry = 1; entry <= 2; entry++) {
    await returnToShell(page);
    await burst(page, ['Enter', 'ArrowUp', 'Enter', 'Enter', 'ArrowDown', 'Enter', 'ArrowUp', 'Enter']);
    await page.waitForFunction(() => !!window.__ff);
    const entries = await page.evaluate(() => window.launches.slice(1));
    expect(entries).toHaveLength(entry);
    expect(entries.at(-1)).toMatchObject({ teamNames: [TEAMS[0].name, TEAMS[1].name],
      config: { seed: 17, halfSeconds: 120, level: ['pro', 'pro'], ratings: [TEAMS[0].ratings, TEAMS[1].ratings] } });
  }
});

test('Cup pointer kickoff and keyboard activation start one run', async ({ page }) => {
  await observeEntries(page);
  await openFriendly(page);
  for (const run of [1, 2]) {
    await returnToShell(page);
    await burst(page, run === 1 ? ['ArrowDown', 'Enter'] : ['ArrowDown', 'Enter', 'ArrowUp']);
    // Register the setup zones before the burst. In run 1 focus is still on
    // the team selector, so only the pointer can initiate kickoff.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await burst(page, run === 1 ? ['click', 'Enter'] : ['Enter', 'click']);
    await page.waitForFunction(() => !!window.__ff);
    const cups = await page.evaluate(() => window.launches.slice(1));
    expect(cups).toHaveLength(run);
    expect(cups.at(-1)).toMatchObject({
      mode: 'cup', matchId: `5:run-${run}:1`, teamNames: [TEAMS[0].name, TEAMS[1].name],
      config: { seed: 17, halfSeconds: 120, level: ['pro', 'pro'] },
    });
  }
});

for (const route of ['demo', 'match']) {
  test(route + ' accepts one fulltime restart per entry', async ({ page }) => {
    await observeEntries(page);
    await page.goto('/?' + route + '=1&seed=17&mute=1');
    await page.waitForFunction(() => !!window.__ff);
    for (const seed of [18, 19]) {
      await reachFulltime(page);
      await page.evaluate(delay => { window.__ff!.state.tick += delay; }, FULLTIME_RESTART_DELAY_TICKS);
      await burst(page, ['Enter', 'Enter', 'click']);
      await page.waitForFunction(s => window.__ff?.state.config.seed === s, seed);
      expect(await page.evaluate(() => window.launches.map(l => l.config.seed))).toEqual(seed === 18 ? [18] : [18, 19]);
    }
  });
}

test('phone setup defaults to Pulse and exposes the Bandage choice', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await observeEntries(page);
  await openFriendly(page);
  for (const style of ['pulse', 'bandage']) {
    await returnToShell(page);
    await page.keyboard.press('Enter');
    // Let Phaser register the newly drawn setup zones before tapping.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const pulse = page.getByRole('button', { name: 'Injury indicator: Pulse', exact: true });
    await expect(pulse).toBeVisible();
    if (style === 'bandage') {
      await pulse.dispatchEvent('click'); // Assistive activation can arrive without a pointer press.
      const bandage = page.getByRole('button', { name: 'Injury indicator: Bandage' });
      await expect(bandage).toBeFocused();
      await bandage.press('Space');
      await expect(pulse).toBeFocused();
      await page.mouse.click(260, 314);
      await page.keyboard.press('ArrowDown'); // Back
      await page.keyboard.press('ArrowDown'); // Kick Off
    } else {
      await page.keyboard.press('ArrowUp'); // wrap from team selection to Kick Off
    }
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !!window.__ff);
    await expect(page.getByRole('button', { name: /Injury indicator/, includeHidden: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.launches.at(-1)?.injuryStyle)).toBe(style);
  }
});
