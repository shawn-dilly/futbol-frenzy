import { describe, expect, test } from 'vitest';
import { createMatch, neutralPad, neutralIntent } from '../../src/sim/setup';
import { resolveContacts, updateAttack } from '../../src/sim/attack';
import { setStatus, tickStatus } from '../../src/sim/status';
import { applyMovement } from '../../src/sim/movement';
import { hurtPlayer } from '../../src/sim/hurt';
import { step } from '../../src/sim/step';
import {
  BIG_HIT_CHARGE_TICKS, BIG_HIT_MAX_HOLD_TICKS, CHARGE_MOVE_FACTOR, HIT_COOLDOWN_TICKS, RUN_SPEED, HIT_LANDED_RECOVER_TICKS, HITS, LATE_HIT_COOLDOWN_TICKS,
  TICK_HZ, TURBO_COST, TURBO_REFILL_PER_TICK,
} from '../../src/sim/constants';
import { LEVELS, LEVEL_ORDER } from '../../src/sim/levels';
import type { Level, MatchState, PadInput, PlayerState, SimEvent } from '../../src/sim/types';
import { runTicks, matchConfig } from '../helpers';

const pad = (o: Partial<PadInput>): PadInput => ({ ...neutralPad(), ...o });
const HIT_DOWN: [PadInput, PadInput] = [pad({ hit: true }), neutralPad()];
const HIT_UP: [PadInput, PadInput] = [neutralPad(), neutralPad()];
const TACKLER = 3, VICTIM = 6, MATE = 2;

/** Both teams human, so the controlled players (3 and 6) obey neutral pads and stand still. The ball is parked far away. */
function playing(): MatchState {
  const s = createMatch(matchConfig({ human: [true, true] }));
  runTicks(s, 60);
  expect(s.phase).toBe('play');
  s.controlled = [TACKLER, VICTIM];
  s.ball.owner = null; s.ball.passTarget = null; s.ball.pos = { x: 30, y: 10 }; s.ball.vel = { x: 0, y: 0 };
  s.players[TACKLER].pos = { x: 100, y: 52 }; s.players[TACKLER].facing = { x: 1, y: 0 };
  s.players[VICTIM].pos = { x: 300, y: 52 }; // out of reach unless a test moves him
  return s;
}
/** Holds HIT for `heldTicks` steps (the first is the press), then lets go for one step. */
function hold(s: MatchState, heldTicks: number): void {
  runTicks(s, heldTicks, HIT_DOWN); runTicks(s, 1, HIT_UP);
}
const hits = (s: MatchState) => s.events.filter((e): e is Extract<SimEvent, { type: 'hit' }> => e.type === 'hit');
const status = (s: MatchState, id = TACKLER) => s.players[id].status;
const placeVictimAhead = (s: MatchState, gap: number) => { s.players[VICTIM].pos = { x: s.players[TACKLER].pos.x + gap, y: s.players[TACKLER].pos.y }; };

