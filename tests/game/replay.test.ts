import { describe, expect, it } from 'vitest';
import { createMatch, neutralPad, step, type MatchConfig } from '../../src/sim';
import { createReplayRecord, recordReplayInput, reconstructReplay } from '../../src/game/replay';

const config: MatchConfig = { seed: 7, halfSeconds: 1, human: [true, false], level: ['pro', 'rookie'] };

describe('replay', () => {
  it('owns normalized config and inputs and reconstructs exact states through halftime', () => {
    const source = structuredClone(config);
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
    pair[0].moveX = 99;
    expect(record.config.human[0]).toBe(true);
    expect(record.config.ratings?.[0].speed).toBe(0.5);
    expect(record.inputs[0][0].moveX).toBe(0);
    const before = structuredClone(record);
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

});
