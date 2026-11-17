import { describe, expect, test } from 'vitest';
import { createMatch, neutralIntent } from '../../src/sim/setup';
import { planKeeper } from '../../src/sim/brainKeeper';
import { kick } from '../../src/sim/possession';
import { applyMovement } from '../../src/sim/movement';
import { LEVELS } from '../../src/sim/levels';
import { GK_HOLD_TICKS, GK_LINE_X, GK_SPEED } from '../../src/sim/constants';
import type { MatchState } from '../../src/sim/types';
import { matchConfig, runTicks } from '../helpers';

const PRO = LEVELS.pro;
const EXACT = { ...PRO, positioning: 1 };
/** Team 0's keeper (0) on his line; everyone else parked far upfield; the ball loose. */
function scene(): MatchState {
  const s = createMatch(matchConfig({ human: [false, false] }));
  runTicks(s, 60);
  for (const p of s.players) { p.pos = { x: 400, y: 10 + 10 * p.id }; p.vel = { x: 0, y: 0 }; }
  s.players[0].pos = { x: GK_LINE_X, y: 62 };
  s.ball.owner = null; s.ball.passTarget = null; s.ball.pos = { x: 112, y: 60 }; s.ball.vel = { x: 0, y: 0 };
  return s;
}
const shoot = (s: MatchState, x: number, y: number, vx: number, vy: number) => { s.ball.pos = { x, y }; s.ball.vel = { x: vx, y: vy }; };

describe('keeper saves', () => {
  test('goes to where a fast ball crosses his line (from either side), body kept inside the mouth', () => {
    const s = scene();
    shoot(s, 112, 60, -200, 20); // 0.5 s to the line at x = 12: y = 70
    expect(planKeeper(s, s.players[0], EXACT).target).toEqual({ x: GK_LINE_X, y: 70 });
    shoot(s, 112, 64, -200, -20);
    expect(planKeeper(s, s.players[0], EXACT).target).toEqual({ x: GK_LINE_X, y: 54 });
  });
  test('works for team 1 (line x = 468, ball moving +x)', () => {
    const s = scene(); s.players[5].pos = { x: 468, y: 62 };
    shoot(s, 368, 60, 200, 20);
    expect(planKeeper(s, s.players[5], EXACT).target).toEqual({ x: 468, y: 70 });
  });
  test('the target is clamped to the mouth less PLAYER_RADIUS at each post', () => {
    const s = scene();
    shoot(s, 112, 60, -200, 200); expect(planKeeper(s, s.players[0], EXACT).target).toEqual({ x: GK_LINE_X, y: 74 });
    shoot(s, 112, 60, -200, -200); expect(planKeeper(s, s.players[0], EXACT).target).toEqual({ x: GK_LINE_X, y: 50 });
  });
  test('a ball slower than PICKUP_MAX_BALL_SPEED / 2 toward goal, or moving away, is tracked by its y', () => {
    const s = scene();
    shoot(s, 112, 60, -85, 40); expect(planKeeper(s, s.players[0], PRO).target).toEqual({ x: GK_LINE_X, y: 60 });
    shoot(s, 112, 60, 200, 40); expect(planKeeper(s, s.players[0], PRO).target).toEqual({ x: GK_LINE_X, y: 60 });
    shoot(s, 112, 60, -86, 0); expect(planKeeper(s, s.players[0], PRO).target).toEqual({ x: GK_LINE_X, y: 60 });
  });
  test('prediction blends by positioning and ignores crossings in the past', () => {
    const s = scene(); shoot(s, 112, 60, -200, 20);
    expect(planKeeper(s, s.players[0], { ...PRO, positioning: 0 }).target!.y).toBe(60);
    expect(planKeeper(s, s.players[0], { ...PRO, positioning: 0.5 }).target!.y).toBe(65);
    expect(planKeeper(s, s.players[0], PRO).target!.y).toBeCloseTo(66);
    shoot(s, 10, 60, -200, 20); expect(planKeeper(s, s.players[0], EXACT).target!.y).toBe(60);
  });
  test('tracking is clamped to the goal mouth', () => {
    const s = scene(); s.ball.pos = { x: 300, y: 5 };
    expect(planKeeper(s, s.players[0], PRO).target).toEqual({ x: GK_LINE_X, y: 46 });
  });
});

