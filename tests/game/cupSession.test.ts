import { describe, expect, it } from 'vitest';
import { startCup, consumeResult, retryCup, quitCup, cupMatchConfig } from '../../src/game/cupSession';
import { TEAMS } from '../../src/content/teams';

const settings = { seed: 3, halfSeconds: 120, human: [true, false] as [boolean, boolean], level: ['pro', 'rookie'] as const };
const start = () => startCup(TEAMS[1], { ...settings, level: [...settings.level] }, 'run');
describe('cup session', () => {
  it('visits every other team in table order and completes once', () => {
    let s = start(); const ids = new Set<string>();
    expect(s.opponents.map(t => t.id)).toEqual(TEAMS.filter(t => t.id !== TEAMS[1].id).map(t => t.id));
    for (const opponent of s.opponents) {
      expect(cupMatchConfig(s).ratings).toEqual([TEAMS[1].ratings, opponent.ratings]);
      ids.add(s.matchId); s = consumeResult(s, s.matchId, 'win');
    }
    expect(s.status).toBe('completed'); expect(ids.size).toBe(5);
    expect(consumeResult(s, s.matchId, 'win')).toEqual(s);
  });
  it.each(['loss', 'draw'] as const)('%s ends and retry uses a fresh id on the same rung', result => {
    const s = start(); const ended = consumeResult(s, s.matchId, result);
    expect(ended.status).toBe('ended'); expect(consumeResult(ended, s.matchId, 'win')).toEqual(ended);
    const retry = retryCup(ended); expect(retry.matchId).not.toBe(s.matchId); expect(retry.rung).toBe(0);
    expect(consumeResult(retry, s.matchId, 'win')).toEqual(retry);
    expect(quitCup(retry).status).toBe('quit'); expect(retryCup(quitCup(retry)).status).toBe('quit');
  });
  it('rejects stale results across runs and encodes arbitrary run identities without collisions', () => {
    const first = start();
    const quit = quitCup(first);
    expect(quit.status).toBe('quit');
    const second = startCup(TEAMS[1], { ...settings, level: [...settings.level] }, 'run:1');
    expect(consumeResult(second, first.matchId, 'win')).toBe(second);
    const advanced = consumeResult(first, first.matchId, 'win');
    expect(consumeResult(advanced, first.matchId, 'win')).toBe(advanced);
    expect(advanced.matchId).not.toBe(second.matchId);
    expect(() => startCup(TEAMS[1], { ...settings, level: [...settings.level] }, '')).toThrow();
  });
  it('copies inputs and resets a new session', () => {
    const team = structuredClone(TEAMS[0]); const config = { ...settings, level: [...settings.level] as ['pro', 'rookie'], human: [...settings.human] as [boolean, boolean] };
    const s = startCup(team, config, 'run'); team.ratings.speed = 0; config.human[0] = false;
    expect(s.selectedTeam.ratings.speed).toBe(TEAMS[0].ratings.speed); expect(s.settings.human[0]).toBe(true);
    const match = cupMatchConfig(s); match.ratings![0].speed = 0; expect(s.selectedTeam.ratings.speed).toBe(TEAMS[0].ratings.speed);
    expect(start()).toEqual(start());
  });
});

it('creates fresh match state for advancement and retry', async () => {
  const { createMatch } = await import('../../src/sim');
  const first = start(); const old = createMatch(cupMatchConfig(first));
  old.stats[0].shots = 7; old.reserves[0] = 0;
  const next = consumeResult(first, first.matchId, 'win');
  const fresh = createMatch(cupMatchConfig(next));
  expect(fresh.stats[0].shots).toBe(0); expect(fresh.reserves).toEqual([3, 3]);
  const retry = retryCup(consumeResult(next, next.matchId, 'loss'));
  expect(createMatch(cupMatchConfig(retry))).toEqual(createMatch(cupMatchConfig(next)));
});
