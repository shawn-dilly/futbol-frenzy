import { resolveKits, type MatchKits, type TeamRecord } from '../content/teams';
import type { MatchConfig } from '../sim';
import { parseMatchParams } from './params';

import type { InjuryStyle } from './indicators';

export interface MatchLaunch {
  injuryStyle?: InjuryStyle;
  config: MatchConfig;
  mode: 'demo' | 'direct' | 'friendly' | 'cup';
  matchId: string | null;
  mute: boolean;
  kits?: MatchKits;
  teamNames?: [string, string];
}

export function matchTeams(home: TeamRecord, away: TeamRecord): Pick<MatchLaunch, 'teamNames' | 'kits'> {
  return { teamNames: [home.name, away.name], kits: resolveKits(home, away) };
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
