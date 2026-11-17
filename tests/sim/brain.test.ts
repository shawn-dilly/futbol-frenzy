import { describe, expect, test, vi } from 'vitest';
import { blankMemory, createMatch, goalCenter, neutralPad, placeForKickoff } from '../../src/sim/setup';
import { hurtPlayer } from '../../src/sim/hurt';
import { brainIntent, type BrainIntent } from '../../src/sim/brain';
import { ARRIVE_DIST, BIG_HIT_CHARGE_TICKS, BRAIN_BIG_HOLD_EXTRA_TICKS, ANCHOR_SHIFT_X, ANCHOR_SHIFT_Y, FIELD_MID_Y, GK_HOLD_TICKS } from '../../src/sim/constants';
import { norm, sub } from '../../src/sim/vec';
import { LEVELS, LEVEL_ORDER } from '../../src/sim/levels';
import { step } from '../../src/sim/step';
import type { MatchState, PlayerState } from '../../src/sim/types';
import { runTicks, matchConfig } from '../helpers';

// Every intent the brain returns during a step is passed to `spy`, so a test can inspect the whole match.
let spy: ((i: BrainIntent) => void) | null = null;
vi.mock('../../src/sim/brain', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/sim/brain')>();
  return { ...real, brainIntent: (s: MatchState, p: PlayerState) => { const i = real.brainIntent(s, p); spy?.(i); return i; } };
});

const cpu = matchConfig({ seed: 7, human: [false, false] });
const PRO = LEVELS.pro;

/** A fresh computer match in play. */
const playing = (config = cpu): MatchState => { const s = createMatch(config); runTicks(s, 60); return s; };
/** The player's intent from a blank memory, so he thinks now. */
const rethink = (s: MatchState, id: number): BrainIntent => { s.brain[id] = blankMemory(); return brainIntent(s, s.players[id]); };
const towards = (i: BrainIntent, from: { x: number; y: number }, to: { x: number; y: number }) => {
  const d = norm(sub(to, from)); expect(i.moveX).toBeCloseTo(d.x, 9); expect(i.moveY).toBeCloseTo(d.y, 9);
};
/** Team 0's 4 carries at (300,62); team 1 (6..9) spread as in the role tests. */
function pressScene(config = cpu): MatchState {
  const s = playing(config);
  const at = (id: number, x: number, y: number) => { s.players[id].pos = { x, y }; };
  at(4, 300, 62); at(1, 350, 30); at(2, 200, 100); at(3, 420, 90);
  at(6, 330, 62); at(7, 340, 20); at(8, 400, 100); at(9, 450, 62);
  for (const q of s.players) q.vel = { x: 0, y: 0 };
  s.ball.owner = 4; s.ball.pos = { x: 307, y: 62 }; s.ball.passTarget = null; s.turbo = [1, 1];
  return s;
}

