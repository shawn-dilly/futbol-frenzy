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
  await page.goto('/?demo=1&seed=1&mute=1&half=20&level=psycho&level2=rookie');
  await page.waitForFunction(() => (window as any).__ff?.state.tick >= 900, null, { timeout: 30_000 });
  const s = await page.evaluate(() => (window as any).__ff.state);
  expect(s.config.level).toEqual(['rookie', 'psycho']);
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
  await page.goto('/?match=1&seed=1&mute=1&half=20&level=rookie');
  await page.waitForFunction(() => (window as any).__ff?.state.phase === 'play', null, { timeout: 30_000 });
  const { id, startX, startTick } = await page.evaluate(() => {
    const st = (window as any).__ff.state;
    const id = st.controlled[0] as number;
    return { id, startX: st.players[id].pos.x as number, startTick: st.tick as number };
  });

  // Run away from the computer's tacklers (left): they now take the ball from a carrier who runs at them.
  // 90 ticks = 1.5 s of sim time, counted in ticks so a slow machine cannot fall short.
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction((t) => (window as any).__ff.state.tick >= t + 90, startTick, { timeout: 10_000 });
  await page.keyboard.up('ArrowLeft');
  const endX = await page.evaluate((i) => (window as any).__ff.state.players[i].pos.x as number, id);
  expect(startX - endX).toBeGreaterThan(60);

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

/** Records every sim event of the given types as it is pushed (the sim rebuilds state.events each tick). */
async function recordEvents(page: Page, types: string[]): Promise<void> {
  await page.evaluate((wanted) => {
    const st = (window as any).__ff.state;
    const log: any[] = ((window as any).__events = []);
    const record = (events: any[]) => {
      const push = events.push.bind(events);
      events.push = (...e: any[]) => { log.push(...e.filter(x => wanted.includes(x.type))); return push(...e); };
      return events;
    };
    let current = record(st.events);
    Object.defineProperty(st, 'events', { get: () => current, set: (v) => { current = record(v); }, configurable: true });
  }, types);
}

/** The first recorded event matching the test, or undefined. */
function findEvent(page: Page, test: string): Promise<any> {
  return page.evaluate((body) => (window as any).__events.find(new Function('e', `return ${body}`) as any), test);
}

/** Wait until the controlled player is not the ball carrier (a carrier cannot hit), passing away if it is. */
async function dropTheBall(page: Page): Promise<void> {
  const carrying = () => page.evaluate(() => { const st = (window as any).__ff.state; return st.ball.owner === st.controlled[0]; });
  for (let i = 0; i < 20 && await carrying(); i++) {
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(250);
  }
}

test('a human hit tap lands a recorded hit', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?match=1&seed=3&mute=1&half=60');
  await page.waitForFunction(() => (window as any).__ff?.state.phase === 'play', null, { timeout: 30_000 });
  await recordEvents(page, ['hit', 'whiff']);
  await dropTheBall(page);

  const held = new Set<string>();
  const press = async (keys: string[]) => {
    for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  // Steer the controlled player at the nearest opponent and tap L when close; the CPU also tackles, so re-read every step.
  const deadline = Date.now() + 60_000;
  let hit: any;
  const tacklers = new Set<number>(); // the players controlled when L was tapped: the hit must be one of theirs, not the computer's
  while (!hit && Date.now() < deadline) {
    const aim = await page.evaluate(() => {
      const st = (window as any).__ff.state;
      const me = st.players[st.controlled[0]];
      let best: any;
      for (const p of st.players) {
        if (p.team === me.team) continue;
        const d = Math.hypot(p.pos.x - me.pos.x, p.pos.y - me.pos.y);
        if (!best || d < best.d) best = { d, dx: p.pos.x - me.pos.x, dy: p.pos.y - me.pos.y };
      }
      return { ...best, carrying: st.ball.owner === me.id, phase: st.phase };
    });
    if (aim.carrying) { await page.keyboard.press('KeyJ'); continue; }
    const keys: string[] = [];
    if (aim.dx > 4) keys.push('ArrowRight'); else if (aim.dx < -4) keys.push('ArrowLeft');
    if (aim.dy > 4) keys.push('ArrowDown'); else if (aim.dy < -4) keys.push('ArrowUp');
    await press(keys);
    if (aim.d < 12) {
      tacklers.add(await page.evaluate(() => (window as any).__ff.state.controlled[0] as number));
      await page.keyboard.press('KeyL');
    }
    await page.waitForTimeout(40);
    if (tacklers.size > 0) hit = await findEvent(page, `e.type === 'hit' && [${[...tacklers]}].includes(e.tackler)`);
  }
  await press([]);
  expect(hit, 'a hit event was recorded').toBeTruthy();
  expect(['stumble', 'knockdown', 'wipeout', 'overTheTop']).toContain(hit.tier);
  expect(hit.damage).toBeGreaterThan(0);
  expect([...tacklers]).toContain(hit.tackler);
  // The victim is hurt in the same tick the event is pushed; he stays hurt (the shortest spell is 24 ticks) while this is read.
  expect(await page.evaluate((v) => (window as any).__ff.state.players[v].status.kind as string, hit.victim)).toBe('hurt');
  // Knockdown or worse puts a callout on screen (the banner stays up at least 60 ticks).
  if (hit.tier !== 'stumble') expect(await page.evaluate(() => (window as any).__ff.calloutText() as string)).not.toBe('');
  await page.screenshot({ path: 'artifacts/m2-hit.png' });
  expect(errors).toEqual([]);
});

test('holding L for 40 ticks and releasing makes a big hit or a big whiff', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?match=1&seed=3&mute=1&half=60');
  await page.waitForFunction(() => (window as any).__ff?.state.phase === 'play', null, { timeout: 30_000 });
  await recordEvents(page, ['hit', 'whiff']);
  // The CPU can flatten the human mid-hold, so try a few times; each try ends with a big hit or a big whiff, or is retried.
  let big: any;
  for (let attempt = 0; attempt < 6 && !big; attempt++) {
    await dropTheBall(page);
    const startTick = await page.evaluate(() => (window as any).__ff.state.tick as number);
    await page.keyboard.down('KeyL');
    await page.waitForFunction((t) => (window as any).__ff.state.tick >= t + 40, startTick, { timeout: 10_000 });
    await page.keyboard.up('KeyL');
    await page.waitForTimeout(500);
    big = await findEvent(page, "e.hit === 'big'");
  }
  expect(big, 'a big hit or whiff was recorded').toBeTruthy();
  expect(['hit', 'whiff']).toContain(big.type);
  expect(errors).toEqual([]);
});
