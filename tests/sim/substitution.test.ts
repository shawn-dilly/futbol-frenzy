import { expect, test } from 'vitest';
import { createMatch, blankMemory } from '../../src/sim/setup';
import { hurtPlayer } from '../../src/sim/hurt';
import { resolveContacts } from '../../src/sim/attack';
import { isInjured, setStatus } from '../../src/sim/status';
import { matchConfig } from '../helpers';

test.each([0, 1] as const)('team %i uses three reserves including keeper then falls back to dazed', team => {
  const s = createMatch(matchConfig());
  expect(s.reserves).toEqual([3, 3]);
  const id = team * 5;
  for (let i = 0; i < 3; i++) {
    const p = s.players[id]; p.health = 1; p.turboTicks = 10; p.hitCooldown = 9; p.kickCooldown = 8;
    s.brain[id].action = 'shot'; s.defensiveHitAt[id] = 99999;
    s.ball.owner = id; s.ball.ownerTicks = 4; s.ball.passTarget = id;
    hurtPlayer(s, p, 'wipeout', { x: 1, y: 0 }, 10);
    const replacement = s.players[id];
    expect(replacement).not.toBe(p);
    expect(isInjured(s, replacement)).toBe(false);
    expect([replacement.id, replacement.team, replacement.role, replacement.health]).toEqual([id, team, 'gk', 100]);
    expect([replacement.status, replacement.statusTick, replacement.statusTicks, replacement.turboTicks, replacement.hitCooldown, replacement.kickCooldown, replacement.knock]).toEqual([{ kind: 'free' }, 0, 0, 0, 0, 0, { x: 0, y: 0 }]);
    expect(s.brain[id]).toEqual(blankMemory());
    expect(s.defensiveHitAt[id]).toBe(s.liveTicks + (team === 0 ? 240 : 0));
    expect([s.ball.owner, s.ball.ownerTicks, s.ball.passTarget]).toEqual([null, 0, null]);
    expect(s.reserves[team]).toBe(2 - i);
  }
  s.players[id].health = 1;
  hurtPlayer(s, s.players[id], 'wipeout', { x: 1, y: 0 }, 10);
  expect(s.players[id].health).toBe(1);
  expect(s.players[id].status.kind).toBe('hurt');
});

test('simultaneous contacts cannot hit the replacement again', () => {
  const s = createMatch(matchConfig());
  for (const p of s.players) p.pos = { x: 0, y: 0 };
  s.players[1].pos = s.players[2].pos = s.players[6].pos = { ...s.players[6].anchor };
  s.players[6].health = 1;
  for (const id of [1, 2]) setStatus(s.players[id], { kind: 'lunging', hit: 'big' }, 10);
  resolveContacts(s);
  expect(s.reserves[1]).toBe(2);
  expect(s.events.filter(e => e.type === 'hit' && e.victim === 6)).toHaveLength(1);
});

test('reserves persist through halftime and replacement health participates in regeneration', async () => {
  const { regenHealth } = await import('../../src/sim/hurt');
  const { advanceFlow } = await import('../../src/sim/flow');
  const s = createMatch(matchConfig());
  s.players[1].health = 1;
  hurtPlayer(s, s.players[1], 'wipeout', { x: 1, y: 0 }, 10);
  s.players[1].health = 50;
  regenHealth(s);
  expect(s.players[1].health).toBeGreaterThan(50);
  s.phase = 'play'; s.clockTicks = 1;
  advanceFlow(s, null);
  expect(s.phase).toBe('halftime');
  expect(s.reserves).toEqual([2, 3]);
  expect(s.players[1].health).toBeGreaterThan(75);
});

test('substituting a pass target clears the target even when another player owns the ball', () => {
  const s = createMatch(matchConfig());
  s.ball.owner = 2; s.ball.passTarget = 6; s.players[6].health = 1;
  hurtPlayer(s, s.players[6], 'wipeout', { x: 1, y: 0 }, 10);
  expect(s.ball.owner).toBe(2);
  expect(s.ball.passTarget).toBeNull();
});

test.each([5, 6])('replacement %i cannot reclaim the ball until the following step', async id => {
  const { step } = await import('../../src/sim/step');
  const { neutralPad } = await import('../../src/sim/setup');
  const s = createMatch(matchConfig({ human: [true, true] }));
  s.phase = 'play'; s.controlled = [1, id];
  for (const p of s.players) p.pos = { x: 50, y: 50 };
  const anchor = { ...s.players[id].anchor };
  s.players[id].pos = { ...anchor }; s.players[1].pos = { ...anchor };
  s.players[id].health = 1; s.ball.owner = id; s.ball.pos = { ...anchor };
  setStatus(s.players[1], { kind: 'lunging', hit: 'big' }, 10);
  step(s, [neutralPad(), neutralPad()]);
  expect(s.reserves[1]).toBe(2);
  expect(s.ball.owner).toBeNull();
  expect(s.controlled[1]).not.toBe(id);
  s.ball.pos = { ...s.players[id].pos }; s.ball.vel = { x: 0, y: 0 };
  step(s, [neutralPad(), neutralPad()]);
  expect(s.ball.owner).toBe(id);
  expect(s.controlled[1]).toBe(id);
});
