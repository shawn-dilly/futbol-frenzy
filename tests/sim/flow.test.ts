import { describe, expect, test } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { runTicks } from '../helpers';

const cfg = { seed: 1, halfSeconds: 120, human: [true, false] as [boolean, boolean] };
const short = { seed: 1, halfSeconds: 2, human: [true, true] as [boolean, boolean] }; // both human with neutral pads: nobody shoots, so tick counts are exact

describe('match flow', () => {
  test('a goal scores, pauses 120 ticks, then the conceding team kicks off', () => {
    const s = createMatch(cfg); runTicks(s, 60);
    s.ball.owner = null; s.ball.pos = { x: 478, y: 62 }; s.ball.vel = { x: 220, y: 0 };
    runTicks(s, 1);
    expect(s.score).toEqual([1, 0]); expect(s.phase).toBe('goal');
    expect(s.events).toContainEqual({ type: 'goal', team: 0 });
    const clock = s.clockTicks; runTicks(s, 120);
    expect(s.phase).toBe('kickoff'); expect(s.ball.owner).toBe(9); expect(s.clockTicks).toBe(clock);
  });
  test('clock does not run during the kickoff pause', () => {
    const s = createMatch(cfg); runTicks(s, 60); expect(s.clockTicks).toBe(7200);
    runTicks(s, 10); expect(s.clockTicks).toBe(7190);
  });
  test('halftime, then team 1 kicks off the second half, then full time', () => {
    const s = createMatch(short);
    runTicks(s, 60 + 120); expect(s.phase).toBe('halftime');
    runTicks(s, 180); expect(s.half).toBe(2); expect(s.phase).toBe('kickoff'); expect(s.ball.owner).toBe(9);
    expect(s.clockTicks).toBe(120);
    runTicks(s, 60 + 120); expect(s.phase).toBe('fulltime');
    const snap = JSON.stringify({ ...s, tick: 0, events: [] }); runTicks(s, 100);
    expect(JSON.stringify({ ...s, tick: 0, events: [] })).toBe(snap);
  });
  test('events are cleared every tick', () => {
    const s = createMatch(cfg); expect(s.events.length).toBe(1);
    runTicks(s, 1); expect(s.events).toEqual([]);
  });
});
