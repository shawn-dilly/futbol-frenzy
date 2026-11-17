import { step } from '../src/sim/step';
import { neutralPad } from '../src/sim/setup';
import type { MatchConfig, MatchState, PadInput } from '../src/sim/types';

/** Calls `step` n times with the same inputs (two neutral pads by default). */
export function runTicks(state: MatchState, n: number, inputs?: [PadInput, PadInput]): void {
  const pads = inputs ?? [neutralPad(), neutralPad()];
  for (let i = 0; i < n; i++) step(state, pads);
}

/** A match config for tests: seed 1, 120 s halves, human team 0, both sides at level pro; `overrides` win. */
export function matchConfig(overrides: Partial<MatchConfig> = {}): MatchConfig {
  return { seed: 1, halfSeconds: 120, human: [true, false], level: ['pro', 'pro'], ...overrides };
}
