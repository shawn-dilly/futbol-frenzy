import { createMatch, step, type HalfHit, type MatchConfig, type MatchState, type PadInput } from '../sim';

export interface ReplayRecord {
  config: MatchConfig;
  inputs: [PadInput, PadInput][];
}

export function createReplayRecord(config: MatchConfig): ReplayRecord {
  return { config: createMatch(config).config, inputs: [] };
}

export function recordReplayInput(record: ReplayRecord, inputs: [PadInput, PadInput]): void {
  record.inputs.push([{ ...inputs[0] }, { ...inputs[1] }]);
}

export type ReplayResult =
  | { kind: 'no-hit' }
  | { kind: 'window'; hit: HalfHit; states: MatchState[] };

/** Pre/post counts are steps on either side of the selected hit's step. */
export function reconstructReplay(record: ReplayRecord, hit: HalfHit | null, preSteps: number, postSteps: number): ReplayResult {
  if (!hit) return { kind: 'no-hit' };
  if (!Number.isInteger(hit.tick) || hit.tick < 1 || hit.tick > record.inputs.length ||
      !Number.isInteger(preSteps) || preSteps < 0 || !Number.isInteger(postSteps) || postSteps < 0) {
    throw new RangeError('Invalid replay window');
  }
  const first = Math.max(1, hit.tick - preSteps);
  const last = Math.min(record.inputs.length, hit.tick + postSteps);
  const state = createMatch(record.config);
  const states: MatchState[] = [];
  for (let i = 0; i < last; i++) {
    const pair = record.inputs[i];
    step(state, [{ ...pair[0] }, { ...pair[1] }]);
    if (i + 1 >= first) states.push(structuredClone(state));
  }
  return { kind: 'window', hit: { ...hit }, states };
}