describe('charging and launching', () => {
  test('pressing HIT starts an open-ended charge', () => {
    const s = playing(); runTicks(s, 1, HIT_DOWN);
    expect(status(s)).toEqual({ kind: 'charging' }); expect(s.players[TACKLER].statusTicks).toBe(0);
  });
  test('a tap is a shoulder lunge: 8 ticks at 110 units/s along the facing, then it ends', () => {
    const s = playing(); const x0 = s.players[TACKLER].pos.x;
    runTicks(s, 1, HIT_DOWN); runTicks(s, 1, HIT_UP);
    expect(status(s)).toEqual({ kind: 'lunging', hit: 'shoulder' });
    expect(s.players[TACKLER].statusTicks).toBe(HITS.shoulder.lungeTicks);
    runTicks(s, HITS.shoulder.lungeTicks - 1);
    expect(s.players[TACKLER].pos.x - x0).toBeCloseTo(8 * 110 / TICK_HZ, 9);
    expect(s.events).toContainEqual({ type: 'whiff', player: TACKLER, hit: 'shoulder' });
    expect(status(s)).toEqual({ kind: 'recovering', hit: 'shoulder', landed: false });
  });
  test('the lunge direction is fixed at launch, not steerable', () => {
    const s = playing(); runTicks(s, 1, HIT_DOWN); runTicks(s, 1, HIT_UP);
    runTicks(s, 6, [pad({ moveY: 1 }), neutralPad()]);
    expect(s.players[TACKLER].pos.y).toBe(52); expect(s.players[TACKLER].facing).toEqual({ x: 1, y: 0 });
  });
  test('a zero facing lunges along the team attack direction', () => {
    const s = playing(); s.players[TACKLER].facing = { x: 0, y: 0 };
    runTicks(s, 1, HIT_DOWN); runTicks(s, 1, HIT_UP);
    expect(s.players[TACKLER].facing).toEqual({ x: 1, y: 0 });
  });
  test('a tap during a turbo burst is a slide', () => {
    const s = playing(); s.players[TACKLER].turboTicks = 50;
    hold(s, 1);
    expect(status(s)).toEqual({ kind: 'lunging', hit: 'slide' });
    expect(s.players[TACKLER].statusTicks).toBe(HITS.slide.lungeTicks);
  });
  test('holding 30 ticks with a full meter is a big hit and spends a third of the meter', () => {
    const s = playing(); expect(s.turbo[0]).toBe(1);
    hold(s, BIG_HIT_CHARGE_TICKS);
    expect(status(s)).toEqual({ kind: 'lunging', hit: 'big' });
    expect(s.turbo[0]).toBeCloseTo(1 - TURBO_COST + TURBO_REFILL_PER_TICK, 9);
  });
  test('holding 29 ticks is still a shoulder, and the meter is untouched', () => {
    const s = playing(); hold(s, BIG_HIT_CHARGE_TICKS - 1);
    expect(status(s)).toEqual({ kind: 'lunging', hit: 'shoulder' }); expect(s.turbo[0]).toBe(1);
  });
  test('holding 30 ticks with an empty meter is a shoulder', () => {
    const s = playing(); s.turbo[0] = 0; hold(s, BIG_HIT_CHARGE_TICKS);
    expect(status(s)).toEqual({ kind: 'lunging', hit: 'shoulder' });
  });
  test('holding 90 ticks launches by itself while the button is still down', () => {
    const s = playing();
    runTicks(s, BIG_HIT_MAX_HOLD_TICKS, HIT_DOWN); expect(status(s)).toEqual({ kind: 'charging' });
    runTicks(s, 1, HIT_DOWN); expect(status(s)).toEqual({ kind: 'lunging', hit: 'big' });
  });
  test('a charging player moves at half speed', () => {
    const s = playing(); const x0 = s.players[TACKLER].pos.x;
    runTicks(s, 1, HIT_DOWN); runTicks(s, 6, [pad({ hit: true, moveX: 1 }), neutralPad()]);
    expect(s.players[TACKLER].pos.x - x0).toBeCloseTo(6 * RUN_SPEED * CHARGE_MOVE_FACTOR / TICK_HZ, 9);
  });
  test('the ball carrier cannot charge', () => {
    const s = playing(); s.ball.owner = TACKLER; s.ball.pos = { ...s.players[TACKLER].pos };
    runTicks(s, 1, HIT_DOWN); expect(status(s)).toEqual({ kind: 'free' });
  });
  test('gaining the ball while charging cancels the charge', () => {
    const s = playing(); runTicks(s, 1, HIT_DOWN);
    s.ball.pos = { ...s.players[TACKLER].pos };
    runTicks(s, 1, HIT_DOWN); expect(s.ball.owner).toBe(TACKLER);
    runTicks(s, 1, HIT_DOWN); expect(status(s)).toEqual({ kind: 'free' });
  });
  test('being hurt while charging cancels the charge', () => {
    const s = playing(); runTicks(s, 1, HIT_DOWN);
    hurtPlayer(s, s.players[TACKLER], 'knockdown', { x: -1, y: 0 }, 20);
    expect(status(s).kind).toBe('hurt');
    runTicks(s, 5, HIT_DOWN); expect(status(s).kind).toBe('hurt');
  });
  test('no charge starts while the cooldown runs', () => {
    const s = playing(); s.players[TACKLER].hitCooldown = 2;
    runTicks(s, 1, HIT_DOWN); expect(status(s)).toEqual({ kind: 'free' });
  });
  test('a charge is cancelled when control moves to another player', () => {
    const s = playing(); runTicks(s, 1, HIT_DOWN); expect(status(s)).toEqual({ kind: 'charging' });
    s.controlled[0] = MATE;
    runTicks(s, 1, HIT_UP);
    expect(status(s)).toEqual({ kind: 'free' }); expect(s.events.some(e => e.type === 'whiff')).toBe(false);
    runTicks(s, 12); expect(status(s)).toEqual({ kind: 'free' });
  });
  test('a brain-driven player of a human team never starts a charge', () => {
    const s = playing(); const p = s.players[MATE];
    updateAttack(s, p, { ...neutralIntent(), hitPress: true, hitHeld: true });
    expect(p.status).toEqual({ kind: 'free' });
  });
});

