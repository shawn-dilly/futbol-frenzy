import type { MatchConfig } from '../sim';
import { parseMatchParams } from './params';

export interface MatchLaunch {
  config: MatchConfig;
  mode: 'demo' | 'direct' | 'friendly' | 'cup';
  matchId: string | null;
  mute: boolean;
  teamNames?: [string, string];
}

export function launchFromSearch(search: string): MatchLaunch {
  const p = parseMatchParams(search);
  return { mode: p.demo ? 'demo' : 'direct', matchId: null, mute: p.mute,
    config: { seed: p.seed, halfSeconds: p.halfSeconds, human: [!p.demo, false], level: [p.level2 ?? p.level, p.level] } };
}

export function initialRoute(search: string): 'shell' | 'match' {
  const query = new URLSearchParams(search);
  return query.get('demo') === '1' || query.get('match') === '1' ? 'match' : 'shell';
}
