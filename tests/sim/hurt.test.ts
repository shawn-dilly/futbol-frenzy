import { applyMovement } from '../../src/sim/movement';
import { test, expect } from 'vitest';
import { createMatch, neutralPad, placeForKickoff } from '../../src/sim/setup';
import { hurtPlayer, regenHealth, isDazed } from '../../src/sim/hurt';
import { setStatus } from '../../src/sim/status';
import { pickPassTarget, switchControl, updatePossession } from '../../src/sim/possession';
import { brainIntent } from '../../src/sim/brain';
import { assignRoles } from '../../src/sim/brainRoles';
import { nextRandom } from '../../src/sim/rng';
import { step } from '../../src/sim/step';
import {
  RUN_SPEED, DAZED_FUMBLE_CHANCE, FIELD_H, FUMBLE_COOLDOWN_TICKS, HALFTIME_HEAL, HURT, LOOSE_BALL_SPEED, PLAYER_RADIUS,
  HEALTH_REGEN_PER_TICK, MAX_HEALTH, RAGE_CONCEDE_GAIN, TURBO_SPEED,
} from '../../src/sim/constants';
import { norm, sub } from '../../src/sim/vec';
import type { MatchState, PadInput } from '../../src/sim/types';
import { runTicks, matchConfig } from '../helpers';

const cfg = matchConfig({ human: [true, false] });
const pad = (o: Partial<PadInput>): PadInput => ({ ...neutralPad(), ...o });
const fresh = () => createMatch(cfg);
const playing = (): MatchState => { const s = createMatch(cfg); runTicks(s, 60); expect(s.phase).toBe('play'); return s; };
const knockDown = (s: MatchState, id: number) => setStatus(s.players[id], { kind: 'hurt', tier: 'knockdown', variant: 0 }, 72);

test('hurtPlayer sets the hurt status with the tier length and a variant in range', () => {
  const s = playing();
  const variant = hurtPlayer(s, s.players[3], 'knockdown', { x: 1, y: 0 }, 20);
  expect(s.players[3].status).toEqual({ kind: 'hurt', tier: 'knockdown', variant });
  expect([s.players[3].statusTick, s.players[3].statusTicks]).toEqual([0, 72]);
  expect(variant).toBeGreaterThanOrEqual(0); expect(variant).toBeLessThan(HURT.knockdown.variants);
});
test('200 seeded hurts produce every variant of the tier', () => {
  const s = playing();
  const seen = new Set<number>();
  for (let i = 0; i < 200; i++) seen.add(hurtPlayer(s, s.players[3], 'overTheTop', { x: 1, y: 0 }, 50));
  expect([...seen].sort()).toEqual([0, 1, 2]);
});
test('knock is the unit direction times the tier knock speed', () => {
  const s = playing();
  hurtPlayer(s, s.players[3], 'knockdown', { x: 3, y: 4 }, 20);
  expect(s.players[3].knock.x).toBeCloseTo(42, 9); expect(s.players[3].knock.y).toBeCloseTo(56, 9);
});
test('the victim ends up facing the way they are thrown, and keeps facing when the direction is zero', () => {
  const s = playing();
  hurtPlayer(s, s.players[3], 'knockdown', { x: -3, y: 4 }, 20);
  expect(s.players[3].facing.x).toBeCloseTo(-0.6, 9); expect(s.players[3].facing.y).toBeCloseTo(0.8, 9);
  hurtPlayer(s, s.players[3], 'knockdown', { x: 0, y: 0 }, 20);
  expect(s.players[3].facing.x).toBeCloseTo(-0.6, 9); expect(s.players[3].facing.y).toBeCloseTo(0.8, 9);
});
test('health drops by the damage, never below 1', () => {
  const s = playing(); s.reserves = [0, 0];
  hurtPlayer(s, s.players[3], 'knockdown', { x: 1, y: 0 }, 20);
  expect(s.players[3].health).toBe(80);
  hurtPlayer(s, s.players[3], 'overTheTop', { x: 1, y: 0 }, 500);
  expect(s.players[3].health).toBe(1);
});
test('a victim carrying the ball drops it at loose-ball speed along the hit and cannot re-collect while down', () => {
  const s = playing();
  expect(s.ball.owner).toBe(4);
  hurtPlayer(s, s.players[4], 'wipeout', { x: 0, y: 2 }, 35);
  expect(s.ball.owner).toBeNull(); expect(s.ball.passTarget).toBeNull();
  expect(s.ball.vel).toEqual({ x: 0, y: LOOSE_BALL_SPEED });
  expect(s.players[4].kickCooldown).toBeGreaterThanOrEqual(HURT.wipeout.downTicks);
});
test('a flattened controlled player hands control to the nearest standing outfield teammate at once', () => {
  const s = fresh();
  s.controlled[0] = 4; s.ball.pos = { x: 160, y: 28 }; s.ball.owner = null;
  hurtPlayer(s, s.players[4], 'knockdown', { x: 1, y: 0 }, 20);
  expect(s.controlled[0]).toBe(2);
});
test('a stumbling controlled player keeps control', () => {
  const s = fresh();
  s.controlled[0] = 4; s.ball.pos = { x: 160, y: 28 }; s.ball.owner = null;
  hurtPlayer(s, s.players[4], 'stumble', { x: 1, y: 0 }, 10);
  expect(s.controlled[0]).toBe(4);
});
test('a computer team keeps its controlled id when a player goes down', () => {
  const s = fresh();
  const before = s.controlled[1];
  hurtPlayer(s, s.players[before], 'wipeout', { x: 1, y: 0 }, 35);
  expect(s.controlled[1]).toBe(before);
});

