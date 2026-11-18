import { expect, test } from '@playwright/test';
import { BUTTONS } from '../src/input/stick';
import { FIELD_TOP, SCREEN_W, SCREEN_H } from '../src/game/layout';

test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });

test('the same phone button switches to the nearest outfielder and passes in possession', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?match=1&seed=17&mute=1');
  await page.waitForFunction(() => window.__ff?.state.phase === 'play');
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const target = await page.evaluate(() => {
    const s = window.__ff!.state;
    const candidate = s.players.find(p => p.team === 0 && p.role === 'out' && p.id !== s.controlled[0])!;
    s.ball.owner = null;
    // Keep the kickoff formation, moving only players within switching range.
    for (const p of s.players) {
      if (Math.hypot(p.pos.x - 240, p.pos.y - 66) < 40) p.pos.x += p.team ? 50 : -50;
    }
    s.ball.pos = { x: 240, y: 66 };
    s.ball.vel = { x: 0, y: 0 };
    candidate.pos = { x: 240, y: 86 };
    return candidate.id;
  });
  const box = (await page.locator('canvas').boundingBox())!;
  const tap = () => page.touchscreen.tap(box.x + box.width * BUTTONS.pass.x / SCREEN_W,
    box.y + box.height * BUTTONS.pass.y / SCREEN_H);
  await page.clock.runFor(32);
  await page.screenshot({ path: 'artifacts/touch-switch.png' });
  await tap();
  await page.clock.runFor(48);
  expect(await page.evaluate(() => window.__ff!.state.controlled[0])).toBe(target);
  await page.evaluate(id => {
    const s = window.__ff!.state;
    s.ball.owner = id;
    s.players[id].kickCooldown = 0;
  }, target);
  await page.clock.runFor(32);
  await page.screenshot({ path: 'artifacts/touch-pass.png' });
  await tap();
  await page.clock.runFor(32);
  expect(await page.evaluate(id => window.__ff!.state.players[id].status.kind, target)).toBe('kicking');
});

for (const hit of ['shoulder', 'big'] as const) {
  test(`a touch ${hit} shows contact, follow-through and victim reaction in live play`, async ({ page }) => {
    await page.clock.install();
    await page.goto('/?match=1&seed=17&mute=1');
    await page.waitForFunction(() => window.__ff?.state.phase === 'play');
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    const [attacker, victim] = await page.evaluate(() => {
      const s = window.__ff!.state;
      const a = s.players[s.controlled[0]];
      const v = s.players.find(p => p.team === 1 && p.role === 'out')!;
      s.ball.owner = null;
      s.ball.pos = { x: 280, y: 65 };
      a.pos = { x: 240, y: 65 };
      a.facing = { x: 1, y: 0 };
      a.status = { kind: 'free' };
      a.hitCooldown = 0;
      return [a.id, v.id];
    });
    const client = await page.context().newCDPSession(page);
    const box = (await page.locator('canvas').boundingBox())!;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{
      x: box.x + box.width * BUTTONS.hit.x / SCREEN_W, y: box.y + box.height * BUTTONS.hit.y / SCREEN_H,
    }] });
    await page.clock.runFor(hit === 'big' ? 592 : 32);
    expect(await page.evaluate(id => window.__ff!.state.players[id].status.kind, attacker)).toBe('charging');
    await page.screenshot({ path: `artifacts/${hit}-charge.png` });
    // Arrange immediate contact, the case where no pre-contact lunge frame can render.
    await page.evaluate(([a, v]) => {
      const s = window.__ff!.state;
      s.players[v].pos = { x: s.players[a].pos.x + 5, y: s.players[a].pos.y };
    }, [attacker, victim]);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.clock.runFor(32);
    const frame = (id: number) => page.evaluate(id => window.__ff!.renderedPlayers(id)[0].frame, id);
    expect(await frame(attacker)).toContain(`lunge_${hit}`);
    expect(await frame(victim)).toContain('hurt_');
    await page.screenshot({ path: `artifacts/${hit}-contact.png` });
    // Sample the recovery after the tier-specific impact freeze.
    for (let i = 0; i < 12 && (await frame(attacker)).includes('lunge'); i++) await page.clock.runFor(16);
    expect(await frame(attacker)).toContain(hit === 'shoulder' ? 'recover_shoulder' : 'getup');
    await page.screenshot({ path: `artifacts/${hit}-follow.png` });
    await page.clock.runFor(144);
    expect(await frame(victim)).toContain(hit === 'big' ? 'hurt_knockdown' : 'hurt_stumble');
    await page.screenshot({ path: `artifacts/${hit}-victim.png` });
  });
}

test('phone SWITCH skips a stumble and keeps control when all outfielders stumble', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?match=1&seed=17&mute=1');
  await page.waitForFunction(() => window.__ff?.state.phase === 'play');
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.evaluate(() => {
    const s = window.__ff!.state;
    s.controlled[0] = 4;
    s.ball.owner = null;
    s.ball.pos = { x: 240, y: 66 };
    s.ball.vel = { x: 0, y: 0 };
    for (const p of s.players) {
      p.kickCooldown = 120;
      p.pos = { x: p.team ? 400 : 90, y: 20 + p.id * 8 };
    }
    s.players[1].pos = { x: 240, y: 54 };
    s.players[1].status = { kind: 'hurt', tier: 'stumble', variant: 0 };
    s.players[1].statusTick = 0;
    s.players[1].statusTicks = 120;
    s.players[2].pos = { x: 240, y: 90 };
  });
  const box = (await page.locator('canvas').boundingBox())!;
  const point = (x: number, y: number) => ({ x: box.x + box.width * x / SCREEN_W, y: box.y + box.height * y / SCREEN_H });
  const tapPoint = point(BUTTONS.pass.x, BUTTONS.pass.y);
  const tapSwitch = async () => {
    await page.touchscreen.tap(tapPoint.x, tapPoint.y);
    await page.clock.runFor(48);
  };
  const read = () => page.evaluate(() => ({
    id: window.__ff!.state.controlled[0], y: window.__ff!.state.players[2].pos.y, marker: window.__ff!.markerY(0),
  }));
  await tapSwitch();
  const before = await read();
  expect(before.id).toBe(2);
  expect(before.marker).toBe(Math.round(before.y) + FIELD_TOP - 19);
  const client = await page.context().newCDPSession(page);
  const dragDown = async () => {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(50, 140)] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(50, 166)] });
    await page.clock.runFor(128);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await dragDown();
  const after = await read();
  expect(after.y).toBeGreaterThan(before.y);
  expect(after.marker).toBe(Math.round(after.y) + FIELD_TOP - 19);
  await page.screenshot({ path: 'artifacts/touch-actionable-switch.png' });
  await page.evaluate(() => {
    for (const p of window.__ff!.state.players.filter(p => p.team === 0 && p.role === 'out')) {
      p.status = { kind: 'hurt', tier: 'stumble', variant: 0 };
      p.statusTicks = 120;
      p.statusTick = 0;
    }
  });
  await tapSwitch();
  const fallback = await read();
  expect(fallback.id).toBe(2);
  await dragDown();
  expect((await read()).y).toBe(fallback.y);
});
