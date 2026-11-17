import { describe, expect, test } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { interceptPoint, planDefence, shiftedAnchor, smartSpot } from '../../src/sim/brainDefend';
import { LEVELS, type LevelSpec } from '../../src/sim/levels';
import { PURSUIT_LEAD_MAX_TICKS, TICK_HZ, TURBO_COST, RUN_SPEED } from '../../src/sim/constants';
import type { MatchState } from '../../src/sim/types';
import { matchConfig, runTicks } from '../helpers';

/** Team 0's player 4 carries at (300,62), ball at (307,62). Team 1 defends x = 480. */
function scene(overrides: Partial<ReturnType<typeof matchConfig>> = {}): MatchState {
  const s = createMatch(matchConfig({ human: [false, false], ...overrides }));
  runTicks(s, 60);
  const at = (id: number, x: number, y: number) => { s.players[id].pos = { x, y }; };
  at(4, 300, 62); at(1, 350, 30); at(2, 200, 100); at(3, 420, 90);
  at(6, 320, 62); at(7, 340, 20); at(8, 400, 100); at(9, 450, 62);
  for (const q of s.players) q.vel = { x: 0, y: 0 };
  s.ball.owner = 4; s.ball.pos = { x: 307, y: 62 }; s.ball.passTarget = null;
  s.turbo = [1, 1];
  return s;
}
const lvl = (over: Partial<LevelSpec>): LevelSpec => ({ ...LEVELS.pro, ...over });

describe('smartSpot', () => {
  test('blends linearly from the anchor (0) to the smart spot (1)', () => {
    const a = { x: 100, y: 20 }, b = { x: 140, y: 60 };
    expect(smartSpot(a, b, 0)).toEqual(a);
    expect(smartSpot(a, b, 0.5)).toEqual({ x: 120, y: 40 });
    expect(smartSpot(a, b, 1)).toEqual(b);
  });
  test('the result is clamped to the pitch', () => {
    expect(smartSpot({ x: 100, y: 20 }, { x: -50, y: 20 }, 1)).toEqual({ x: 4, y: 20 });
    expect(smartSpot({ x: 100, y: 20 }, { x: 100, y: 500 }, 1)).toEqual({ x: 100, y: 120 });
  });
});

describe('shiftedAnchor', () => {
  test('the formation anchor moved toward the ball', () => {
    const s = scene(); // player 7 anchors at (320, 28); ball (307, 62)
    expect(shiftedAnchor(s, s.players[7])).toEqual({ x: 320 + (307 - 240) * 0.35, y: 28 });
  });
});

describe('pursuit', () => {
  test('the presser aims ahead of a moving carrier by distance / RUN_SPEED of his travel', () => {
    const s = scene(); s.players[6].pos = { x: 330, y: 62 }; s.players[4].vel = { x: 0, y: 30 }; // 30 away: 0.5 s
    expect(planDefence(s, s.players[6], 'presser', LEVELS.pro)).toMatchObject({ target: { x: 300, y: 77 }, targetPlayer: 4 });
  });
  test('the lead is capped at PURSUIT_LEAD_MAX_TICKS of travel', () => {
    const s = scene(); s.players[6].pos = { x: 400, y: 62 }; s.players[4].vel = { x: 30, y: 0 }; // 100 away would be 1.67 s; capped at 0.75 s
    expect(interceptPoint(s.players[6], s.players[4])).toEqual({ x: 300 + 30 * PURSUIT_LEAD_MAX_TICKS / TICK_HZ, y: 62 });
  });
  test('the intercept point is kept on the pitch', () => {
    const s = scene(); s.players[4].pos = { x: 300, y: 120 }; s.players[4].vel = { x: 0, y: 60 }; s.players[6].pos = { x: 340, y: 100 };
    expect(interceptPoint(s.players[6], s.players[4])).toEqual({ x: 300, y: 120 });
  });
  test('a stationary carrier is aimed at where he stands', () => {
    const s = scene();
    expect(interceptPoint(s.players[6], s.players[4])).toEqual({ x: 300, y: 62 });
  });
});