describe('one hit path for the computer', () => {
  const PRESS = { ...neutralIntent(), hitPress: true, hitHeld: true }, HELD = { ...neutralIntent(), hitHeld: true }, RELEASE = neutralIntent();
  const cpuPlaying = (): MatchState => {
    const s = createMatch(matchConfig({ human: [true, false] })); runTicks(s, 60);
    s.ball.owner = null; s.ball.pos = { x: 30, y: 10 };
    return s;
  };
  test('a computer player holding HIT for 30 ticks with a full meter launches big and pays TURBO_COST', () => {
    const s = cpuPlaying(); const p = s.players[7]; s.turbo[1] = 1;
    updateAttack(s, p, PRESS); expect(p.status).toEqual({ kind: 'charging' });
    for (let i = 0; i < BIG_HIT_CHARGE_TICKS; i++) { tickStatus(p); updateAttack(s, p, HELD); }
    expect(p.status).toEqual({ kind: 'charging' });
    tickStatus(p); updateAttack(s, p, RELEASE);
    expect(p.status).toEqual({ kind: 'lunging', hit: 'big' }); expect(s.turbo[1]).toBeCloseTo(1 - TURBO_COST, 9);
  });
  test('with an empty meter the same hold launches a shoulder', () => {
    const s = cpuPlaying(); const p = s.players[7]; s.turbo[1] = 0;
    updateAttack(s, p, PRESS);
    for (let i = 0; i < BIG_HIT_CHARGE_TICKS; i++) { tickStatus(p); updateAttack(s, p, HELD); }
    tickStatus(p); updateAttack(s, p, RELEASE);
    expect(p.status).toEqual({ kind: 'lunging', hit: 'shoulder' }); expect(s.turbo[1]).toBe(0);
  });
  test('a computer tap during a turbo burst is a slide', () => {
    const s = cpuPlaying(); const p = s.players[7]; p.turboTicks = 50;
    updateAttack(s, p, PRESS); tickStatus(p); updateAttack(s, p, RELEASE);
    expect(p.status).toEqual({ kind: 'lunging', hit: 'slide' });
  });
  test('a computer charge survives while he is the brain, and is cancelled when he gains the ball', () => {
    const s = cpuPlaying(); const p = s.players[7];
    updateAttack(s, p, PRESS); tickStatus(p); updateAttack(s, p, HELD);
    expect(p.status).toEqual({ kind: 'charging' });
    s.ball.owner = 7; tickStatus(p); updateAttack(s, p, HELD);
    expect(p.status).toEqual({ kind: 'free' });
  });
});

