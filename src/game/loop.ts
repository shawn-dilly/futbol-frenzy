const DEFAULT_STEP_MS = 1000 / 60;
const DEFAULT_MAX_STEPS = 5;

/** Turns variable frame deltas into whole fixed sim steps; a long stall runs at most `maxSteps` and drops the rest. */
export class FixedStepper {
  private accumulatorMs = 0;
  private frozenSteps = 0;

  constructor(private readonly stepMs = DEFAULT_STEP_MS, private readonly maxSteps = DEFAULT_MAX_STEPS) {}

  advance(deltaMs: number): number {
    this.accumulatorMs += deltaMs;
    const due = Math.floor(this.accumulatorMs / this.stepMs);
    let steps = due;
    if (due > this.maxSteps) {
      this.accumulatorMs = 0;
      steps = this.maxSteps;
    } else this.accumulatorMs -= due * this.stepMs;
    const skipped = Math.min(steps, this.frozenSteps);
    this.frozenSteps -= skipped;
    return steps - skipped;
  }

  /** Hit-stop: the next `ticks` steps are consumed without running, so time never piles up into a burst afterwards. */
  freeze(ticks: number): void { this.frozenSteps += ticks; }

  reset(): void { this.accumulatorMs = 0; this.frozenSteps = 0; }
}
