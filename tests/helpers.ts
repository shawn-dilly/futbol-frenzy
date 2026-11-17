import { step } from '../src/sim/step';
import { neutralPad } from '../src/sim/setup';
import type { MatchState, PadInput } from '../src/sim/types';

/** Calls `step` n times with the same inputs (two neutral pads by default). */
export function runTicks(state: MatchState, n: number, inputs?: [PadInput, PadInput]): void {
  const pads = inputs ?? [neutralPad(), neutralPad()];
  for (let i = 0; i < n; i++) step(state, pads);
}
