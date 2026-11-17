import { expect, test } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { advanceFlow } from '../../src/sim/flow';
import { matchConfig } from '../helpers';

 test('target goals end immediately and halftime happens only once', () => {
  const s = createMatch({ ...matchConfig(), targetGoals: 5 });
  s.phase = 'play'; s.clockTicks = 1;
  advanceFlow(s, null); expect(s.clockTicks).toBe(1); expect(s.phase).toBe('play');
  s.score = [2, 0]; advanceFlow(s, 0);
  expect(s.phase).toBe('halftime'); expect(s.events).toContainEqual({ type: 'whistle', what: 'halftime' });
  s.phaseTicks = 1; advanceFlow(s, null); expect(s.half).toBe(2);
  s.phase = 'play'; s.score = [3, 2]; advanceFlow(s, 1); expect(s.phase).toBe('goal');
  s.phase = 'play'; s.score = [4, 3]; s.events = []; advanceFlow(s, 0);
  expect(s.phase).toBe('fulltime'); expect(s.events).toEqual([{ type: 'goal', team: 0 }, { type: 'whistle', what: 'fulltime' }]);
 });
 test('target normalization rejects invalid values and survives serialization', () => {
  for (const targetGoals of [0, -1, 1.5, NaN, Infinity]) expect(createMatch({ ...matchConfig(), targetGoals }).config.targetGoals).toBeUndefined();
  const config = createMatch({ ...matchConfig(), targetGoals: 5 }).config;
  expect(createMatch(JSON.parse(JSON.stringify(config))).config).toEqual(config);
 });

test('seeded target matches reproduce from serialized configuration', async () => {
  const { runTicks } = await import('../helpers');
  const a = createMatch({ ...matchConfig(), seed: 42, targetGoals: 5 });
  const b = createMatch(JSON.parse(JSON.stringify(a.config)));
  runTicks(a, 1000); runTicks(b, 1000);
  expect(b).toEqual(a);
});

test('winning goal takes precedence over halftime', () => {
  const s = createMatch({ ...matchConfig(), targetGoals: 3 });
  s.phase = 'play'; s.score = [2, 0]; s.events = [];
  advanceFlow(s, 0);
  expect(s.phase).toBe('fulltime');
  expect(s.events).toEqual([{ type: 'goal', team: 0 }, { type: 'whistle', what: 'fulltime' }]);
});
