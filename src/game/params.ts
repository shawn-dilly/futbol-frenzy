import { DEFAULT_HALF_SECONDS, LEVEL_ORDER, type Level } from '../sim';

export interface MatchParams { demo: boolean; seed: number; halfSeconds: number; mute: boolean; level: Level; level2: Level | null }

const DEFAULT_SEED = 1;
const DEFAULT_LEVEL: Level = 'pro';

function levelOr<T extends Level | null>(raw: string | null, fallback: T): Level | T {
  return LEVEL_ORDER.find(l => l === raw) ?? fallback;
}

function positiveInt(raw: string | null, fallback: number): number {
  const n = raw === null ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Reads ?demo=1&seed=N&half=SECONDS&mute=1&level=NAME&level2=NAME from a URL search string. */
export function parseMatchParams(search: string): MatchParams {
  const q = new URLSearchParams(search);
  return {
    demo: q.get('demo') === '1',
    seed: positiveInt(q.get('seed'), DEFAULT_SEED),
    halfSeconds: positiveInt(q.get('half'), DEFAULT_HALF_SECONDS),
    mute: q.get('mute') === '1',
    level: levelOr(q.get('level'), DEFAULT_LEVEL),
    level2: levelOr(q.get('level2'), null),
  };
}