describe('defending targets', () => {
  test('presser runs at the carrier, with turbo only when far and the level uses it', () => {
    const s = scene(); s.players[6].pos = { x: 400, y: 62 };
    expect(planDefence(s, s.players[6], 'presser', LEVELS.pro)).toMatchObject({ target: { x: 300, y: 62 }, action: 'none', turbo: true });
    expect(planDefence(s, s.players[6], 'presser', LEVELS.rookie)).toMatchObject({ target: { x: 300, y: 62 }, turbo: false });
    s.players[6].pos = { x: 340, y: 62 }; // exactly 40 away: not farther than 40
    expect(planDefence(s, s.players[6], 'presser', LEVELS.pro).turbo).toBe(false);
  });
  test('Rookie screens a human carrier between presses and closes inside shooting range', () => {
    const s = scene({ human: [true, false] });
    const press = () => planDefence(s, s.players[6], 'presser', LEVELS.rookie);
    s.liveTicks = 199;
    expect(press()).toMatchObject({ target: { x: 312, y: 62 }, targetPlayer: null });
    s.liveTicks++;
    expect(press().targetPlayer).toBe(4);
    s.liveTicks = 0;
    s.players[4].pos.x = 420;
    expect(press().targetPlayer).toBe(4);
  });
  test('cover stands JOCKEY_DIST x 2 from the ball on the line to his own goal', () => {
    const s = scene();
    expect(planDefence(s, s.players[8], 'cover', LEVELS.pro)).toMatchObject({ target: { x: 331, y: 62 }, action: 'none' });
  });
  test('cover next to his own goal is kept on the pitch', () => {
    const s = scene(); s.ball.pos = { x: 470, y: 62 };
    expect(planDefence(s, s.players[8], 'cover', LEVELS.pro).target).toEqual({ x: 476, y: 62 });
  });
  describe('marker at positioning 0, 0.5, 1', () => {
    // player 7 marks player 1 at (350, 30): the smart spot is 8 units from him toward the goal at (480, 62)
    const smart = { x: 357.76811903147814, y: 31.912152376979233 }, anchor = { x: 343.45, y: 28 };
    for (const [positioning, want] of [
      [0, anchor], [1, smart], [0.5, { x: (anchor.x + smart.x) / 2, y: (anchor.y + smart.y) / 2 }],
    ] as const) {
      test(`positioning ${positioning}`, () => {
        const s = scene();
        const t = planDefence(s, s.players[7], 'marker', lvl({ positioning, lateHitChance: 0 })).target!;
        expect(t.x).toBeCloseTo(want.x, 9); expect(t.y).toBeCloseTo(want.y, 9);
      });
    }
    test('a marker with nobody to mark holds the shifted anchor', () => {
      const s = scene(); // player 6 is the presser, so he marks nobody
      expect(planDefence(s, s.players[6], 'marker', LEVELS.pro).target).toEqual(shiftedAnchor(s, s.players[6]));
    });
  });
});

