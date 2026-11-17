import { describe, expect, test } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { laneIsOpen, planCarrier, planSupport, shotAim } from '../../src/sim/brainAttack';
import { LEVELS, type LevelSpec } from '../../src/sim/levels';
import { DRIBBLE_SWERVE_RAD, LANE_HALF_WIDTH, LANE_SHIFT } from '../../src/sim/constants';
import { norm, rotate, sub } from '../../src/sim/vec';
import type { MatchState, Vec } from '../../src/sim/types';
import { nextRandom } from '../../src/sim/rng';
import { kick } from '../../src/sim/possession';
import { matchConfig, runTicks } from '../helpers';

const lvl = (over: Partial<LevelSpec>): LevelSpec => ({ ...LEVELS.pro, ...over });
const EXACT = lvl({ shotErrorRad: 0, passMistakeChance: 0 });

/** Team 0 (attacks +x) carries as player 4; team 1 (keeper 5, outfield 6..9) is parked far upfield unless a test moves them. */
function scene(): MatchState {
  const s = createMatch(matchConfig({ human: [false, false] }));
  runTicks(s, 60);
  const at = (id: number, x: number, y: number) => { s.players[id].pos = { x, y }; s.players[id].vel = { x: 0, y: 0 }; };
  at(4, 300, 62); at(1, 100, 10); at(2, 100, 110); at(3, 100, 62);
  at(5, 468, 62); at(6, 450, 5); at(7, 450, 120); at(8, 460, 20); at(9, 460, 110);
  s.ball.owner = 4; s.ball.pos = { x: 307, y: 62 }; s.ball.passTarget = null; s.turbo = [1, 1];
  return s;
}
const at = (s: MatchState, id: number, x: number, y: number) => { s.players[id].pos = { x, y }; };
const heading = (plan: { target?: Vec }, from: Vec) => norm(sub(plan.target!, from));

describe('laneIsOpen', () => {
  const lane = (opp: Vec) => {
    const s = scene();
    for (const p of s.players) p.pos = { x: 1000, y: 1000 };
    s.players[6].pos = opp;
    return laneIsOpen(s, { x: 0, y: 0 }, { x: 100, y: 0 }, 0);
  };
  test('an opponent exactly LANE_HALF_WIDTH from the segment blocks it; just beyond does not', () => {
    expect(lane({ x: 50, y: LANE_HALF_WIDTH })).toBe(false);
    expect(lane({ x: 50, y: LANE_HALF_WIDTH + 0.01 })).toBe(true);
  });
  test('distance is to the segment, so an opponent past the end is measured to the end point', () => {
    expect(lane({ x: 100 + LANE_HALF_WIDTH, y: 0 })).toBe(false);
    expect(lane({ x: 100 + LANE_HALF_WIDTH + 0.01, y: 0 })).toBe(true);
    expect(lane({ x: -LANE_HALF_WIDTH, y: 0 })).toBe(false);
  });
  test('teammates and flattened opponents do not block', () => {
    const s = scene();
    for (const p of s.players) p.pos = { x: 1000, y: 1000 };
    s.players[2].pos = { x: 50, y: 0 };
    s.players[6].pos = { x: 50, y: 1 }; s.players[6].status = { kind: 'hurt', tier: 'knockdown', variant: 0 };
    expect(laneIsOpen(s, { x: 0, y: 0 }, { x: 100, y: 0 }, 0)).toBe(true);
    s.players[7].pos = { x: 50, y: 1 };
    expect(laneIsOpen(s, { x: 0, y: 0 }, { x: 100, y: 0 }, 0)).toBe(false);
  });
});