describe('the computer thinks', () => {
  test('keeper tracks the ball inside the goal mouth only', () => {
    const s = playing(); s.ball.owner = null; s.ball.pos = { x: 300, y: 5 };
    expect(rethink(s, 0).moveY).toBeLessThan(0);
    s.players[0].pos = { x: 12, y: 46 };
    const j = rethink(s, 0); expect(Math.hypot(j.moveX, j.moveY)).toBe(0);
  });
  test('the carrier heads for goal and shoots inside his level shootRange', () => {
    for (const level of LEVEL_ORDER) {
      const s = playing(matchConfig({ seed: 7, human: [false, false], level: [level, level] }));
      expect(rethink(s, 4).moveX).toBeGreaterThan(0.9);
      s.players[4].pos = { x: 480 - LEVELS[level].shootRange - 1, y: 62 };
      expect(rethink(s, 4).kick).toBeUndefined();
      s.players[4].pos = { x: 480 - LEVELS[level].shootRange + 1, y: 62 };
      expect(rethink(s, 4).kick).toBe('shot');
    }
  });
  test('the presser runs at the carrier', () => {
    const s = pressScene();
    towards(rethink(s, 6), s.players[6].pos, s.players[4].pos);
    expect(s.brain[6].role).toBe('presser');
  });
  test('a pass receiver runs at the ball', () => {
    const s = playing(); s.ball.owner = null; s.ball.passTarget = 2; s.ball.pos = { x: 150, y: 90 };
    towards(rethink(s, 2), s.players[2].pos, s.ball.pos);
    expect(s.brain[2].role).toBe('receiver');
  });
  test('the chaser runs at a free ball', () => {
    const s = pressScene(); s.ball.owner = null; s.ball.pos = { x: 335, y: 66 };
    towards(rethink(s, 6), s.players[6].pos, s.ball.pos);
    expect(s.brain[6].role).toBe('chaser');
  });
  test('a team that owns the ball has no chaser: everyone else holds the shifted anchor and stands still within 3 units', () => {
    const s = playing();
    s.players[0].pos = { x: 12, y: 20 }; s.ball.owner = 0; s.ball.pos = { x: 12, y: 20 };
    for (const p of s.players.filter(q => q.team === 0 && q.role === 'out')) {
      towards(rethink(s, p.id), p.pos, { x: p.anchor.x + (12 - 240) * ANCHOR_SHIFT_X, y: p.anchor.y + (20 - FIELD_MID_Y) * ANCHOR_SHIFT_Y });
      expect(s.brain[p.id].role).toBe('support');
    }
    const p = s.players[2], target = s.brain[2].target;
    p.pos = { x: target.x - (ARRIVE_DIST - 0.5), y: target.y };
    const i = brainIntent(s, p); expect(i.moveX).toBe(0); expect(i.moveY).toBe(0);
  });
  test('the keeper releases the ball after holding it GK_HOLD_TICKS', () => {
    const s = playing(); s.ball.owner = 5; s.ball.ownerTicks = 0;
    runTicks(s, GK_HOLD_TICKS - 2); expect(s.ball.owner).toBe(5);
    runTicks(s, 8); expect(s.ball.owner).not.toBe(5);
  });
  test('nextRandom is consumed only when a plan needs a number', () => {
    const s = playing(); const goal = goalCenter(1), carrier = s.players[4];
    carrier.pos = { x: goal.x - (PRO.shootRange + 1), y: 62 };
    const rng = s.rng;
    rethink(s, 4); expect(s.rng).toBe(rng);
    carrier.pos = { x: goal.x - (PRO.shootRange - 1), y: 62 };
    const shot = rethink(s, 4);
    expect(shot.kick).toBe('shot'); expect(shot.aim).toBeDefined(); expect(s.rng).not.toBe(rng);
  });
});

