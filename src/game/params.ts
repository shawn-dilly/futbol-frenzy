import { DEFAULT_HALF_SECONDS } from '../sim';

export interface MatchParams { demo: boolean; seed: number; halfSeconds: number; mute: boolean }

const DEFAULT_SEED = 1;

function positiveInt(raw: string | null, fallback: number): number {
  const n = raw === null ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Reads ?demo=1&seed=N&half=SECONDS&mute=1 from a URL search string. */
export function parseMatchParams(search: string): MatchParams {
  const q = new URLSearchParams(search);
  return {
    demo: q.get('demo') === '1',
    seed: positiveInt(q.get('seed'), DEFAULT_SEED),
    halfSeconds: positiveInt(q.get('half'), DEFAULT_HALF_SECONDS),
    mute: q.get('mute') === '1',
  };
}
