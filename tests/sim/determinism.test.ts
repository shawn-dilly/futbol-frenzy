import { expect, test } from 'vitest';
import { createMatch, neutralPad } from '../../src/sim/setup';
import { step } from '../../src/sim/step';
import type { MatchState, PadInput } from '../../src/sim/types';
import { runTicks } from '../helpers';

const cpu = { seed: 7, halfSeconds: 120, human: [false, false] as [boolean, boolean] };
const MAX_MATCH_TICKS = 40000; // cap: two 120 s halves are 14400 ticks plus kickoff, goal and halftime pauses
const SPLIT_TICKS = 1500;

/** A fixed function of the tick: moves, passes, shoots, uses turbo and HIT. */
function scriptedPad(tick: number): PadInput {
  const phase = Math.floor(tick / 30);
  return {
    moveX: [1, 0.7, 0, -0.7, -1, 0][phase % 6],
    moveY: [0, 0.7, 1, -0.7, 0, -1][(phase + 2) % 6],
    pass: tick % 90 === 10,
    shoot: tick % 200 === 150,
    hit: tick % 75 === 20,
    turbo: phase % 4 === 1,
  };
}

function drive(state: MatchState, from: number, to: number): void {
  for (let t = from; t < to; t++) step(state, [scriptedPad(t), neutralPad()]);
}

test('two CPU-v-CPU matches with the same seed are identical; a full match finishes', () => {
  const a = createMatch({ ...cpu, halfSeconds: 30 }), b = createMatch({ ...cpu, halfSeconds: 30 });
  runTicks(a, 12000); runTicks(b, 12000);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  expect(a.phase).toBe('fulltime');
  for (const p of a.players) { expect(Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y)).toBe(true); }
});

test('a full 120 s-half match driven by one scripted pad sequence is identical twice over', () => {
  const config = { ...cpu, human: [true, false] as [boolean, boolean] };
  const a = createMatch(config), b = createMatch(config);
  for (const m of [a, b]) for (let t = 0; t < MAX_MATCH_TICKS && m.phase !== 'fulltime'; t++) step(m, [scriptedPad(t), neutralPad()]);
  expect(a.phase).toBe('fulltime');
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});

test('a state serialised to JSON mid-match continues exactly like the original', () => {
  const config = { ...cpu, human: [true, false] as [boolean, boolean] };
  const original = createMatch(config);
  drive(original, 0, SPLIT_TICKS);
  const copy: MatchState = JSON.parse(JSON.stringify(original));
  drive(original, SPLIT_TICKS, 2 * SPLIT_TICKS); drive(copy, SPLIT_TICKS, 2 * SPLIT_TICKS);
  expect(JSON.stringify(copy)).toBe(JSON.stringify(original));
});

test('a different seed gives a different match', () => {
  const config = { ...cpu, human: [true, false] as [boolean, boolean] };
  const a = createMatch(config), b = createMatch({ ...config, seed: 8 });
  drive(a, 0, SPLIT_TICKS); drive(b, 0, SPLIT_TICKS);
  expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
});