describe('think cadence', () => {
  test('a plan is replayed unchanged for reactionTicks - 1 ticks and replaced on the think tick', () => {
    const s = pressScene(); rethink(s, 6);
    const plan = structuredClone(s.brain[6]); const t0 = s.tick;
    expect(plan.thinkAt).toBe(t0 + PRO.reactionTicks);
    s.players[4].pos = { x: 300, y: 40 }; // the carrier moves away; the plan does not know
    for (let k = 1; k < PRO.reactionTicks; k++) {
      s.tick = t0 + k; brainIntent(s, s.players[6]);
      expect(s.brain[6]).toEqual(plan);
    }
    s.tick = t0 + PRO.reactionTicks; brainIntent(s, s.players[6]);
    expect(s.brain[6].target).toEqual({ x: 300, y: 40 });
    expect(s.brain[6].thinkAt).toBe(s.tick + PRO.reactionTicks);
  });
  test('each team thinks at the cadence of its own level', () => {
    const s = pressScene(matchConfig({ human: [false, false], level: ['rookie', 'psycho'] }));
    rethink(s, 6); rethink(s, 3);
    expect(s.brain[6].thinkAt - s.tick).toBe(LEVELS.psycho.reactionTicks);
    expect(s.brain[3].thinkAt - s.tick).toBe(LEVELS.rookie.reactionTicks);
  });
  test('the player gaining the ball forces a re-think', () => {
    const s = pressScene(); s.ball.owner = null; s.ball.pos = { x: 335, y: 66 }; rethink(s, 6);
    expect(s.brain[6].role).toBe('chaser');
    s.ball.owner = 6; s.tick += 1; brainIntent(s, s.players[6]);
    expect(s.brain[6].role).toBe('carrier');
  });
  test('the player losing the ball forces a re-think', () => {
    const s = pressScene(); s.ball.owner = 6; rethink(s, 6);
    expect(s.brain[6].role).toBe('carrier');
    s.ball.owner = 8; s.tick += 1; brainIntent(s, s.players[6]); // a teammate has it: the carrier is support now
    expect(s.brain[6].role).toBe('support');
    s.ball.owner = 4; s.tick += 1; brainIntent(s, s.players[6]); // the other team: still no stale plan
    expect(s.brain[6].role).toBe('presser');
  });
  test('the ball changing team forces a re-think, also from a loose ball', () => {
    const s = pressScene(); s.ball.owner = 8; rethink(s, 6);
    expect(s.brain[6].role).toBe('support');
    s.ball.owner = 4; s.tick += 1; brainIntent(s, s.players[6]);
    expect(s.brain[6].role).toBe('presser');
    s.ball.owner = null; s.ball.pos = { x: 335, y: 66 }; s.tick += 1; brainIntent(s, s.players[6]);
    expect(s.brain[6].role).toBe('chaser');
    s.ball.owner = 9; s.tick += 1; brainIntent(s, s.players[6]);
    expect(s.brain[6].role).toBe('support');
  });
  test('the ball passing between players of the same team does not force a re-think', () => {
    const s = pressScene(); rethink(s, 6);
    const plan = structuredClone(s.brain[6]);
    s.ball.owner = 1; s.tick += 1; brainIntent(s, s.players[6]);
    expect(s.brain[6]).toEqual(plan);
  });
  test('getting up after a knockdown starts from blank memory and thinks at once', () => {
    const s = playing(); const p = s.players[7];
    s.brain[7] = { ...s.brain[7], thinkAt: 500, action: 'chargeBig', holdHitUntil: s.tick + 40, turbo: true };
    hurtPlayer(s, p, 'knockdown', { x: 1, y: 0 }, 30);
    runTicks(s, 1);
    expect(s.brain[7]).toEqual(blankMemory());
  });
  test('a plan made before a flattening never fires: no stale kick, no stale hit', () => {
    const s = playing(); s.ball.owner = null; s.ball.pos = { x: 30, y: 10 };
    const p = s.players[7];
    setStatusCharging(p);
    s.brain[7].holdHitUntil = s.tick + 1000; s.brain[7].action = 'chargeBig';
    hurtPlayer(s, p, 'knockdown', { x: 1, y: 0 }, 30);
    runTicks(s, 200);
    expect(s.events.some(e => e.type === 'whiff' && e.player === 7)).toBe(false);
    expect(s.brain[7].holdHitUntil).toBeLessThan(s.tick + 1000);
  });
  test('a stored shot is dropped once the player no longer has the ball', () => {
    const s = playing(); s.ball.owner = 3; // team 0, not player 4
    s.brain[4] = { ...blankMemory(), thinkAt: s.tick + 50, thinkOwner: 3, role: 'support', action: 'shot', aim: { x: 1, y: 0 } };
    const i = brainIntent(s, s.players[4]);
    expect(i.kick).toBeUndefined(); expect(s.brain[4].action).toBe('none');
  });
  test('a stored shot is pressed once, then cleared', () => {
    const s = playing(); s.ball.owner = 4;
    s.brain[4] = { ...blankMemory(), thinkAt: s.tick + 50, thinkOwner: 4, role: 'carrier', action: 'shot', aim: { x: 1, y: 0 } };
    expect(brainIntent(s, s.players[4]).kick).toBe('shot');
    expect(brainIntent(s, s.players[4]).kick).toBeUndefined();
  });
  test('memory is blank after every kickoff, including the second half', () => {
    const s = createMatch(matchConfig({ seed: 3, human: [false, false], halfSeconds: 2 }));
    for (let t = 0; t < 400 && s.half === 1; t++) runTicks(s, 1);
    expect(s.half).toBe(2); expect(s.phase).toBe('kickoff');
    for (const m of s.brain) expect(m).toEqual(blankMemory());
    runTicks(s, 90);
    expect(s.brain.some(m => m.thinkAt > 0)).toBe(true);
    placeForKickoff(s, 0);
    for (const m of s.brain) expect(m).toEqual(blankMemory());
  });
});
function setStatusCharging(p: PlayerState): void { p.status = { kind: 'charging' }; p.statusTick = 10; p.statusTicks = 0; }