test('a player who cannot act ignores the pad: no move, no turbo, no kick', () => {
  const s = playing();
  s.controlled[0] = 4;
  setStatus(s.players[4], { kind: 'recovering', hit: 'shoulder', landed: false }, 30);
  const { x, y } = s.players[4].pos;
  runTicks(s, 1, [pad({ moveX: 1, turbo: true, shoot: true }), neutralPad()]);
  expect(s.players[4].pos).toEqual({ x, y });
  expect(s.players[4].turboTicks).toBe(0); expect(s.turbo[0]).toBeCloseTo(1, 9);
  expect(s.ball.owner).toBe(4);
});
test('knock moves the player each tick, then decays by 0.9', () => {
  const s = playing();
  const p = s.players[3]; setStatus(p, { kind: 'hurt', tier: 'stumble', variant: 0 }, 24);
  p.pos = { x: 160, y: 60 }; p.knock = { x: 0, y: 40 };
  runTicks(s, 1);
  expect(p.pos.x).toBeCloseTo(160, 9); expect(p.pos.y).toBeCloseTo(60 + 40 / 60, 9);
  expect(p.knock.y).toBeCloseTo(36, 9);
});
test('knock is added to a free player\'s own movement', () => {
  const s = playing();
  s.controlled[0] = 4; const x0 = s.players[4].pos.x;
  s.players[4].knock = { x: 120, y: 0 };
  runTicks(s, 1, [pad({ moveX: 1 }), neutralPad()]);
  expect(s.players[4].pos.x).toBeCloseTo(x0 + 60 / 60 + 120 / 60, 9);
});
test('knock below 1 unit per second is zeroed', () => {
  const s = playing(); s.players[3].knock = { x: 1.2, y: 0 };
  runTicks(s, 1);
  expect(s.players[3].knock.x).toBeCloseTo(1.08, 9);
  runTicks(s, 1);
  expect(s.players[3].knock).toEqual({ x: 0, y: 0 });
});
test('knock cannot push a player off the pitch', () => {
  const s = playing(); const p = s.players[3];
  p.pos = { x: 160, y: FIELD_H - PLAYER_RADIUS }; p.knock = { x: 0, y: 170 };
  runTicks(s, 1);
  expect(p.pos.y).toBe(FIELD_H - PLAYER_RADIUS);
});

