import { expect, test } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { kick } from '../../src/sim/possession';
import { resolveContacts } from '../../src/sim/attack';
import { setStatus } from '../../src/sim/status';
import { matchConfig } from '../helpers';

test.each([0, 1] as const)('team %i counts only executed shots', team => {
  const s = createMatch(matchConfig());
  const p = s.players[team * 5 + 1];
  expect(s.halfHits).toEqual([null, null]);
  kick(s, p, 'shot', { x: 1, y: 0 });
  s.ball.owner = p.id; kick(s, p, 'pass', { x: 1, y: 0 });
  s.ball.owner = p.id; kick(s, p, 'shot', { x: 1, y: 0 });
  expect(s.stats[team]).toEqual({ shots: 1, bigHits: 0, kos: 0, steals: 0 });
});

test.each([0, 1] as const)('team %i records lethal carrier contacts and half highlights', team => {
  const s = createMatch(matchConfig());
  const a = s.players[team * 5 + 1], id = (1 - team) * 5 + 1;
  for (const p of s.players) p.pos = { x: 0, y: 0 };
  a.pos = { x: 300, y: 300 }; s.players[id].pos = { ...a.pos };
  s.players[id].health = 1; s.ball.owner = id;
  s.events = [{ type: 'bounce' }]; s.tick = 12;
  setStatus(a, { kind: 'lunging', hit: 'big' }, 10); resolveContacts(s);
  expect(s.stats[team]).toEqual({ shots: 0, bigHits: 1, kos: 1, steals: 1 });
  const event = s.events[1];
  expect(event.type).toBe('hit');
  if (event.type !== 'hit') throw new Error('missing hit');
  expect(s.halfHits[0]).toEqual({ tick: 13, eventIndex: 1, damage: event.damage });
  s.half = 2; s.reserves[1 - team] = 0; s.players[id].pos = { ...a.pos }; s.players[id].health = 1;
  setStatus(a, { kind: 'lunging', hit: 'big' }, 10); resolveContacts(s);
  expect(s.stats[team].kos).toBe(2);
  expect(s.stats[team].steals).toBe(1);
  expect(s.halfHits[1]?.eventIndex).toBe(2);
});

test('misses and interrupted lunges do not count as hits; distinct contacts do', () => {
  const s = createMatch(matchConfig());
  for (const p of s.players) p.pos = { x: 0, y: 0 };
  s.players[1].pos = { x: 300, y: 300 }; s.players[6].pos = { x: 300, y: 300 };
  s.players[2].pos = { x: 500, y: 300 }; s.players[7].pos = { x: 500, y: 300 };
  for (const id of [1, 2, 6]) setStatus(s.players[id], { kind: 'lunging', hit: 'big' }, 10);
  resolveContacts(s);
  expect(s.events.filter(e => e.type === 'hit')).toHaveLength(2);
  expect(s.stats[0].bigHits).toBe(2);
  expect(s.stats[1].bigHits).toBe(0);
  s.players[3].pos = { x: 700, y: 500 };
  setStatus(s.players[3], { kind: 'lunging', hit: 'big' }, 1);
  s.players[3].statusTick = 99;
  resolveContacts(s);
  expect(s.events.some(e => e.type === 'whiff' && e.player === 3)).toBe(true);
  expect(s.stats[0].bigHits).toBe(2);
});

test('lethal hits continue counting after reserves are exhausted', () => {
  const s = createMatch(matchConfig()); s.reserves[1] = 0;
  for (const p of s.players) p.pos = { x: 0, y: 0 };
  s.players[1].pos = s.players[6].pos = { x: 300, y: 300 };
  for (let i = 0; i < 2; i++) {
    s.players[6].health = 1; setStatus(s.players[6], { kind: 'free' }, 0);
    setStatus(s.players[1], { kind: 'lunging', hit: 'big' }, 10); resolveContacts(s);
  }
  expect(s.stats[0].kos).toBe(2);
});

test('equal damage highlights retain the earliest contact within and across ticks', () => {
  const s = createMatch(matchConfig());
  for (const p of s.players) p.pos = { x: 0, y: 0 };
  s.players[1].pos = s.players[6].pos = { x: 300, y: 300 };
  s.players[2].pos = s.players[7].pos = { x: 500, y: 300 };
  s.rage[0] = 100; s.events = [];
  for (const id of [1, 2]) setStatus(s.players[id], { kind: 'lunging', hit: 'shoulder' }, 10);
  resolveContacts(s);
  const hits = s.events.filter(e => e.type === 'hit');
  expect(hits).toHaveLength(2);
  if (hits[0].type !== 'hit' || hits[1].type !== 'hit') throw new Error('missing hits');
  expect(hits[1].damage).toBe(hits[0].damage);
  const first = s.halfHits[0];
  expect(first).toEqual({ tick: 1, eventIndex: 0, damage: hits[0].damage });
  s.tick++; s.events = []; s.rage[0] = 100;
  setStatus(s.players[6], { kind: 'free' }, 0);
  setStatus(s.players[1], { kind: 'lunging', hit: 'shoulder' }, 10);
  resolveContacts(s);
  const later = s.events[0];
  expect(later.type).toBe('hit');
  if (later.type !== 'hit') throw new Error('missing later hit');
  expect(later.damage).toBe(hits[0].damage);
  expect(s.halfHits[0]).toEqual(first);
});

test.each([1, 2] as const)('step records hit index and tick before half %i ends', async half => {
  const { step } = await import('../../src/sim/step');
  const { neutralPad } = await import('../../src/sim/setup');
  const s = createMatch(matchConfig({ human: [true, true] }));
  s.phase = 'play'; s.half = half; s.clockTicks = 1; s.tick = 41;
  for (const p of s.players) p.pos = { x: 50, y: 50 };
  s.players[0].pos = { x: 700, y: 500 };
  s.players[1].pos = s.players[6].pos = { x: 300, y: 300 };
  setStatus(s.players[0], { kind: 'lunging', hit: 'big' }, 1000);
  s.players[0].statusTick = 99;
  setStatus(s.players[1], { kind: 'lunging', hit: 'big' }, 10);
  step(s, [neutralPad(), neutralPad()]);
  expect(s.events[0].type).toBe('whiff');
  const hit = s.events[1];
  expect(hit.type).toBe('hit');
  if (hit.type !== 'hit') throw new Error('missing hit');
  expect(s.halfHits[half - 1]).toEqual({ tick: 42, eventIndex: 1, damage: hit.damage });
  expect(s.events.at(-1)).toEqual({ type: 'whistle', what: half === 1 ? 'halftime' : 'fulltime' });
  expect(s.phase).toBe(half === 1 ? 'halftime' : 'fulltime');
});