describe('the carrier shoots', () => {
  test('in range with an open lane it shoots at the post farther from the keeper (keeper low y -> aim high y)', () => {
    const s = scene(); at(s, 4, 400, 62); s.ball.pos = { x: 407, y: 62 }; at(s, 5, 468, 50);
    const plan = planCarrier(s, s.players[4], EXACT);
    expect(plan.action).toBe('shot');
    expect(plan.aim!.x).toBeCloseTo(73, 9); expect(plan.aim!.y).toBeCloseTo(13, 9); // post y = 62 + 16 - 3 = 75
  });
  test('keeper high y -> aim at the low post', () => {
    const s = scene(); at(s, 4, 400, 62); s.ball.pos = { x: 407, y: 62 }; at(s, 5, 468, 74);
    const aim = shotAim(s, s.players[4], EXACT);
    expect(aim.x).toBeCloseTo(73, 9); expect(aim.y).toBeCloseTo(-13, 9); // post y = 62 - 16 + 3 = 49
  });
  test('team 1 shoots toward x = 0', () => {
    const s = scene(); s.ball.owner = 9; at(s, 9, 80, 62); s.ball.pos = { x: 73, y: 62 }; at(s, 0, 12, 50); at(s, 1, 100, 10); at(s, 2, 100, 110); at(s, 3, 110, 62); at(s, 4, 110, 20);
    for (const id of [6, 7, 8]) at(s, id, 300, 10 + id * 10);
    const aim = shotAim(s, s.players[9], EXACT);
    expect(aim.x).toBeCloseTo(-73, 9); expect(aim.y).toBeCloseTo(13, 9);
  });
  test('the aim is rotated by (nextRandom x 2 - 1) x shotErrorRad, drawing exactly one number', () => {
    const s = scene(); at(s, 4, 400, 62); s.ball.pos = { x: 407, y: 62 }; at(s, 5, 468, 50);
    const spec = lvl({ shotErrorRad: 0.2 });
    const clone = structuredClone(s);
    const expected = rotate({ x: 73, y: 13 }, (nextRandom(clone) * 2 - 1) * spec.shotErrorRad);
    const aim = shotAim(s, s.players[4], spec);
    expect(aim.x).toBeCloseTo(expected.x, 12); expect(aim.y).toBeCloseTo(expected.y, 12);
    expect(s.rng).toBe(clone.rng);
  });
  test('outside shootRange, or with the lane blocked, it does not shoot and draws no number', () => {
    const s = scene(); const rng = s.rng;
    expect(planCarrier(s, s.players[4], EXACT).action).toBe('none');
    at(s, 4, 400, 62); s.ball.pos = { x: 407, y: 62 }; at(s, 5, 468, 50); at(s, 8, 440, 68); // on the line to the post
    expect(planCarrier(s, s.players[4], EXACT).action).toBe('none');
    expect(s.rng).toBe(rng);
  });
});

describe('the carrier passes under pressure', () => {
  // Opponent 6 at (312,75) is 17.7 from the carrier (pressureDist 20); it blocks the lane to player 2 only.
  function pressed(): MatchState {
    const s = scene(); at(s, 6, 312, 75); at(s, 1, 350, 30); at(s, 2, 330, 100); at(s, 3, 380, 90);
    return s;
  }
  test('to the most advanced open teammate', () => {
    const plan = planCarrier(pressed(), pressed().players[4], EXACT);
    expect(plan.action).toBe('pass');
    expect(plan.aim).toEqual({ x: 80, y: 28 }); // player 3 at (380,90) from the carrier (300,62)
  });
  test('the selected carrier pass reaches its planned recipient', () => {
    const s = pressed(); const plan = planCarrier(s, s.players[4], EXACT);
    kick(s, s.players[4], 'pass', plan.aim!); expect(s.ball.passTarget).toBe(3);
  });
  test('passMistakeChance 1 takes the second-best (player 1)', () => {
    const s = pressed();
    expect(planCarrier(s, s.players[4], lvl({ passMistakeChance: 1 })).aim).toEqual({ x: 50, y: -32 });
  });
  test('passMistakeChance 0 still takes the best; the roll is drawn only when there are two options', () => {
    const s = pressed(); const rng = s.rng;
    planCarrier(s, s.players[4], EXACT);
    expect(s.rng).not.toBe(rng);
    const one = pressed(); at(one, 3, 100, 62); const r1 = one.rng; // only player 1 left
    expect(planCarrier(one, one.players[4], lvl({ passMistakeChance: 1 })).aim).toEqual({ x: 50, y: -32 });
    expect(one.rng).toBe(r1);
  });
  test('ties for most advanced go to the lower id', () => {
    const s = pressed(); at(s, 1, 380, 34); at(s, 3, 380, 90); // both 100 from... (480,62): 28 either side
    expect(planCarrier(s, s.players[4], EXACT).aim).toEqual({ x: 80, y: -28 });
  });
  test('never into a blocked lane', () => {
    const s = scene(); at(s, 6, 315, 62); at(s, 1, 350, 62); at(s, 2, 335, 62); at(s, 3, 200, 100);
    expect(planCarrier(s, s.players[4], EXACT).action).toBe('none');
  });
  test('not to a teammate more than PASS_BACK_LIMIT farther from the goal than the carrier', () => {
    const s = scene(); at(s, 6, 312, 75); at(s, 1, 100, 10); at(s, 2, 100, 110);
    at(s, 3, 258, 62); // 222 from the goal vs 180: 42 back
    expect(planCarrier(s, s.players[4], EXACT).action).toBe('none');
    at(s, 3, 262, 62); // 218: 38 back
    expect(planCarrier(s, s.players[4], EXACT).aim).toEqual({ x: -38, y: 0 });
  });
  test('without pressure it dribbles even when a pass is on', () => {
    const s = scene(); at(s, 6, 325, 110); at(s, 3, 380, 90);
    expect(planCarrier(s, s.players[4], EXACT).action).toBe('none');
  });
});