describe('keeper claims a loose ball', () => {
  test('inside GK_CLAIM_DIST of his goal when he is the nearest player', () => {
    const s = scene(); s.ball.pos = { x: 25, y: 70 };
    expect(planKeeper(s, s.players[0], PRO).target).toEqual({ x: 25, y: 70 });
  });
  test('not when a teammate or an opponent is nearer', () => {
    const s = scene(); s.ball.pos = { x: 25, y: 70 };
    s.players[1].pos = { x: 30, y: 70 };
    expect(planKeeper(s, s.players[0], PRO).target).toEqual({ x: GK_LINE_X, y: 70 });
    s.players[1].pos = { x: 400, y: 20 }; s.players[6].pos = { x: 27, y: 70 };
    expect(planKeeper(s, s.players[0], PRO).target).toEqual({ x: GK_LINE_X, y: 70 });
  });
  test('claim boundary includes the goal distance and ignores downed players', () => {
    const s = scene(); s.ball.pos = { x: 30, y: 62 };
    s.players[1].pos = { x: 30, y: 62 }; s.players[1].status = { kind: 'hurt', tier: 'knockdown', variant: 0 };
    expect(planKeeper(s, s.players[0], PRO).target).toEqual(s.ball.pos);
    s.ball.pos.x += 0.01; expect(planKeeper(s, s.players[0], PRO).target!.x).toBe(GK_LINE_X);
  });
  test('not beyond GK_CLAIM_DIST', () => {
    const s = scene(); s.ball.pos = { x: 31, y: 62 };
    expect(planKeeper(s, s.players[0], PRO).target).toEqual({ x: GK_LINE_X, y: 62 });
  });
});

describe('keeper distribution', () => {
  function holding(): MatchState {
    const s = scene(); s.ball.owner = 0; s.ball.pos = { x: 19, y: 62 }; s.ball.ownerTicks = GK_HOLD_TICKS;
    s.players[1].pos = { x: 100, y: 30 }; s.players[2].pos = { x: 160, y: 100 }; s.players[3].pos = { x: 60, y: 62 }; s.players[4].pos = { x: 30, y: 100 };
    s.players[6].pos = { x: 110, y: 35 }; s.players[7].pos = { x: 70, y: 66 };
    s.players[8].pos = { x: 400, y: 100 }; s.players[9].pos = { x: 400, y: 20 }; s.players[5].pos = { x: 468, y: 62 };
    return s;
  }
  test('passes to the open teammate farthest from any opponent, not the nearest', () => {
    const s = holding();
    expect(planKeeper(s, s.players[0], PRO)).toMatchObject({ action: 'pass', aim: { x: 148, y: 38 } });
  });
  test('the planned keeper pass selects the intended recipient', () => {
    const s = holding(); const plan = planKeeper(s, s.players[0], PRO);
    kick(s, s.players[0], 'pass', plan.aim!); expect(s.ball.passTarget).toBe(2);
  });
  test('holds when every standing teammate lane is blocked', () => {
    const s = holding(); for (const id of [1, 2, 3, 4]) s.players[id].pos = { x: 100, y: 62 };
    s.players[6].pos = { x: 50, y: 62 };
    expect(planKeeper(s, s.players[0], PRO).action).toBe('none');
  });
  test('a teammate behind a blocked lane is skipped', () => {
    const s = holding(); s.players[8].pos = { x: 90, y: 81 }; // on the line (19,62) -> (160,100)
    const plan = planKeeper(s, s.players[0], PRO);
    expect(plan.aim).not.toEqual({ x: 148, y: 38 });
    expect(plan.action).toBe('pass');
  });
  test('holds until GK_HOLD_TICKS, then re-thinks on that tick', () => {
    const s = holding(); s.ball.ownerTicks = 10;
    expect(planKeeper(s, s.players[0], PRO)).toMatchObject({ target: s.players[0].pos, thinkAt: s.tick + GK_HOLD_TICKS - 10 });
    expect(planKeeper(s, s.players[0], PRO).action).toBeUndefined();
  });
  test('with no standing teammate the keeper holds', () => {
    const s = holding(); for (const id of [1, 2, 3, 4]) s.players[id].status = { kind: 'hurt', tier: 'knockdown', variant: 0 };
    expect(planKeeper(s, s.players[0], PRO)).toMatchObject({ action: 'none' });
  });
});

describe('keeperSpeedFactor', () => {
  test('scales the keeper run speed by his team level, exactly', () => {
    const s = createMatch(matchConfig({ human: [false, false], level: ['pro', 'rookie'] }));
    runTicks(s, 60);
    for (const id of [0, 5]) { s.players[id].status = { kind: 'free' }; s.players[id].health = 100; applyMovement(s, s.players[id], { ...neutralIntent(), moveY: 1 }); }
    expect(s.players[0].vel.y).toBeCloseTo(GK_SPEED * LEVELS.pro.keeperSpeedFactor, 9);
    expect(s.players[5].vel.y).toBeCloseTo(GK_SPEED * LEVELS.rookie.keeperSpeedFactor, 9);
    expect(s.players[5].vel.y).toBeCloseTo(56, 9);
  });
});