test('a downed player cannot pick up a free ball; the next one in reach does', () => {
  const s = fresh();
  s.ball.owner = null; s.ball.pos = { x: 160, y: 96 }; s.ball.vel = { x: 0, y: 0 };
  s.players[8].pos = { x: 162, y: 96 };
  knockDown(s, 3);
  updatePossession(s);
  expect(s.ball.owner).toBe(8);
});
test('pickPassTarget skips downed teammates, and falls back when all are down', () => {
  const s = fresh();
  knockDown(s, 2);
  expect(pickPassTarget(s, s.players[4], { x: -1, y: -0.6 })).toBe(1);
  knockDown(s, 1);
  expect(pickPassTarget(s, s.players[4], { x: -1, y: -0.6 })).toBe(3);
  knockDown(s, 3); knockDown(s, 0);
  expect(pickPassTarget(s, s.players[4], { x: -1, y: -0.6 })).toBe(2);
});
test('switchControl skips downed players, and falls back when all are down', () => {
  const s = fresh();
  s.ball.pos = { x: 160, y: 28 };
  switchControl(s, 0); expect(s.controlled[0]).toBe(2);
  knockDown(s, 2); switchControl(s, 0); expect(s.controlled[0]).toBe(3);
  knockDown(s, 1); knockDown(s, 3); knockDown(s, 4);
  switchControl(s, 0); expect(s.controlled[0]).toBe(2);
});
test('the brain picks the nearest standing outfielder as presser', () => {
  const s = fresh(); // team 0 (the human) has the ball at kickoff: team 1 defends
  expect(assignRoles(s, 1)).toEqual(['keeper', 'cover', 'marker', 'marker', 'presser']);
  knockDown(s, 9);
  expect(assignRoles(s, 1)).toEqual(['keeper', 'cover', 'presser', 'marker', 'support']);
  const intent = brainIntent(s, s.players[7]);
  const d = norm(sub(s.players[s.ball.owner!].pos, s.players[7].pos));
  expect(intent.moveX).toBeCloseTo(d.x, 9); expect(intent.moveY).toBeCloseTo(d.y, 9);
});

test('isDazed is true below 35 health only', () => {
  const s = fresh(); const p = s.players[3];
  p.health = 34.99; expect(isDazed(p)).toBe(true);
  p.health = 35; expect(isDazed(p)).toBe(false);
});
test('a Dazed player runs at 0.8 of run speed and of turbo speed', () => {
  const s = playing(); s.controlled[0] = 4; s.players[4].health = 30;
  for (const q of s.players) if (q.team === 1) q.hitCooldown = Infinity; // keep the opponents from tackling the runner
  const x0 = s.players[4].pos.x;
  runTicks(s, 60, [pad({ moveX: 1 }), neutralPad()]);
  expect(s.players[4].pos.x - x0).toBeCloseTo(48, 9);
  runTicks(s, 1, [pad({ moveX: 1, turbo: true }), neutralPad()]);
  expect(s.players[4].vel.x).toBeCloseTo(TURBO_SPEED * 0.8, 9);
});

const seedStartingWith = (wantFumble: boolean): number => {
  for (let seed = 1; ; seed++) {
    if ((nextRandom({ rng: seed }) < DAZED_FUMBLE_CHANCE) === wantFumble) return seed;
  }
};
const passArriving = (rng: number, dazed: boolean, passTarget: number | null): MatchState => {
  const s = fresh();
  s.rng = rng; s.players[2].health = dazed ? 30 : 100;
  s.ball.owner = null; s.ball.passTarget = passTarget;
  s.ball.pos = { ...s.players[2].pos }; s.ball.vel = { x: 100, y: 0 };
  return s;
};
test('a Dazed pass target fumbles when the roll is under the chance: ball keeps moving, cooldown set', () => {
  const s = passArriving(seedStartingWith(true), true, 2);
  updatePossession(s);
  expect(s.ball.owner).toBeNull(); expect(s.ball.vel).toEqual({ x: 100, y: 0 });
  expect(s.players[2].kickCooldown).toBe(FUMBLE_COOLDOWN_TICKS);
});
test('a Dazed pass target traps the ball when the roll is at or over the chance', () => {
  const s = passArriving(seedStartingWith(false), true, 2);
  updatePossession(s);
  expect(s.ball.owner).toBe(2);
});
test('the fumble roll is drawn only for a Dazed pass target', () => {
  for (const [dazed, target] of [[false, 2], [true, null]] as const) {
    const s = passArriving(7, dazed, target);
    updatePossession(s);
    expect(s.rng).toBe(7); expect(s.ball.owner).toBe(2);
  }
});

test('a kickoff clears every status and knock', () => {
  const s = playing();
  hurtPlayer(s, s.players[3], 'overTheTop', { x: 1, y: 0 }, 50);
  placeForKickoff(s, 0);
  expect(s.players[3].status).toEqual({ kind: 'free' }); expect(s.players[3].knock).toEqual({ x: 0, y: 0 });
});