describe('hitting', () => {
  const pressed = (level: 'rookie' | 'pro' | 'bruiser' | 'psycho', dx: number) => {
    const s = pressScene(matchConfig({ human: [false, false], level: [level, level] }));
    s.players[6].pos = { x: 300 + dx, y: 62 };
    return { s, i: rethink(s, 6) };
  };
  test('a presser within hitRange taps HIT: down for one tick, up the next, and never again for that plan', () => {
    const { s } = pressed('pro', PRO.hitRange);
    const seen: string[] = [];
    s.brain[6] = blankMemory(); // press afresh and record four ticks
    for (let t = 0; t < 4; t++) {
      const i = brainIntent(s, s.players[6]); seen.push(`${i.hitPress ? 'P' : '-'}${i.hitHeld ? 'H' : '-'}`); s.tick += 1;
    }
    expect(seen).toEqual(['PH', '--', '--', '--']);
  });
  test('just outside hitRange he closes in without hitting; hitRange is his own team level', () => {
    const out = pressed('pro', PRO.hitRange + 1);
    expect(out.i.hitPress).toBe(false); towards(out.i, out.s.players[6].pos, out.s.players[4].pos);
    expect(pressed('rookie', LEVELS.rookie.hitRange + 1).i.hitPress).toBe(false);
    expect(pressed('rookie', LEVELS.rookie.hitRange).i.hitPress).toBe(true);
    expect(pressed('psycho', LEVELS.rookie.hitRange + 1).i.hitPress).toBe(true);
  });
  test('the launch tick steers along the planned heading', () => {
    const { s } = pressed('pro', PRO.hitRange); const heading = s.brain[6].aim;
    expect(Math.hypot(heading.x, heading.y)).toBeCloseTo(1, 9);
    s.tick += 1; const release = brainIntent(s, s.players[6]);
    expect(release.hitHeld).toBe(false); expect(release.moveX).toBeCloseTo(heading.x, 12); expect(release.moveY).toBeCloseTo(heading.y, 12);
  });
  test('a slide plan presses turbo with the tap', () => {
    const { i } = pressed('pro', PRO.hitRange);
    expect(i.turbo).toBe(true); expect(i.hitPress).toBe(true);
  });
  test('a big-hit charge holds HIT for BIG_HIT_CHARGE_TICKS + 2 ticks and then releases once, steering along the heading', () => {
    const { s, i } = pressed('bruiser', 9);
    const t0 = s.tick, hold = BIG_HIT_CHARGE_TICKS + BRAIN_BIG_HOLD_EXTRA_TICKS, heading = { ...s.brain[6].aim };
    expect(i.hitPress).toBe(true); expect(i.hitHeld).toBe(true);
    expect(s.brain[6].action).toBe('none'); expect(s.brain[6].holdHitUntil).toBe(t0 + hold);
    for (let k = 1; k < hold; k++) {
      s.tick = t0 + k; const held = brainIntent(s, s.players[6]);
      expect(held.hitHeld).toBe(true); expect(held.hitPress).toBe(false);
    }
    s.tick = t0 + hold; const release = brainIntent(s, s.players[6]);
    expect(release.hitHeld).toBe(false); expect(release.hitPress).toBe(false);
    expect(release.moveX).toBeCloseTo(heading.x, 12); expect(release.moveY).toBeCloseTo(heading.y, 12);
    expect(s.brain[6].holdHitUntil).toBe(0);
  });
  test('a charge whose target ran out of range is released at once, and one that got the ball ends', () => {
    const { s } = pressed('bruiser', 9);
    s.tick += 3; s.players[6].pos = { x: 300 + 9 + 2 * LEVELS.bruiser.hitRange + 1, y: 62 };
    expect(brainIntent(s, s.players[6]).hitHeld).toBe(false);
    expect(s.brain[6].holdHitUntil).toBe(0);
    const t = pressed('bruiser', 9); t.s.tick += 3; t.s.ball.owner = 6;
    expect(brainIntent(t.s, t.s.players[6]).hitHeld).toBe(false);
    expect(t.s.brain[6].holdHitUntil).toBe(0);
  });
  test('a human team brain teammates never press HIT', () => {
    const s = playing(matchConfig({ seed: 5, human: [true, false] }));
    const pressesByTeam0: boolean[] = [];
    for (let t = 0; t < 1500; t++) {
      if (t % 3 === 0) {
        const probe = structuredClone(s);
        for (const p of probe.players) if (p.team === 0 && p.role === 'out' && probe.controlled[0] !== p.id) {
          const i = brainIntent(probe, p); pressesByTeam0.push(i.hitPress || i.hitHeld);
        }
      }
      step(s, [neutralPad(), neutralPad()]);
    }
    expect(pressesByTeam0.length).toBeGreaterThan(1000);
    expect(pressesByTeam0.some(Boolean)).toBe(false);
  });
});