describe('hit choice', () => {
  const press = (s: MatchState, level: LevelSpec) => planDefence(s, s.players[6], 'presser', level);
  const near = (s: MatchState) => { s.players[6].pos = { x: 309, y: 62 }; }; // 9 from the carrier

  test('a level with big, the meter and a slow carrier charges a big hit and keeps turbo for the meter', () => {
    const s = scene(); near(s);
    expect(press(s, LEVELS.bruiser)).toMatchObject({ action: 'chargeBig', turbo: false, target: { x: 300, y: 62 } });
  });
  test('a keeper carrier counts as slow even when running', () => {
    const s = scene(); near(s); s.ball.owner = 0; s.players[0].pos = { x: 300, y: 62 }; s.players[0].vel = { x: RUN_SPEED, y: 0 };
    expect(press(s, LEVELS.bruiser).action).toBe('chargeBig');
  });
  test('a carrier moving at RUN_SPEED / 2 or faster is not charged at: slide with turbo, else shoulder', () => {
    const s = scene(); near(s); s.players[4].vel = { x: RUN_SPEED / 2, y: 0 };
    expect(press(s, LEVELS.bruiser)).toMatchObject({ action: 'tap', turbo: true });
    s.turbo[1] = TURBO_COST - 0.01;
    expect(press(s, LEVELS.bruiser)).toMatchObject({ action: 'tap', turbo: false });
  });
  test('no meter for big: slide if a burst is active, else shoulder', () => {
    const s = scene(); near(s); s.turbo[1] = 0;
    expect(press(s, LEVELS.bruiser)).toMatchObject({ action: 'tap', turbo: false });
    s.players[6].turboTicks = 40;
    expect(press(s, LEVELS.bruiser)).toMatchObject({ action: 'tap', turbo: true });
  });
  test('pro (no big): slide when turbo can be started, shoulder without it', () => {
    const s = scene(); near(s);
    expect(press(s, LEVELS.pro)).toMatchObject({ action: 'tap', turbo: true });
    s.turbo[1] = 0;
    expect(press(s, LEVELS.pro)).toMatchObject({ action: 'tap', turbo: false });
  });
  test('rookie only shoulders', () => {
    const s = scene(); s.players[6].pos = { x: 300 + LEVELS.rookie.hitRange, y: 62 };
    expect(press(s, LEVELS.rookie)).toMatchObject({ action: 'tap', turbo: false });
  });
  test('carrier tackles respect cooldown and reach, including on a human team', () => {
    const s = scene(); near(s); s.players[6].hitCooldown = 1;
    expect(press(s, LEVELS.pro).action).toBe('none');
    s.players[6].hitCooldown = 0; s.players[6].pos = { x: 300 + LEVELS.pro.hitRange + 0.5, y: 62 };
    expect(press(s, LEVELS.pro).action).toBe('none');
    s.players[6].pos = { x: 300 + LEVELS.pro.hitRange, y: 62 };
    expect(press(s, LEVELS.pro).action).toBe('tap');
    s.config.human = [false, true];
    expect(press(s, LEVELS.pro)).toMatchObject({ action: 'tap', turbo: false });
  });
  describe('lunge heading error', () => {
    const plan = (s: MatchState, level: LevelSpec) => planDefence(s, s.players[6], 'presser', level);
    test('is drawn once within +-hitAimErrorRad, varies, and names the target', () => {
      const s = scene(); s.players[6].pos = { x: 306, y: 66 };
      let widest = 0;
      for (let seed = 1; seed <= 300; seed++) {
        s.rng = seed;
        const p = plan(s, lvl({ hitAimErrorRad: 0.3 }));
        expect(Math.abs(p.aimError!)).toBeLessThanOrEqual(0.3); widest = Math.max(widest, Math.abs(p.aimError!));
        expect(p.targetPlayer).toBe(4);
      }
      expect(widest).toBeGreaterThan(0.25);
    });
    test('is exactly 0 when the level has none', () => {
      const s = scene(); s.players[6].pos = { x: 306, y: 66 };
      expect(Math.abs(plan(s, lvl({ hitAimErrorRad: 0 })).aimError!)).toBe(0);
    });
  });
  test('the cover also goes for the carrier when he is within hitRange', () => {
    const s = scene(); s.players[8].pos = { x: 300 + LEVELS.pro.hitRange, y: 62 };
    expect(planDefence(s, s.players[8], 'cover', LEVELS.pro)).toMatchObject({ action: 'tap', targetPlayer: 4, target: { x: 300, y: 62 } });
    s.players[8].pos = { x: 300 + LEVELS.pro.hitRange + 1, y: 62 };
    expect(planDefence(s, s.players[8], 'cover', LEVELS.pro).action).toBe('none');
  });
  test('a plan that does not hit draws no random number', () => {
    const s = scene(); const rng = s.rng;
    planDefence(s, s.players[6], 'presser', LEVELS.pro); // 20 away: out of range
    expect(s.rng).toBe(rng);
  });
});

describe('late hits', () => {
  /** Player 8 covers; opponent 1 (not the carrier) stands 6 away. */
  const late = (chance: number) => {
    const s = scene(); s.players[8].pos = { x: 356, y: 30 };
    return { s, plan: () => planDefence(s, s.players[8], 'cover', lvl({ lateHitChance: chance })) };
  };
  test('chance 0 never goes in, over 2000 thinks, and draws no random number', () => {
    const { s, plan } = late(0); const rng = s.rng;
    for (let i = 0; i < 2000; i++) expect(plan().action).toBe('none');
    expect(s.rng).toBe(rng);
  });
  test('chance 1 always goes for the opponent in range, aimed at him', () => {
    const { s, plan } = late(1);
    for (let i = 0; i < 2000; i++) expect(plan()).toMatchObject({ action: 'tap', target: { x: 350, y: 30 } });
  });
  test('chance 0.4 goes in about 40% of the time', () => {
    const { plan } = late(0.4); let n = 0;
    for (let i = 0; i < 2000; i++) if (plan().action !== 'none') n++;
    expect(n).toBeGreaterThan(700); expect(n).toBeLessThan(900);
  });
  test('never at the ball carrier, out of range, on cooldown, or for a human team', () => {
    const { s, plan } = late(1);
    s.players[1].pos = { x: 350, y: 30 }; s.players[8].pos = { x: 350 + LEVELS.pro.hitRange + 1, y: 30 };
    expect(plan().action).toBe('none');
    s.players[8].pos = { x: 356, y: 30 }; s.players[8].hitCooldown = 3;
    expect(plan().action).toBe('none');
    s.players[8].hitCooldown = 0; s.config.human = [false, true];
    expect(plan().action).toBe('none');
    s.config.human = [false, false]; s.ball.owner = 1; // he has the ball now: not a late hit (a cover would go for him as the carrier)
    expect(planDefence(s, s.players[8], 'marker', lvl({ lateHitChance: 1 })).action).toBe('none');
  });
});
