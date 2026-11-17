import { describe, expect, test } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { brainIntent } from '../../src/sim/brain';
import { goalCenter } from '../../src/sim/setup';
import { ANCHOR_SHIFT_X, ANCHOR_SHIFT_Y, ARRIVE_DIST, CPU_SHOOT_RANGE, FIELD_MID_Y, JOCKEY_DIST } from '../../src/sim/constants';
import { add, norm, scale, sub } from '../../src/sim/vec';
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
  describe('chaser against a carried ball', () => {
    const setup = () => {
      const s = createMatch(cpu); runTicks(s, 60);
      s.ball.owner = 4; s.ball.pos = { x: 300, y: 40 }; // team 0 carries it; team 1 defends the goal at x = 480
      const chaser = s.players[7];
      for (const id of [6, 8, 9]) s.players[id].pos = { x: 470, y: 10 + 10 * id }; // park the other defenders so `chaser` is nearest
      const jockey = add(s.ball.pos, scale(norm(sub(goalCenter(1), s.ball.pos)), JOCKEY_DIST));
      return { s, chaser, jockey };
    };
    test('heads for the point JOCKEY_DIST from the ball toward its own goal', () => {
      const { s, chaser, jockey } = setup();
      chaser.pos = { x: 330, y: 70 };
      const i = brainIntent(s, chaser), d = norm(sub(jockey, chaser.pos));
      expect(i.moveX).toBeCloseTo(d.x, 9); expect(i.moveY).toBeCloseTo(d.y, 9);
    });
    test('stands still once within ARRIVE_DIST of the jockey point', () => {
      const { s, chaser, jockey } = setup();
      chaser.pos = { x: jockey.x + (ARRIVE_DIST - 0.5), y: jockey.y };
      const i = brainIntent(s, chaser); expect(i.moveX).toBe(0); expect(i.moveY).toBe(0);
    });
    test('still runs straight at a free ball', () => {
      const { s, chaser } = setup();
      s.ball.owner = null; chaser.pos = { x: 330, y: 70 };
      const i = brainIntent(s, chaser), d = norm(sub(s.ball.pos, chaser.pos));
      expect(i.moveX).toBeCloseTo(d.x, 9); expect(i.moveY).toBeCloseTo(d.y, 9);
    });
  });
  test('keeper releases the ball after holding it 30 ticks', () => {
    const s = createMatch(cpu); runTicks(s, 60);
    s.ball.owner = 5; s.ball.ownerTicks = 0; runTicks(s, 40);
    expect(s.ball.owner).not.toBe(5);
  });

  test('rule 3a: the pass receiver runs at a free ball', () => {
    const s = createMatch(cpu); runTicks(s, 60);
    s.ball.owner = null; s.ball.passTarget = 2; s.ball.pos = { x: 150, y: 90 };
    const i = brainIntent(s, s.players[2]), d = norm(sub(s.ball.pos, s.players[2].pos));
    expect(i.moveX).toBeCloseTo(d.x, 9); expect(i.moveY).toBeCloseTo(d.y, 9);
  });
  test('on a human team no brain teammate chases the ball', () => {
    const s = createMatch({ ...cpu, human: [false, true] }); runTicks(s, 60);
    s.ball.owner = 4; // team 0 owns it, so team 1 is the defending side
    s.ball.pos = { x: 300, y: 62 };
    for (const p of s.players.filter(q => q.team === 1 && q.role === 'out')) {
      const target = { x: p.anchor.x + (300 - 240) * ANCHOR_SHIFT_X, y: p.anchor.y };
      const i = brainIntent(s, p), d = norm(sub(target, p.pos));
      expect(i.moveX).toBeCloseTo(d.x, 9); expect(i.moveY).toBeCloseTo(d.y, 9);
    }
  });
  test('a team that owns the ball has no chaser', () => {
    const s = createMatch(cpu); runTicks(s, 60);
    s.players[0].pos = { x: 12, y: 20 }; // keeper owns the ball, so no outfield teammate is the carrier
    s.ball.owner = 0; s.ball.pos = { x: 12, y: 20 };
    for (const p of s.players.filter(q => q.team === 0 && q.role === 'out')) {
      const target = {
        x: p.anchor.x + (12 - 240) * ANCHOR_SHIFT_X, y: p.anchor.y + (20 - FIELD_MID_Y) * ANCHOR_SHIFT_Y,
      };
      const i = brainIntent(s, p), d = norm(sub(target, p.pos));
      expect(i.moveX).toBeCloseTo(d.x, 9); expect(i.moveY).toBeCloseTo(d.y, 9);
    }
  });
  test('rule 5: everyone else heads for the shifted anchor and stands still within 3 units', () => {
    const s = createMatch(cpu); runTicks(s, 60);
    s.ball.owner = 4; s.ball.pos = { x: 300, y: 20 };
    const p = s.players[2];
    const target = { x: p.anchor.x + (300 - 240) * ANCHOR_SHIFT_X, y: p.anchor.y + (20 - FIELD_MID_Y) * ANCHOR_SHIFT_Y };
    const d = norm(sub(target, p.pos)), i = brainIntent(s, p);
    expect(i.moveX).toBeCloseTo(d.x, 9); expect(i.moveY).toBeCloseTo(d.y, 9);
    p.pos = { x: target.x - (ARRIVE_DIST - 0.5), y: target.y };
    const j = brainIntent(s, p); expect(j.moveX).toBe(0); expect(j.moveY).toBe(0);
  });
  test('nextRandom is consumed only on a shot tick', () => {
    const s = createMatch(cpu); runTicks(s, 60);
    const goal = goalCenter(1), carrier = s.players[4];
    carrier.pos = { x: goal.x - (CPU_SHOOT_RANGE + 1), y: 62 };
    const rng = s.rng;
    expect(brainIntent(s, carrier).kick).toBeUndefined(); expect(s.rng).toBe(rng);
    carrier.pos = { x: goal.x - (CPU_SHOOT_RANGE - 1), y: 62 };
    const shot = brainIntent(s, carrier);
    expect(shot.kick).toBe('shot'); expect(shot.aim).toBeDefined(); expect(s.rng).not.toBe(rng);
  });
});