describe('robustness', () => {
  test('with every teammate down and the ball in a corner, every intent is finite and at most unit length', () => {
    const s = playing(); s.ball.owner = null; s.ball.pos = { x: 476, y: 120 }; s.ball.vel = { x: 0, y: 0 };
    for (const p of s.players) if (p.team === 1 && p.role === 'out') hurtPlayer(s, p, 'knockdown', { x: 1, y: 0 }, 30);
    for (const p of s.players) {
      const i = rethink(s, p.id);
      expect(Number.isFinite(i.moveX) && Number.isFinite(i.moveY)).toBe(true);
      expect(Math.hypot(i.moveX, i.moveY)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
  test('a player standing on the carrier gives a finite plan', () => {
    const s = pressScene(); s.players[6].pos = { ...s.players[4].pos };
    const i = rethink(s, 6);
    expect(Number.isFinite(i.moveX) && Number.isFinite(i.moveY)).toBe(true);
  });
  for (const level of LEVEL_ORDER) {
    test(`fuzz at ${level}: seeds 1-20, 3000 ticks of computer v computer, every intent finite and at most unit length`, () => {
      let bad: BrainIntent | null = null, count = 0;
      spy = i => {
        count += 1;
        const ok = Number.isFinite(i.moveX) && Number.isFinite(i.moveY) && Math.hypot(i.moveX, i.moveY) <= 1 + 1e-9
          && (i.aim === undefined || (Number.isFinite(i.aim.x) && Number.isFinite(i.aim.y)));
        if (!ok && !bad) bad = i;
      };
      try {
        for (let seed = 1; seed <= 20; seed++) {
          const s = createMatch(matchConfig({ seed, human: [false, false], level: [level, level] }));
          runTicks(s, 3000);
        }
      } finally { spy = null; }
      expect(bad).toBeNull(); expect(count).toBeGreaterThan(100000);
    });
  }
});