test('conceding a goal gives the conceding team rage', () => {
  const s = playing();
  s.players[5].pos = { x: 400, y: 10 };
  s.ball.owner = null; s.ball.passTarget = null; s.ball.pos = { x: 470, y: 62 }; s.ball.vel = { x: 200, y: 0 };
  for (let i = 0; i < 10 && s.phase === 'play'; i++) step(s, [neutralPad(), neutralPad()]);
  expect(s.score).toEqual([1, 0]);
  expect(s.rage).toEqual([0, RAGE_CONCEDE_GAIN]);
});
test('halftime heals everyone by 25 up to 100', () => {
  const s = playing();
  s.players[3].health = 50; s.players[6].health = 90; s.clockTicks = 1;
  runTicks(s, 1);
  expect(s.phase).toBe('halftime');
  expect(s.players[3].health).toBeCloseTo(50 + HALFTIME_HEAL, 1); // plus this tick's regen
  expect(s.players[6].health).toBe(100);
});

test('health regenerates 0.5 per second in play for everyone not hurt, capped at 100', () => {
  expect(HEALTH_REGEN_PER_TICK).toBe(0.5 / 60);
  const s = playing(); s.players[3].health = 50; s.players[6].health = 99.999; s.players[4].health = 50;
  for (const q of s.players) if (q.team === 1) q.hitCooldown = Infinity; // nobody tackles during the measurement
  setStatus(s.players[4], { kind: 'hurt', tier: 'stumble', variant: 0 }, 1000);
  s.players[4].knock = { x: 0, y: 0 };
  runTicks(s, 60);
  expect(s.players[3].health).toBeCloseTo(50.5, 6);
  expect(s.players[6].health).toBe(MAX_HEALTH);
  expect(s.players[4].health).toBe(50);
});
test('health does not regenerate during a pause', () => {
  const s = playing(); s.players[3].health = 50; s.phase = 'goal'; s.phaseTicks = 100;
  runTicks(s, 30);
  expect(s.players[3].health).toBe(50);
});
test('a Dazed player at 34.9 health stops being Dazed after regenerating past 35', () => {
  const s = playing(); s.players[3].health = 34.99;
  expect(isDazed(s.players[3])).toBe(true);
  runTicks(s, 2);
  expect(isDazed(s.players[3])).toBe(false);
});
test.each([
  ['lunging', { kind: 'lunging', hit: 'shoulder' }],
  ['recovering', { kind: 'recovering', hit: 'shoulder', landed: false }],
  ['hurt (stumble)', { kind: 'hurt', tier: 'stumble', variant: 0 }],
] as const)('a human whose controlled player is %s can PASS to switch to the nearest standing teammate', (_n, status) => {
  const s = playing(); s.ball.owner = null; s.ball.pos = { x: 150, y: 30 }; s.ball.vel = { x: 0, y: 0 };
  const me = s.players[2]; s.controlled[0] = 2; me.pos = { x: 150, y: 30 };
  setStatus(me, status, 50);
  runTicks(s, 1, [pad({ pass: true }), neutralPad()]);
  expect(s.controlled[0]).not.toBe(2);
  expect([1, 3, 4]).toContain(s.controlled[0]);
});

test.each([['rookie', 2], ['pro', 3], ['bruiser', 5], ['psycho', 7]] as const)(
  '%s CPU slows after %i equal shoulder hits and recovers its stride', (level, hits) => {
    const state = createMatch(matchConfig({ level: ['pro', level] }));
    const player = state.players[6];
    const intent = { ...neutralPad(), moveX: 1, moveY: 0, hitPress: false, hitHeld: false };
    for (let i = 1; i <= hits; i++) {
      hurtPlayer(state, player, 'stumble', { x: 1, y: 0 }, 10);
      setStatus(player, { kind: 'free' }, 0);
      applyMovement(state, player, intent);
      expect(player.vel.x).toBeCloseTo(RUN_SPEED * (i === hits ? 0.8 : 1));
    }
    for (let i = 0; i < 660; i++) regenHealth(state);
    applyMovement(state, player, intent);
    expect(player.vel.x).toBe(RUN_SPEED);
  });
