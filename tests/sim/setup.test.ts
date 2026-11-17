import { test, expect } from 'vitest';
import { createMatch, attackDir, goalCenter, placeForKickoff } from '../../src/sim/setup';
import { matchConfig } from '../helpers';

const cfg = matchConfig({ human: [true, false] });
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
  for (const p of s.players) { p.kickCooldown = 9; p.turboTicks = 40; p.hitCooldown = 7; p.knock = { x: 5, y: 5 }; p.health = 40; p.status = { kind: 'kicking' }; p.statusTick = 5; p.statusTicks = 12; }
  placeForKickoff(s, 0);
  for (const p of s.players) {
    expect([p.kickCooldown, p.turboTicks, p.status, p.statusTick, p.statusTicks, p.hitCooldown, p.knock]).toEqual([0, 0, { kind: 'free' }, 0, 0, 0, { x: 0, y: 0 }]);
    expect(p.health).toBe(40); // kickoff keeps health
  }
});
test('createMatch starts everyone free, at full health, and both teams with no rage', () => {
  const s = createMatch(cfg);
  for (const p of s.players) {
    expect([p.status, p.statusTick, p.statusTicks, p.health, p.hitCooldown, p.knock]).toEqual([{ kind: 'free' }, 0, 0, 100, 0, { x: 0, y: 0 }]);
  }
  expect([s.rage, s.lastHitTick]).toEqual([[0, 0], [0, 0]]);
});