describe('the carrier dribbles', () => {
  test('straight at goal with space, using turbo', () => {
    const s = scene(); const plan = planCarrier(s, s.players[4], EXACT);
    expect(plan.action).toBe('none'); expect(plan.turbo).toBe(true);
    const h = heading(plan, s.players[4].pos); expect(h.x).toBeCloseTo(1, 9); expect(h.y).toBeCloseTo(0, 9);
  });
  test('no turbo when the level does not use it', () => {
    const s = scene(); expect(planCarrier(s, s.players[4], lvl({ usesTurbo: false })).turbo).toBe(false);
  });
  test('no turbo with an opponent ahead within 30 units; free at 32', () => {
    const s = scene(); at(s, 6, 325, 62); // 25 ahead: outside pressureDist 20
    expect(planCarrier(s, s.players[4], EXACT).turbo).toBe(false);
    at(s, 6, 332, 62);
    expect(planCarrier(s, s.players[4], EXACT).turbo).toBe(true);
  });
  test('swerves DRIBBLE_SWERVE_RAD away from an opponent ahead on his +y side', () => {
    const s = scene(); at(s, 6, 325, 70); // 26 away, ahead (outside pressureDist 20)
    const h = heading(planCarrier(s, s.players[4], EXACT), s.players[4].pos);
    expect(h.x).toBeCloseTo(Math.cos(DRIBBLE_SWERVE_RAD), 9); expect(h.y).toBeCloseTo(-Math.sin(DRIBBLE_SWERVE_RAD), 9);
  });
  test('and the other way for an opponent on his -y side', () => {
    const s = scene(); at(s, 6, 325, 54);
    const h = heading(planCarrier(s, s.players[4], EXACT), s.players[4].pos);
    expect(h.y).toBeCloseTo(Math.sin(DRIBBLE_SWERVE_RAD), 9);
  });
  test('an opponent behind him or beyond pressureDist x 1.5 does not swerve him', () => {
    const s = scene(); at(s, 6, 290, 70);
    expect(heading(planCarrier(s, s.players[4], EXACT), s.players[4].pos).y).toBeCloseTo(0, 9);
    at(s, 6, 346, 70); // 46 away
    expect(heading(planCarrier(s, s.players[4], EXACT), s.players[4].pos).y).toBeCloseTo(0, 9);
  });
  test('team 1 dribbles toward x = 0 and swerves the mirrored way', () => {
    const s = scene(); s.ball.owner = 9; at(s, 9, 180, 62); s.ball.pos = { x: 173, y: 62 };
    for (const id of [1, 2, 3, 4]) at(s, id, 160, 70); // 21.5 ahead, on his +y side
    const h = heading(planCarrier(s, s.players[9], EXACT), s.players[9].pos);
    expect(h.x).toBeLessThan(-0.8); expect(h.y).toBeLessThan(0); // opponent on +y side: away is -y
  });
});

