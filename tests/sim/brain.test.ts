import { describe, expect, test } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { brainIntent } from '../../src/sim/brain';
import { norm, sub } from '../../src/sim/vec';
import { runTicks } from '../helpers';

const cpu = { seed: 7, halfSeconds: 120, human: [false, false] as [boolean, boolean] };

describe('placeholder brain', () => {
  test('keeper tracks the ball inside the goal mouth only', () => {
    const s = createMatch(cpu); s.ball.owner = null; s.ball.pos = { x: 300, y: 5 };
    const i = brainIntent(s, s.players[0]); expect(i.moveY).toBeLessThan(0);
    s.players[0].pos = { x: 12, y: 46 };
    const j = brainIntent(s, s.players[0]); expect(Math.hypot(j.moveX, j.moveY)).toBe(0);
  });
  test('carrier heads for goal and shoots inside CPU_SHOOT_RANGE', () => {
    const s = createMatch(cpu); runTicks(s, 60);
    expect(brainIntent(s, s.players[4]).moveX).toBeGreaterThan(0.9);
    s.players[4].pos = { x: 400, y: 62 };
    expect(brainIntent(s, s.players[4]).kick).toBe('shot');
  });
  test('exactly one defender chases a ball the other team owns', () => {
    const s = createMatch(cpu); runTicks(s, 60);
    const toward = s.players.filter(p => p.team === 1 && p.role === 'out').filter(p => {
      const i = brainIntent(s, p), d = norm(sub(s.ball.pos, p.pos));
      return i.moveX * d.x + i.moveY * d.y > 0.99;
    });
    expect(toward).toHaveLength(1);
  });
  test('keeper releases the ball after holding it 30 ticks', () => {
    const s = createMatch(cpu); runTicks(s, 60);
    s.ball.owner = 5; s.ball.ownerTicks = 0; runTicks(s, 40);
    expect(s.ball.owner).not.toBe(5);
  });
});
