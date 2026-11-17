import { describe, it, expect } from 'vitest';
import { createMatch, neutralPad, step, type MatchConfig, type Ratings } from '../../src/sim';
import { applyMovement } from '../../src/sim/movement';
import { neutralIntent } from '../../src/sim/setup';
import { kick } from '../../src/sim/possession';
import { resolveContacts } from '../../src/sim/attack';

const rating = (n: number): Ratings => ({ speed: n, power: n, skill: n, dirty: n });
const config = (): MatchConfig => ({ seed: 7, halfSeconds: 120, human: [true, false], level: ['pro', 'pro'] });
describe('team ratings', () => {
  it('defaults, clamps, replaces nonfinite values and copies inputs', () => {
    expect(createMatch(config()).config.ratings).toEqual([rating(0.5), rating(0.5)]);
    const supplied = { speed: -1, power: 2, skill: NaN, dirty: Infinity };
    const c = config(); c.ratings = [supplied, rating(1)];
    const s = createMatch(c); supplied.speed = 1; c.ratings[1].power = 0;
    expect(s.config.ratings).toEqual([{ speed: 0, power: 1, skill: 0.5, dirty: 0.5 }, rating(1)]);
  });
  for (const team of [0, 1] as const) for (const human of [true, false]) {
    it(`applies movement, kicks and late hits for team ${team}, human ${human}`, () => {
      const measure = (n: number) => {
        const c = config(); c.human[team] = human; c.ratings = team === 0 ? [rating(n), rating(1 - n)] : [rating(1 - n), rating(n)];
        const s = createMatch(c); const p = s.players[team * 5 + 1];
        applyMovement(s, p, { ...neutralIntent(), moveX: 1 }); const speed = p.vel.x;
        s.ball.owner = p.id; kick(s, p, 'shot', { x: 1, y: 0 }); const shot = s.ball.vel.x;
        s.ball.owner = null; p.status = { kind: 'lunging', hit: 'shoulder' }; p.pos = { x: 200, y: 60 };
        const victim = s.players[(1 - team) * 5 + 1]; victim.pos = { ...p.pos };
        resolveContacts(s); const hit = s.events.find(e => e.type === 'hit');
        return { speed, shot, damage: hit?.type === 'hit' ? hit.damage : 0 };
      };
      expect(measure(0)).toEqual({ speed: 54, shot: 198, damage: 7.2 });
      expect(measure(1)).toEqual({ speed: 66, shot: 242.00000000000003, damage: 14.3 });
    });
  }
  it('attributes power and late-hit dirty ratings to the tackler', () => {
    const damage = (power: number, dirty: number, onBall: boolean) => {
      const c = config(); c.ratings = [{ ...rating(0.5), power, dirty }, rating(1)];
      const s = createMatch(c), p = s.players[1], victim = s.players[6];
      p.status = { kind: 'lunging', hit: 'shoulder' }; p.pos = { x: 200, y: 60 }; victim.pos = { ...p.pos };
      s.ball.owner = onBall ? victim.id : null;
      resolveContacts(s);
      const hit = s.events.find(e => e.type === 'hit');
      return hit?.type === 'hit' ? hit.damage : 0;
    };
    expect(damage(1, 0.5, false)).toBeGreaterThan(damage(0, 0.5, false));
    expect(damage(0.5, 1, false)).toBeGreaterThan(damage(0.5, 0, false));
    expect(damage(0.5, 1, true)).toBe(damage(0.5, 0, true));
  });
  it('scales pass velocity using the passing team skill', () => {
    const speed = (skill: number) => {
      const c = config(); c.ratings = [{ ...rating(0.5), skill }, rating(1 - skill)];
      const s = createMatch(c), p = s.players[1]; s.ball.owner = p.id;
      kick(s, p, 'pass', { x: 1, y: 0 });
      return Math.hypot(s.ball.vel.x, s.ball.vel.y);
    };
    expect(speed(0)).toBeCloseTo(135); expect(speed(1)).toBeCloseTo(165);
  });
  it('remains deterministic with ratings', () => {
    const c = config(); c.ratings = [rating(0), rating(1)];
    const a = createMatch(c), b = createMatch(c);
    for (let i = 0; i < 200; i++) { step(a, [neutralPad(), neutralPad()]); step(b, [neutralPad(), neutralPad()]); }
    expect(a).toEqual(b);
  });
});
