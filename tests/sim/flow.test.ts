import { describe, expect, test } from 'vitest';
import type { PadInput } from '../../src/sim/types';
import { createMatch, neutralPad } from '../../src/sim/setup';
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
  test('the tick that ends each half emits its whistle', () => {
    const s = createMatch(short);
    runTicks(s, 60 + 119); expect(s.events).toEqual([]);
    runTicks(s, 1); expect(s.events).toContainEqual({ type: 'whistle', what: 'halftime' });
    runTicks(s, 180 + 60 + 119); runTicks(s, 1);
    expect(s.events).toContainEqual({ type: 'whistle', what: 'fulltime' });
  });
  test('a goal for team 1 scores for team 1, then team 0 kicks off', () => {
    const s = createMatch(cfg); runTicks(s, 60);
    s.ball.owner = null; s.ball.pos = { x: 2, y: 62 }; s.ball.vel = { x: -220, y: 0 };
    runTicks(s, 1);
    expect(s.score).toEqual([0, 1]); expect(s.events).toContainEqual({ type: 'goal', team: 1 });
    runTicks(s, 120);
    expect(s.phase).toBe('kickoff'); expect(s.ball.owner).toBe(4);
  });
  test('events are cleared every tick', () => {
    const s = createMatch(cfg); expect(s.events.length).toBe(1);
    runTicks(s, 1); expect(s.events).toEqual([]);
  });

  describe('players stop when play stops', () => {
    const moving: [PadInput, PadInput] = [{ ...neutralPad(), moveX: 1 }, neutralPad()];
    const running = () => { // every player moving: team 0 human runs right, the rest follow the brain
      const s = createMatch(cfg); runTicks(s, 60);
      runTicks(s, 5, moving);
      expect(s.players.some(p => p.vel.x !== 0 || p.vel.y !== 0)).toBe(true);
      return s;
    };
    const expectStopped = (s: ReturnType<typeof createMatch>) => {
      for (const p of s.players) {
        expect(p.vel, `player ${p.id}`).toEqual({ x: 0, y: 0 });
      }
    };
    test('goal', () => {
      const s = running();
      s.ball.owner = null; s.ball.pos = { x: 478, y: 62 }; s.ball.vel = { x: 220, y: 0 };
      runTicks(s, 1); expect(s.phase).toBe('goal'); expectStopped(s);
      runTicks(s, 30); expectStopped(s);
    });
    test('halftime', () => {
      const s = running(); s.clockTicks = 1;
      runTicks(s, 1, moving); expect(s.phase).toBe('halftime'); expectStopped(s);
    });
    test('fulltime', () => {
      const s = running(); s.half = 2; s.clockTicks = 1;
      runTicks(s, 1, moving); expect(s.phase).toBe('fulltime'); expectStopped(s);
      runTicks(s, 30); expectStopped(s);
    });
  });
});
