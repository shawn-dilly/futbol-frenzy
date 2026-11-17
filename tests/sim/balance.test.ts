import { expect, test } from 'vitest';
import { createMatch, goalCenter, neutralPad } from '../../src/sim/setup';
import { step } from '../../src/sim/step';
import { isDazed } from '../../src/sim/status';
import { LEVEL_ORDER } from '../../src/sim/levels';
import type { HurtTier, MatchConfig, PadInput } from '../../src/sim/types';
import { matchConfig } from '../helpers';
import { median, PossessionEpisodes } from './possessionEpisodes';

/** Measure a deterministic full match; dazed counts transitions into the condition. */
function playMatch(config: MatchConfig) {
  const state = createMatch(config);
  const hits: Record<HurtTier, number> = { stumble: 0, knockdown: 0, wipeout: 0, overTheTop: 0 };
  const rage = [0, 0], possession = new PossessionEpisodes();
  let shots = 0, dazed = 0, playTicks = 0;
  for (let tick = 0; tick < 40000 && state.phase !== 'fulltime'; tick++) {
    const before = state.players.map(isDazed);
    const playing = state.phase === 'play';
    const p = state.players[state.controlled[0]];
    const target = state.ball.owner === p.id ? goalCenter(1) : state.ball.pos;
    const pad: PadInput = { ...neutralPad(), moveX: target.x - p.pos.x, moveY: target.y - p.pos.y };
    step(state, [config.human[0] ? pad : neutralPad(), neutralPad()]);
    if (playing) {
      playTicks++;
      for (let team = 0; team < 2; team++) if (state.rage[team] >= 80) rage[team]++;

    }
    possession.observe(state, playing);
    dazed += state.players.filter((player, i) => !before[i] && isDazed(player)).length;
    for (const event of state.events) {
      if (event.type === 'hit') hits[event.tier]++;
      if (event.type === 'kick' && event.kind === 'shot') shots++;
    }
  }
  if (state.phase !== 'fulltime') throw new Error('Match did not finish');
  return { hits, goals: state.score, shots, rage, playTicks, dazed, possession: possession.episodes };
}

const totalHits = (m: ReturnType<typeof playMatch>) => Object.values(m.hits).reduce((a, b) => a + b, 0);
const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

test('seeded mirror matches meet balance bands', () => {
  const goalBands = [[1, 5], [2, 7], [2, 8], [3, 10]];
  const hitBands = [[8, 25], [15, 40], [30, 70], [45, 110]];
  const rows = LEVEL_ORDER.map(level => {
    const matches = Array.from({ length: 10 }, (_, i) => playMatch(matchConfig({ seed: i + 1, human: [false, false], level: [level, level] })));
    return { level, goals: avg(matches.map(m => m.goals[0] + m.goals[1])), hits: avg(matches.map(totalHits)), nil: matches.filter(m => m.goals[0] + m.goals[1] === 0).length, rage: [0, 1].map(t => avg(matches.map(m => m.rage[t] / m.playTicks))), shots: avg(matches.map(m => m.shots)), dazed: avg(matches.map(m => m.dazed)) };
  });
  if (process.env.BALANCE_REPORT) console.table(rows);
  rows.forEach((row, i) => {
    expect(row.goals).toBeGreaterThanOrEqual(goalBands[i][0]); expect(row.goals).toBeLessThanOrEqual(goalBands[i][1]);
    expect(row.hits).toBeGreaterThanOrEqual(hitBands[i][0]); expect(row.hits).toBeLessThanOrEqual(hitBands[i][1]);
    expect(row.nil).toBeLessThanOrEqual(3); row.rage.forEach(value => expect(value).toBeLessThan(0.6));
    if (i) expect(row.hits).toBeGreaterThan(rows[i - 1].hits);
  });
}, 120000);

test.each(['psycho', 'pro'] as const)('%s competes against rookie', level => {
  let wins = 0, losses = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const team = seed % 2 as 0 | 1;
    const levels: MatchConfig['level'] = team === 0 ? [level, 'rookie'] : ['rookie', level];
    const m = playMatch(matchConfig({ seed, human: [false, false], level: levels }));
    if (m.goals[team] > m.goals[1 - team]) wins++;
    if (m.goals[team] < m.goals[1 - team]) losses++;
  }
  if (process.env.BALANCE_REPORT) console.log(level, { wins, losses });
  if (level === 'psycho') expect(wins).toBeGreaterThanOrEqual(7);
  else expect(losses).toBeLessThanOrEqual(3);
}, 120000);

test('naive human possession differs by opponent level', () => {
  const rows = LEVEL_ORDER.map(level => {
    const seeds = [1, 2, 3].map(seed => ({ seed, episodes: playMatch(matchConfig({ seed, level: ['pro', level] })).possession }));
    const completed = seeds.flatMap(s => s.episodes.filter(e => !e.censored).map(e => e.ticks));
    return { level, median: median(completed), count: completed.length, seeds };
  });
  if (process.env.BALANCE_REPORT) console.log(JSON.stringify(rows));
  expect(rows[0].median).toBeGreaterThanOrEqual(240);
  expect(rows[3].median).toBeLessThanOrEqual(150);
}, 120000);
