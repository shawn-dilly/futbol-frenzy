import { test, expect, type Page } from '@playwright/test';

/** Collects uncaught page errors and console errors; assert the returned array is empty at the end of a test. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

test('a CPU-v-CPU match runs, players move, no errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?demo=1&seed=1&mute=1&half=20');
  await page.waitForFunction(() => (window as any).__ff?.state.tick >= 600, null, { timeout: 30_000 });
  const s = await page.evaluate(() => (window as any).__ff.state);
  expect(s.phase === 'play' || s.phase === 'goal' || s.phase === 'kickoff').toBe(true);
  const moved = s.players.filter((p: any) => Math.hypot(p.pos.x - p.anchor.x, p.pos.y - p.anchor.y) > 5).length;
  expect(moved).toBeGreaterThanOrEqual(4);
  await page.screenshot({ path: 'artifacts/m1-demo.png' });
  await page.waitForFunction(() => (window as any).__ff.state.phase === 'fulltime', null, { timeout: 90_000 });
  await page.screenshot({ path: 'artifacts/m1-fulltime.png' });
  expect(errors).toEqual([]);
});

test('a human can run with the arrow keys and pass with J, no errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&mute=1&half=20');
  await page.waitForFunction(() => (window as any).__ff?.state.phase === 'play', null, { timeout: 30_000 });
  const { id, startX, startTick } = await page.evaluate(() => {
    const st = (window as any).__ff.state;
    const id = st.controlled[0] as number;
    return { id, startX: st.players[id].pos.x as number, startTick: st.tick as number };
  });

  // 90 ticks = 1.5 s of sim time, counted in ticks so a slow machine cannot fall short.
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction((t) => (window as any).__ff.state.tick >= t + 90, startTick, { timeout: 10_000 });
  await page.keyboard.up('ArrowRight');
  const endX = await page.evaluate((i) => (window as any).__ff.state.players[i].pos.x as number, id);
  expect(endX - startX).toBeGreaterThan(60);

  const s = await page.evaluate(() => (window as any).__ff.state);
  expect(s.ball.owner).toBe(id); // the human's player has the ball, so J is a pass
  // The sim rebuilds state.events every tick and a defender can grab the ball within a tick or two of a pass,
  // so polling ball fields can miss it. Record kick events as they are pushed instead.
  await page.evaluate(() => {
    const st = (window as any).__ff.state;
    const kicks: any[] = ((window as any).__kicks = []);
    const record = (events: any[]) => {
      const push = events.push.bind(events);
      events.push = (...e: any[]) => { kicks.push(...e.filter(x => x.type === 'kick')); return push(...e); };
      return events;
    };
    let current = record(st.events);
    Object.defineProperty(st, 'events', { get: () => current, set: (v) => { current = record(v); }, configurable: true });
  });
  await page.keyboard.press('KeyJ');
  await page.waitForFunction(
    (passer) => (window as any).__kicks.some((k: any) => k.kind === 'pass' && k.player === passer),
    id,
    { timeout: 3_000 },
  );
  await page.screenshot({ path: 'artifacts/m1-human.png' });
  expect(errors).toEqual([]);
});
