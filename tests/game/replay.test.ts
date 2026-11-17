import { describe, expect, it } from 'vitest';
import { createMatch, neutralPad, step, type MatchConfig } from '../../src/sim';
import { createReplayRecord, recordReplayInput, reconstructReplay } from '../../src/game/replay';

const config: MatchConfig = { seed: 7, halfSeconds: 1, human: [true, false], level: ['pro', 'rookie'] };

function deepFreeze(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
}

describe('replay', () => {
  it('owns normalized config and inputs and reconstructs exact states through halftime', () => {
    const source: MatchConfig = { ...structuredClone(config), ratings: [{ speed: 0.2, power: 0.3, skill: 0.4, dirty: 0.5 }, { speed: 0.6, power: 0.7, skill: 0.8, dirty: 0.9 }] };
    const record = createReplayRecord(source);
    const live = createMatch(source);
    const states = [];
    const pair: [ReturnType<typeof neutralPad>, ReturnType<typeof neutralPad>] = [neutralPad(), neutralPad()];
    for (let i = 0; i < 800; i++) {
      pair[0].moveX = i % 2;
      pair[0].shoot = i % 40 === 0;
      recordReplayInput(record, pair);
      step(live, pair);
      states.push(structuredClone(live));
    }
    expect(states.some(s => s.half === 2)).toBe(true);
    source.human[0] = false;
    source.level[0] = 'rookie';
    source.ratings![0].speed = 1;
    source.ratings![1] = { speed: 0, power: 0, skill: 0, dirty: 0 };
    pair[0].moveX = 99;
    pair[0].shoot = true;
    pair[1].moveX = 99;
    expect(record.config.human[0]).toBe(true);
    expect(record.config.level).toEqual(['pro', 'rookie']);
    expect(record.config.ratings).toEqual([{ speed: 0.2, power: 0.3, skill: 0.4, dirty: 0.5 }, { speed: 0.6, power: 0.7, skill: 0.8, dirty: 0.9 }]);
    expect(record.inputs[1][0]).toMatchObject({ moveX: 1, shoot: false });
    expect(record.inputs[0][1]).toEqual(neutralPad());
    const before = structuredClone(record);
    deepFreeze(record);
    const result = reconstructReplay(record, { tick: 400, eventIndex: 0, damage: 1 }, 399, 400);
    expect(result.kind).toBe('window');
    if (result.kind === 'window') expect(result.states).toEqual(states);
    expect(record).toEqual(before);
  });
  it('clips windows and handles no hit', () => {
    const record = createReplayRecord(config);
    for (let i = 0; i < 5; i++) recordReplayInput(record, [neutralPad(), neutralPad()]);
    expect(reconstructReplay(record, null, 3, 3)).toEqual({ kind: 'no-hit' });
    const first = reconstructReplay(record, { tick: 1, eventIndex: 2, damage: 5 }, 3, 1);
    const last = reconstructReplay(record, { tick: 5, eventIndex: 1, damage: 5 }, 1, 3);
    if (first.kind !== 'window' || last.kind !== 'window') throw new Error('missing window');
    expect(first.states.map(s => s.tick)).toEqual([1, 2]);
    expect(last.states.map(s => s.tick)).toEqual([4, 5]);
    expect(last.hit.eventIndex).toBe(1);
    Object.freeze(record.inputs);
    Object.freeze(record);
    expect(reconstructReplay(record, last.hit, 1, 3)).toEqual(last);
  });
  it('replays the sim-selected CPU hit and its exact event', () => {
    const cpu: MatchConfig = { ...config, halfSeconds: 120, human: [false, false], level: ['psycho', 'psycho'] };
    const record = createReplayRecord(cpu);
    const live = createMatch(cpu);
    const history = [];
    for (let i = 0; i < 2000; i++) {
      const pair: [ReturnType<typeof neutralPad>, ReturnType<typeof neutralPad>] = [neutralPad(), neutralPad()];
      recordReplayInput(record, pair);
      step(live, pair);
      history.push(structuredClone(live));
    }
    const hit = live.halfHits[0];
    expect(hit).not.toBeNull();
    const result = reconstructReplay(record, hit, 2, 2);
    if (result.kind !== 'window' || !hit) throw new Error('missing hit');
    expect(result.states).toEqual(history.slice(hit.tick - 3, hit.tick + 2));
    expect(result.states[2].events[hit.eventIndex]).toMatchObject({ type: 'hit', damage: hit.damage });
  });

  it('reconstructs selected hits around halftime and preserves the earliest equal-damage hit', () => {
    const cpu: MatchConfig = { seed: 15, halfSeconds: 20, human: [false, false], level: ['psycho', 'psycho'] };
    const record = createReplayRecord(cpu);
    const live = createMatch(cpu);
    const history = [];
    for (let i = 0; i < 2200; i++) {
      const pair: [ReturnType<typeof neutralPad>, ReturnType<typeof neutralPad>] = [neutralPad(), neutralPad()];
      recordReplayInput(record, pair);
      step(live, pair);
      history.push(structuredClone(live));
    }
    const [first, second] = live.halfHits;
    expect(first?.tick).toBe(1097);
    expect(second?.tick).toBe(1520);
    if (!first || !second) throw new Error('missing selected hits');
    const later = history[2143].events.find(e => e.type === 'hit' && e.damage === second.damage);
    expect(later).toBeDefined();
    expect(history[2143].halfHits[1]).toEqual(second);
    for (const hit of [first, second]) {
      const result = reconstructReplay(record, hit, 300, 300);
      if (result.kind !== 'window') throw new Error('missing window');
      expect(result.hit).toEqual(hit);
      expect(result.states).toEqual(history.slice(hit.tick - 301, hit.tick + 300));
      expect(result.states[300].events[hit.eventIndex]).toMatchObject({ type: 'hit', damage: hit.damage });
    }
    // Clip at the beginning and at the recorded end while retaining the selected event.
    const start = reconstructReplay(record, first, first.tick, 0);
    const truncated = { ...record, inputs: record.inputs.slice(0, second.tick) };
    const end = reconstructReplay(truncated, second, 0, 300);
    if (start.kind !== 'window' || end.kind !== 'window') throw new Error('missing clipped window');
    expect(start.states[0].tick).toBe(1);
    expect(start.states.at(-1)?.events[first.eventIndex]).toEqual(history[first.tick - 1].events[first.eventIndex]);
    expect(end.states.at(-1)?.tick).toBe(second.tick);
    expect(end.states[0].events[second.eventIndex]).toEqual(history[second.tick - 1].events[second.eventIndex]);
  });

});
