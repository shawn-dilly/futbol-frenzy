import { test, expect } from '@playwright/test';

test('a CPU-v-CPU match runs, players move, no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
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
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?seed=1&mute=1&half=20');
  await page.waitForFunction(() => (window as any).__ff?.state.phase === 'play', null, { timeout: 30_000 });
  const controlledX = () => page.evaluate(() => {
    const st = (window as any).__ff.state;
    return st.players[st.controlled[0]].pos.x as number;
  });
  const startX = await controlledX();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1500);
  const endX = await controlledX();
  await page.keyboard.up('ArrowRight');
  expect(endX - startX).toBeGreaterThan(60);

  const ownerBefore = await page.evaluate(() => (window as any).__ff.state.ball.owner);
  await page.keyboard.press('KeyJ');
  await page.waitForFunction(
    (before) => {
      const b = (window as any).__ff.state.ball;
      return b.passTarget !== null || b.owner !== before;
    },
    ownerBefore,
    { timeout: 3_000 },
  );
  await page.screenshot({ path: 'artifacts/m1-human.png' });
  expect(errors).toEqual([]);
});
