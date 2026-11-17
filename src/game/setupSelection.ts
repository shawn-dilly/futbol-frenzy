import { TEAMS } from '../content/teams';
import type { Level, MatchConfig } from '../sim';

export type MatchLength = 'short' | 'long' | 'five';
export interface SetupSelection {
  team: number;
  opponent: number;
  level: Level;
  length: MatchLength;
}

/** Convert the setup screen's selections into simulation inputs. */
export function setupConfig(selection: SetupSelection, seed: number): MatchConfig {
  const team = TEAMS[selection.team];
  const opponent = TEAMS[selection.opponent];
  if (!team || !opponent) throw new Error('Unknown team selection');
  return {
    seed,
    halfSeconds: selection.length === 'long' ? 240 : 120,
    ...(selection.length === 'five' ? { targetGoals: 5 } : {}),
    human: [true, false],
    level: [selection.level, selection.level],
    ratings: [{ ...team.ratings }, { ...opponent.ratings }],
  };
}
