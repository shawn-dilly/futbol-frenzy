import { test, expect } from 'vitest';
import { createMatch, attackDir, goalCenter, placeForKickoff } from '../../src/sim/setup';

const cfg = { seed: 1, halfSeconds: 120, human: [true, false] as [boolean, boolean] };
test('ten players, mirrored, in their own halves', () => {
  const s = createMatch(cfg);
  expect(s.players).toHaveLength(10);
  s.players.forEach((p, i) => expect(p.id).toBe(i));
  expect(s.players[0].role).toBe('gk'); expect(s.players[5].role).toBe('gk');
  expect(s.players[5].anchor).toEqual({ x: 468, y: 62 });
  expect(s.players[7].anchor).toEqual({ x: 320, y: 28 });
});
test('kickoff: team 0 striker owns the ball at the centre spot', () => {
  const s = createMatch(cfg);
  expect(s.ball.pos).toEqual({ x: 240, y: 62 });
  expect(s.ball.owner).toBe(4); expect(s.controlled[0]).toBe(4);
  expect(s.players[4].pos).toEqual({ x: 234, y: 62 });
  expect(s.phase).toBe('kickoff'); expect(s.clockTicks).toBe(7200);
});
test('attackDir and goalCenter', () => {
  expect(attackDir(0)).toBe(1); expect(attackDir(1)).toBe(-1);
  expect(goalCenter(1)).toEqual({ x: 480, y: 62 });
});
test('placeForKickoff for team 1: player 9 kicks, team 0 controls its nearest outfielder', () => {
  const s = createMatch(cfg);
  placeForKickoff(s, 1);
  expect(s.players[9].pos).toEqual({ x: 246, y: 62 });
  expect(s.ball.owner).toBe(9);
  expect(s.controlled[1]).toBe(9);
  expect(s.controlled[0]).toBe(4);
});
test('default kickoff: team 1 controls player 9', () => {
  expect(createMatch(cfg).controlled[1]).toBe(9);
});
test('goalCenter(0) is the left goal mouth', () => {
  expect(goalCenter(0)).toEqual({ x: 0, y: 62 });
});
test('createMatch leaves exactly one kickoff whistle event', () => {
  expect(createMatch(cfg).events).toEqual([{ type: 'whistle', what: 'kickoff' }]);
});
test('placeForKickoff clears stale per-player state', () => {
  const s = createMatch(cfg);
  for (const p of s.players) { p.kickCooldown = 9; p.turboTicks = 40; p.anim = 'kick'; p.animTick = 5; }
  placeForKickoff(s, 0);
  for (const p of s.players) {
    expect([p.kickCooldown, p.turboTicks, p.anim, p.animTick]).toEqual([0, 0, 'idle', 0]);
  }
});