describe('support runs', () => {
  /** Ball (200,62) with player 4; supporters 1 (180,50), 2 (260,90), 3 (100,62); team 1 parked far right. */
  function building(): MatchState {
    const s = scene(); s.ball.pos = { x: 200, y: 62 }; at(s, 4, 193, 62);
    at(s, 1, 180, 50); at(s, 2, 260, 90); at(s, 3, 100, 62);
    return s;
  }
  const spec = (positioning: number) => lvl({ positioning });
  test('positioning 1: the two outfielders nearest the goal take the channels, the other is the safe man', () => {
    const s = building();
    expect(planSupport(s, s.players[1], spec(1)).target).toEqual({ x: 250, y: 28 }); // lower y of the two
    expect(planSupport(s, s.players[2], spec(1)).target).toEqual({ x: 250, y: 96 });
    expect(planSupport(s, s.players[3], spec(1)).target).toEqual({ x: 160, y: 62 });
  });
  test('positioning 0: the shifted formation anchor', () => {
    const s = building();
    const t = planSupport(s, s.players[1], spec(0)).target!; // anchor (100,62), ball x 200: x + (200 - 240) x 0.35
    expect(t.x).toBeCloseTo(86, 9); expect(t.y).toBeCloseTo(62, 9);
  });
  test('positioning 0.5 is halfway', () => {
    const s = building();
    const t = planSupport(s, s.players[1], spec(0.5)).target!;
    expect(t.x).toBeCloseTo((86 + 250) / 2, 9); expect(t.y).toBeCloseTo((62 + 28) / 2, 9);
  });
  test('the channel runners stop 30 units short of the goal line', () => {
    const s = building(); s.ball.pos = { x: 440, y: 62 };
    expect(planSupport(s, s.players[2], spec(1)).target).toEqual({ x: 450, y: 96 });
  });
  test('team 1 mirrors: toward x = 0', () => {
    const s = scene(); s.ball.owner = 9; s.ball.pos = { x: 280, y: 62 }; at(s, 9, 287, 62);
    at(s, 6, 300, 50); at(s, 7, 220, 90); at(s, 8, 380, 62);
    for (const id of [1, 2, 3, 4]) at(s, id, 20, 10 + 20 * id);
    expect(planSupport(s, s.players[6], spec(1)).target).toEqual({ x: 230, y: 28 });
    expect(planSupport(s, s.players[7], spec(1)).target).toEqual({ x: 230, y: 96 });
    expect(planSupport(s, s.players[8], spec(1)).target).toEqual({ x: 320, y: 62 });
    const anchor = s.players[6].anchor;
    expect(planSupport(s, s.players[6], spec(0)).target).toEqual({ x: anchor.x + 40 * 0.35, y: anchor.y });
  });
  test('a supporter whose lane from the ball is blocked slides LANE_SHIFT in y away from the blocker', () => {
    const s = building(); at(s, 6, 225, 45); // exactly on the line (200,62) -> (250,28)
    expect(planSupport(s, s.players[1], spec(1)).target).toEqual({ x: 250, y: 28 - LANE_SHIFT });
    expect(planSupport(s, s.players[2], spec(1)).target).toEqual({ x: 250, y: 96 }); // his lane is clear
  });
  test('when his team does not have the ball he holds the shifted anchor', () => {
    const s = building(); s.ball.owner = 6; s.ball.pos = { x: 300, y: 62 }; at(s, 6, 293, 62);
    expect(planSupport(s, s.players[1], spec(1)).target!.x).toBeCloseTo(100 + (300 - 240) * 0.35, 9);
    s.ball.owner = null; // a loose ball is the same
    expect(planSupport(s, s.players[1], spec(1)).target!.x).toBeCloseTo(100 + (300 - 240) * 0.35, 9);
  });
});