describe('Review Focus 4: a held HIT never launches by accident', () => {
  const noAttack = (s: MatchState) => s.players.filter(p => p.team === 0).every(p => p.status.kind !== 'charging' && p.status.kind !== 'lunging');
  test('held through a stumble (control stays with the stumbling player)', () => {
    const s = playing(); runTicks(s, 1, HIT_DOWN);
    hurtPlayer(s, s.players[TACKLER], 'stumble', { x: -1, y: 0 }, 10);
    expect(s.controlled[0]).toBe(TACKLER);
    for (let t = 0; t < 60; t++) { runTicks(s, 1, HIT_DOWN); expect(noAttack(s), `tick ${t}`).toBe(true); }
    expect(status(s)).toEqual({ kind: 'free' });
    runTicks(s, 1, HIT_UP); runTicks(s, 1, HIT_DOWN); expect(status(s)).toEqual({ kind: 'charging' });
  });
  test('held through a goal and the kickoff after it', () => {
    const s = playing(); runTicks(s, 1, HIT_DOWN); expect(status(s)).toEqual({ kind: 'charging' });
    s.ball.pos = { x: 478, y: 62 }; s.ball.vel = { x: 220, y: 0 };
    for (let t = 0; t < 120 + 60 + 40; t++) { runTicks(s, 1, HIT_DOWN); if (s.phase === 'kickoff' || s.phase === 'play') expect(noAttack(s), `tick ${t}`).toBe(true); }
    expect(s.phase).toBe('play');
  });
  test('releasing and pressing again does charge', () => {
    const s = playing(); runTicks(s, 1, HIT_DOWN); runTicks(s, 1, HIT_UP); runTicks(s, 60); // the lunge, its recovery and the cooldown are over
    runTicks(s, 1, HIT_DOWN); expect(status(s)).toEqual({ kind: 'charging' });
  });
});

