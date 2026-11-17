import { TEAMS, type TeamRecord } from '../content/teams';
import type { MatchConfig } from '../sim';

export type CupResult = 'win' | 'draw' | 'loss';
export interface CupSession {
  runId: string;
  selectedTeam: TeamRecord;
  settings: MatchConfig;
  opponents: TeamRecord[];
  rung: number;
  matchId: string;
  consumedIds: string[];
  status: 'active' | 'ended' | 'completed' | 'quit';
  nextId: number;
}

function copyTeam(team: TeamRecord): TeamRecord {
  return { ...team, ratings: { ...team.ratings }, kits: { home: [...team.kits.home], away: [...team.kits.away] } };
}
function copyConfig(config: MatchConfig): MatchConfig {
  return { ...config, human: [...config.human], level: [...config.level], ...(config.ratings && { ratings: [{ ...config.ratings[0] }, { ...config.ratings[1] }] }) };
}
function makeMatchId(runId: string, counter: number): string {
  return `${runId.length}:${runId}:${counter}`;
}
export function startCup(selectedTeam: TeamRecord, settings: MatchConfig, runId: string): CupSession {
  if (typeof runId !== 'string' || runId.length === 0) throw new Error('Cup run ID must be a non-empty string');
  return { runId, selectedTeam: copyTeam(selectedTeam), settings: copyConfig(settings), opponents: TEAMS.filter(t => t.id !== selectedTeam.id).map(copyTeam), rung: 0, matchId: makeMatchId(runId, 1), consumedIds: [], status: 'active', nextId: 2 };
}
export function cupMatchConfig(session: CupSession): MatchConfig {
  return { ...copyConfig(session.settings), ratings: [{ ...session.selectedTeam.ratings }, { ...session.opponents[session.rung].ratings }] };
}
export function consumeResult(session: CupSession, matchId: string, result: CupResult): CupSession {
  if (session.status !== 'active' || matchId !== session.matchId || session.consumedIds.includes(matchId)) return session;
  const consumedIds = [...session.consumedIds, matchId];
  if (result !== 'win') return { ...session, consumedIds, status: 'ended' };
  if (session.rung === session.opponents.length - 1) return { ...session, consumedIds, status: 'completed' };
  return { ...session, consumedIds, rung: session.rung + 1, matchId: makeMatchId(session.runId, session.nextId), nextId: session.nextId + 1 };
}
export function retryCup(session: CupSession): CupSession {
  if (session.status !== 'ended') return session;
  return { ...session, status: 'active', matchId: makeMatchId(session.runId, session.nextId), nextId: session.nextId + 1 };
}
export function quitCup(session: CupSession): CupSession {
  return session.status === 'quit' ? session : { ...session, status: 'quit' };
}
