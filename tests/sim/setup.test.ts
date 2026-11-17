import { test, expect } from 'vitest';
import { createMatch, attackDir, goalCenter } from '../../src/sim/setup';

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