describe('contact', () => {
  test('a shoulder within reach at rage 0: stumble, 10 damage, ball loose, rage 10 for the tackler and 6 for the victim', () => {
    const s = playing(); placeVictimAhead(s, 5);
    s.ball.owner = VICTIM; s.ball.pos = { ...s.players[VICTIM].pos };
    runTicks(s, 1, HIT_DOWN); runTicks(s, 1, HIT_UP);
    expect(hits(s)).toEqual([{ type: 'hit', tackler: TACKLER, victim: VICTIM, hit: 'shoulder', tier: 'stumble', variant: expect.any(Number), damage: 10, late: false }]);
    expect(s.ball.owner).toBeNull();
    expect(s.rage).toEqual([10, 6]);
    expect(s.players[VICTIM].status).toMatchObject({ kind: 'hurt', tier: 'stumble' });
    expect(s.players[VICTIM].health).toBe(90);
  });
  test('the tackler recovers for 8 ticks after landing, with a 20-tick cooldown on a tackle of the carrier', () => {
    const s = playing(); placeVictimAhead(s, 5); s.ball.owner = VICTIM;
    hold(s, 1);
    expect(status(s)).toEqual({ kind: 'recovering', hit: 'shoulder', landed: true });
    expect(s.players[TACKLER].statusTicks).toBe(HIT_LANDED_RECOVER_TICKS);
    expect(s.players[TACKLER].hitCooldown).toBe(HIT_COOLDOWN_TICKS);
    runTicks(s, HIT_LANDED_RECOVER_TICKS); expect(status(s)).toEqual({ kind: 'free' });
  });
  test('a big hit at rage 100 is over the top, and the tackler ends at 70 rage', () => {
    const s = playing(); s.rage = [100, 0]; placeVictimAhead(s, 8);
    hold(s, BIG_HIT_CHARGE_TICKS);
    expect(hits(s)).toEqual([expect.objectContaining({ hit: 'big', tier: 'overTheTop', damage: 60, late: true })]);
    expect(s.rage).toEqual([70, 6]);
  });
  test('a hit on a player without the ball is late: 90-tick cooldown', () => {
    const s = playing(); placeVictimAhead(s, 5);
    hold(s, 1);
    expect(hits(s)[0].late).toBe(true); expect(s.players[TACKLER].hitCooldown).toBe(LATE_HIT_COOLDOWN_TICKS);
  });
  test('a slide during a turbo burst does 16 x 1.2 damage', () => {
    const s = playing(); s.players[TACKLER].turboTicks = 50; placeVictimAhead(s, 6);
    hold(s, 1);
    expect(hits(s)[0]).toMatchObject({ hit: 'slide', damage: 16 * 1.2, tier: 'knockdown' });
  });
  test('a whiff recovers for missTicks, then is free; the cooldown is 20', () => {
    const s = playing(); hold(s, 1);
    runTicks(s, HITS.shoulder.lungeTicks - 1);
    expect(status(s)).toEqual({ kind: 'recovering', hit: 'shoulder', landed: false });
    expect(s.players[TACKLER].statusTicks).toBe(HITS.shoulder.missTicks);
    expect(s.players[TACKLER].hitCooldown).toBe(HIT_COOLDOWN_TICKS);
    runTicks(s, HITS.shoulder.missTicks - 1); expect(status(s).kind).toBe('recovering');
    runTicks(s, 1); expect(status(s)).toEqual({ kind: 'free' });
  });
  test('the cooldown counts down every tick', () => {
    const s = playing(); s.players[TACKLER].hitCooldown = 3; runTicks(s, 2); expect(s.players[TACKLER].hitCooldown).toBe(1);
    runTicks(s, 5); expect(s.players[TACKLER].hitCooldown).toBe(0);
  });
  test('teammates are never hit', () => {
    const s = playing(); s.players[MATE].pos = { x: 105, y: 52 };
    hold(s, 1); runTicks(s, 8);
    expect(s.players[MATE].status).toEqual({ kind: 'free' }); expect(s.rage).toEqual([0, 0]);
  });
  test('a victim already lying down is not hit', () => {
    const s = playing(); placeVictimAhead(s, 5);
    setStatus(s.players[VICTIM], { kind: 'hurt', tier: 'knockdown', variant: 0 }, 72);
    hold(s, 1); runTicks(s, 8);
    expect(s.events.some(e => e.type === 'hit')).toBe(false); expect(s.rage).toEqual([0, 0]);
  });
  test('a stumbling victim can be hit again on a later tick', () => {
    const s = playing(); placeVictimAhead(s, 5);
    setStatus(s.players[VICTIM], { kind: 'hurt', tier: 'stumble', variant: 0 }, 24);
    runTicks(s, 2); // the victim's status is past tick 0
    hold(s, 1);
    expect(hits(s)).toHaveLength(1);
  });
  test('the nearest of two opponents in reach is the victim', () => {
    const s = playing(); s.players[VICTIM].pos = { x: 106, y: 52 }; s.players[8].pos = { x: 103, y: 54 };
    hold(s, 1);
    expect(hits(s)[0].victim).toBe(8);
  });
  test('two tacklers on one victim in one tick: the lower id lands, the other whiffs when his lunge ends', () => {
    const s = playing(); s.rage = [40, 0]; // 10 x 1.6 = 16: knockdown, so the victim stays down
    const lunge = { kind: 'lunging', hit: 'shoulder' } as const;
    s.players[MATE].pos = { x: 100, y: 50 }; s.players[TACKLER].pos = { x: 100, y: 54 };
    for (const id of [MATE, TACKLER]) { s.players[id].facing = { x: 1, y: 0 }; setStatus(s.players[id], lunge, HITS.shoulder.lungeTicks); }
    s.players[VICTIM].pos = { x: 108, y: 52 };
    runTicks(s, 1);
    expect(hits(s)).toEqual([expect.objectContaining({ tackler: MATE, victim: VICTIM })]);
    expect(status(s)).toEqual(lunge);
    for (let t = 0; t < HITS.shoulder.lungeTicks - 2; t++) { runTicks(s, 1); expect(s.events.some(e => e.type === 'hit'), `tick ${t}`).toBe(false); }
    expect(s.events).toContainEqual({ type: 'whiff', player: TACKLER, hit: 'shoulder' });
  });
  test('a victim hurt earlier this tick is not hit again, even by a stumble-level hit', () => {
    const s = playing(); // rage 0: the first hit is only a stumble, so only the same-tick rule protects the victim
    const lunge = { kind: 'lunging', hit: 'shoulder' } as const;
    s.players[MATE].pos = { x: 100, y: 50 }; s.players[TACKLER].pos = { x: 100, y: 54 };
    for (const id of [MATE, TACKLER]) { s.players[id].facing = { x: 1, y: 0 }; setStatus(s.players[id], lunge, HITS.shoulder.lungeTicks); }
    s.players[VICTIM].pos = { x: 108, y: 52 };
    runTicks(s, 1);
    expect(hits(s)).toEqual([expect.objectContaining({ tackler: MATE, victim: VICTIM, tier: 'stumble' })]);
    expect(status(s)).toEqual(lunge);
    expect(s.players[VICTIM].health).toBe(90);
  });
  test('both teams lunging at each other: one hit, lower tackler id resolves first', () => {
    const s = playing(); const lunge = { kind: 'lunging', hit: 'shoulder' } as const;
    s.players[MATE].pos = { x: 100, y: 52 }; s.players[MATE].facing = { x: 1, y: 0 };
    s.players[VICTIM].pos = { x: 106, y: 52 }; s.players[VICTIM].facing = { x: -1, y: 0 };
    for (const id of [MATE, VICTIM]) setStatus(s.players[id], lunge, HITS.shoulder.lungeTicks);
    runTicks(s, 1);
    expect(hits(s)).toEqual([expect.objectContaining({ tackler: MATE, victim: VICTIM })]);
    expect(s.players[MATE].status).toMatchObject({ kind: 'recovering', landed: true });
    expect(s.players[VICTIM].status.kind).toBe('hurt');
  });
});

