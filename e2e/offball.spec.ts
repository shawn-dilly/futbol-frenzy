import { test, expect } from '@playwright/test';
import { BUTTONS } from '../src/input/stick';
import { cameraTarget, SCREEN_W } from '../src/game/layout';

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

test('a kickoff shot stays in view while the shooter turbos the other way', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?match=1&level=rookie&half=60&seed=17&mute=1');
  await page.waitForFunction(() => window.__ff?.state.phase === 'play');
  await page.clock.pauseAt(new Date(Date.now() + 500));
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.press('k');
  await page.clock.runFor(32);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('Space');
  await page.clock.runFor(1536);

  const shot = await page.evaluate(() => {
    const game = window.__ff!;
    const s = game.state;
    const id = s.controlled[0];
    const separation = s.players[id].pos.x - s.ball.pos.x;
    return { shooter: id, separation, owner: s.ball.owner, manual: s.manualSelection[0],
      screenX: game.ballScreenX() };
  });
  expect(shot.manual).toBe(false);
  expect(shot.owner).toBeNull();
  expect(shot.separation).toBeGreaterThan(280);
  expect(shot.screenX).toBeGreaterThan(3);
  expect(shot.screenX).toBeLessThan(SCREEN_W - 3);
  await page.screenshot({ path: 'artifacts/kickoff-camera.png' });

  // Cycle NEXT back to the same shooter, now deliberately selected behind play.
  await page.keyboard.up('ArrowRight');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('k');
    await page.clock.runFor(48);
  }
  await page.clock.runFor(384);
  const manual = await page.evaluate(() => {
    const game = window.__ff!;
    const s = game.state;
    const id = s.controlled[0];
    const separation = s.players[id].pos.x - s.ball.pos.x;
    return { id, active: s.manualSelection[0], playerX: s.players[id].pos.x, ballX: s.ball.pos.x, playerScreenX: game.ballScreenX() + separation };
  });
  expect(manual.id).toBe(shot.shooter);
  expect(manual.active).toBe(true);
  expect(manual.playerX - cameraTarget(manual.ballX)).toBeGreaterThan(SCREEN_W);
  expect(manual.playerScreenX).toBeLessThan(300);
  expect(manual.playerScreenX).toBeGreaterThan(0);
});
