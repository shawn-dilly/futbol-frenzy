import { test, expect } from '@playwright/test';
import { BUTTONS } from '../src/input/stick';

test.use({ hasTouch: true, viewport: { width: 640, height: 360 } });

test('NEXT and the floating stick reach a non-carrier behind live play', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?match=1&level=rookie&half=60&seed=17&mute=1');
  await page.waitForFunction(() => window.__ff?.state.phase === 'play');
  await page.clock.pauseAt(new Date(Date.now() + 500));
  const next = BUTTONS.shoot;
  const tap = () => page.touchscreen.tap(next.x * 2, next.y * 2);
  await tap(); // clear the ball upfield
  await page.clock.runFor(48);
  await tap(); // NEXT selects a player away from the ball
  await page.clock.runFor(48);
  const selected = await page.evaluate(() => window.__ff!.state.controlled[0]);
  const client = await page.context().newCDPSession(page);
  const stick = { x: 80, y: 280, id: 1 };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stick] });
  const capture = (i: number) => page.screenshot({ path: 'artifacts/late-hit/frame-' + String(i).padStart(2, '0') + '.png' });
  let landed = false;
  for (let attempt = 0; attempt < 140 && !landed; attempt++) {
    const aim = await page.evaluate(id => {
      const s = window.__ff!.state;
      const me = s.players[id];
      const opponents = s.players.filter(p => p.team === 1 && p.id !== s.ball.owner && p.status.kind !== 'hurt');
      const distance = (p: typeof me) => Math.hypot(p.pos.x - me.pos.x, p.pos.y - me.pos.y);
      const rival = opponents.sort((a, b) => distance(a) - distance(b))[0];
      return { dx: rival.pos.x - me.pos.x, dy: rival.pos.y - me.pos.y, d: distance(rival),
        available: !me.hitCooldown && me.status.kind === 'free' && s.controlled[0] === id && s.ball.owner !== id,
        behindBall: s.ball.pos.x - rival.pos.x };
    }, selected);
    const point = { id: 1, x: stick.x + 52 * aim.dx / (aim.d || 1), y: stick.y + 52 * aim.dy / (aim.d || 1) };
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    if (aim.available && aim.behindBall > 24 && aim.d < 14) {
      const hit = { x: BUTTONS.hit.x * 2, y: BUTTONS.hit.y * 2, id: 2 };
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point, hit] });
      for (let i = 0; i < 8; i++) {
        await page.clock.runFor(64);
        await capture(i);
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      for (let frame = 0; frame < 16; frame++) {
        await page.clock.runFor(16);
        landed = await page.evaluate(id => window.__ff!.state.events.some(e => e.type === 'hit' && e.tackler === id && e.late), selected);
        if (landed) break;
      }
      if (landed) {
        await capture(8);
        for (let i = 9; i <= 16; i++) {
          await page.clock.runFor(64);
          await capture(i);
        }
        await page.screenshot({ path: 'artifacts/behind-play.png' });
        break;
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stick] });
    }
    await page.clock.runFor(96);
  }
  expect(landed).toBe(true);
});