describe('lunging players and the ball', () => {
  test('a slide through a loose ball does not collect it', () => {
    const s = playing(); s.players[TACKLER].turboTicks = 50;
    s.ball.pos = { x: 112, y: 52 };
    hold(s, 1); expect(status(s)).toEqual({ kind: 'lunging', hit: 'slide' });
    runTicks(s, HITS.slide.lungeTicks - 1);
    expect(s.ball.owner).toBeNull();
  });
});

describe('the computer side hits less often, as a team', () => {
  const cpuTackler = (level: Level = 'pro') => {
    const s = createMatch(matchConfig({ human: [true, false], level: ['pro', level] })); runTicks(s, 60);
    s.ball.owner = null; s.ball.pos = { x: 30, y: 10 };
    const t = s.players[7], v = s.players[3];
    t.pos = { x: 300, y: 52 }; t.facing = { x: -1, y: 0 }; v.pos = { x: 295, y: 52 };
    for (const p of s.players) if (p.team === 1 && p.id !== 7) p.pos = { x: 460, y: 10 };
    return { s, t, v };
  };
  /** Press then release: the computer's tap, launching a shoulder. */
  const tap = (s: MatchState, t: PlayerState) => {
    updateAttack(s, t, { ...neutralIntent(), hitPress: true, hitHeld: true }); tickStatus(t);
    updateAttack(s, t, neutralIntent());
  };
  for (const level of LEVEL_ORDER) {
    test(`${level}: a brain hit that lands sets the cooldown to the level's team value (a late hit would only be 90)`, () => {
      const { s, t } = cpuTackler(level); tap(s, t); resolveContacts(s);
      expect(s.events).toContainEqual(expect.objectContaining({ type: 'hit', tackler: 7, late: true }));
      expect(t.hitCooldown).toBe(LEVELS[level].teamHitCooldownTicks);
    });
  }
  test('a brain hit that misses sets the cooldown to the level value', () => {
    const { s, t, v } = cpuTackler('bruiser'); v.pos = { x: 100, y: 100 };
    tap(s, t);
    for (let i = 0; i < HITS.shoulder.lungeTicks; i++) { if (i > 0) tickStatus(t); applyMovement(s, t, neutralIntent()); resolveContacts(s); }
    expect(s.events).toContainEqual({ type: 'whiff', player: 7, hit: 'shoulder' });
    expect(t.hitCooldown).toBe(LEVELS.bruiser.teamHitCooldownTicks);
  });
  test('launching a hit gives every teammate at least the level cooldown, never lowering a longer one, and leaves the other team alone', () => {
    const { s, t } = cpuTackler('psycho');
    s.players[8].hitCooldown = 600; s.players[9].hitCooldown = 100;
    tap(s, t);
    const c = LEVELS.psycho.teamHitCooldownTicks;
    expect([5, 6, 7, 8, 9].map(i => s.players[i].hitCooldown)).toEqual([c, c, c, 600, c]);
    expect([0, 1, 2, 3, 4].map(i => s.players[i].hitCooldown)).toEqual([0, 0, 0, 0, 0]);
  });
  test('each team reads its own level', () => {
    const s = createMatch(matchConfig({ human: [false, false], level: ['rookie', 'psycho'] })); runTicks(s, 60);
    s.ball.owner = null; s.ball.pos = { x: 30, y: 10 };
    const a = s.players[3], b = s.players[7];
    tap(s, a); tap(s, b);
    expect(a.hitCooldown).toBe(LEVELS.rookie.teamHitCooldownTicks); expect(b.hitCooldown).toBe(LEVELS.psycho.teamHitCooldownTicks);
  });
  test('a human hit does not touch teammates cooldowns', () => {
    const s = playing(); placeVictimAhead(s, 5); s.ball.owner = VICTIM;
    hold(s, 1); expect(s.players[2].hitCooldown).toBe(0);
  });
  test('a human hit keeps the normal cooldown', () => {
    const s = playing(); placeVictimAhead(s, 5); s.ball.owner = VICTIM;
    hold(s, 1); expect(s.players[TACKLER].hitCooldown).toBe(HIT_COOLDOWN_TICKS);
  });
});

