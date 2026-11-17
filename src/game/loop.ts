const DEFAULT_STEP_MS = 1000 / 60;
const DEFAULT_MAX_STEPS = 5;

/** Turns variable frame deltas into whole fixed sim steps; a long stall runs at most `maxSteps` and drops the rest. */
export class FixedStepper {
  private accumulatorMs = 0;

  constructor(private readonly stepMs = DEFAULT_STEP_MS, private readonly maxSteps = DEFAULT_MAX_STEPS) {}

  advance(deltaMs: number): number {
    this.accumulatorMs += deltaMs;
    const due = Math.floor(this.accumulatorMs / this.stepMs);
    if (due > this.maxSteps) {
      this.accumulatorMs = 0;
      return this.maxSteps;
    }
    this.accumulatorMs -= due * this.stepMs;
    return due;
  }

  reset(): void { this.accumulatorMs = 0; }
}