describe('outside play', () => {
  for (const phase of ['kickoff', 'goal', 'halftime', 'fulltime'] as const) {
    test(`no hit lands in the ${phase} phase`, () => {
      const s = playing(); placeVictimAhead(s, 5); s.phase = phase; s.phaseTicks = 500;
      setStatus(s.players[TACKLER], { kind: 'lunging', hit: 'shoulder' }, HITS.shoulder.lungeTicks);
      runTicks(s, 10);
      expect(s.events.some(e => e.type === 'hit')).toBe(false);
      expect(s.players[VICTIM].status).toEqual({ kind: 'free' }); expect(s.rage).toEqual([0, 0]);
    });
    test(`a flattened player keeps animating and sliding in the ${phase} phase`, () => {
      const s = playing(); s.phase = phase; s.phaseTicks = 500;
      const p = s.players[VICTIM]; p.pos = { x: 200, y: 62 };
      hurtPlayer(s, p, 'knockdown', { x: 1, y: 0 }, 20);
      runTicks(s, 10); expect(p.statusTick).toBe(10); expect(p.pos.x).toBeGreaterThan(200);
      runTicks(s, 62); expect(p.status).toEqual({ kind: 'free' }); expect(p.knock).toEqual({ x: 0, y: 0 });
    });
  }
});

describe('the placeholder computer side', () => {
  test('a chaser takes the ball off a stationary carrier within 600 ticks', () => {
    const s = createMatch(matchConfig({ human: [true, false] }));
    runTicks(s, 60);
    let taken = false;
    for (let t = 0; t < 600 && !taken; t++) {
      runTicks(s, 1);
      taken = s.events.some(e => e.type === 'hit' && e.tackler >= 5) && (s.ball.owner === null || s.ball.owner >= 5);
    }
    expect(taken).toBe(true);
  });
});
