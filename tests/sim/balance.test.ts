import { expect, test } from 'vitest';
import { createMatch, goalCenter, neutralPad } from '../../src/sim/setup';
import { step } from '../../src/sim/step';
import { isDazed } from '../../src/sim/status';
import { LEVEL_ORDER } from '../../src/sim/levels';
import type { HurtTier, MatchConfig, PadInput } from '../../src/sim/types';
import { matchConfig } from '../helpers';
import { median, PossessionEpisodes } from './possessionEpisodes';

/** Measure a deterministic full match; dazed counts transitions into the condition. */
function playMatch(config: MatchConfig, reserves = 3) {
  const state = createMatch(config);
  state.reserves = [reserves, reserves];
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

test('M3 and M4 balance contracts', () => {
  const goalBands = [[1, 5], [2, 7], [2, 8], [3, 10]];
  const hitBands = [[8, 25], [15, 40], [30, 70], [45, 110]];
  const blocks = [[1,2,3,4,5,6,7,8,9,10], [11,12,13,14,15,16,17,18,19,20]];
  const mirrors = [0, 3].flatMap(reserves => blocks.map(seeds => ({ reserves, seeds,
    rows: LEVEL_ORDER.map(level => {
      const matches = seeds.map(seed => playMatch(matchConfig({ seed, human: [false, false], level: [level, level] }), reserves));
      return { level, goals: avg(matches.map(m => m.goals[0] + m.goals[1])), hits: avg(matches.map(totalHits)), nil: matches.filter(m => m.goals[0] + m.goals[1] === 0).length, rage: [0, 1].map(t => avg(matches.map(m => m.rage[t] / m.playTicks))), shots: avg(matches.map(m => m.shots)), dazed: avg(matches.map(m => m.dazed)) };
    })
  })));
  const matchups = blocks.flatMap(seeds => (['psycho', 'pro'] as const).map(level => {
    let wins = 0, losses = 0;
    for (const seed of seeds) {
      const team = seed % 2 as 0 | 1;
      const levels: MatchConfig['level'] = team === 0 ? [level, 'rookie'] : ['rookie', level];
      const m = playMatch(matchConfig({ seed, human: [false, false], level: levels }));
      if (m.goals[team] > m.goals[1 - team]) wins++;
      if (m.goals[team] < m.goals[1 - team]) losses++;
    }
    return { seeds, level, wins, losses };
  }));
  const possessions = [[1,2,3], [4,5,6]].map(seeds => ({ seeds, rows: LEVEL_ORDER.map(level => {
    const matches = seeds.map(seed => ({ seed, episodes: playMatch(matchConfig({ seed, level: ['pro', level] })).possession }));
    const completed = matches.flatMap(m => m.episodes.filter(e => !e.censored).map(e => e.ticks));
    return { level, median: median(completed), count: completed.length, matches };
  }) }));
  if (process.env.BALANCE_REPORT) console.log(JSON.stringify({ mirrors, matchups, possessions }, null, 2));
  for (const { reserves, seeds, rows } of mirrors) rows.forEach((row, i) => {
    const label = `reserves ${reserves}, seeds ${seeds[0]}–${seeds[seeds.length - 1]}, ${row.level}`;
    expect.soft(row.goals, `${label} goals minimum`).toBeGreaterThanOrEqual(goalBands[i][0]);
    expect.soft(row.goals, `${label} goals maximum`).toBeLessThanOrEqual(reserves ? 12 : goalBands[i][1]);
    expect.soft(row.hits, `${label} hits minimum`).toBeGreaterThanOrEqual(hitBands[i][0]);
    expect.soft(row.hits, `${label} hits maximum`).toBeLessThanOrEqual(reserves ? 120 : hitBands[i][1]);
    expect.soft(row.nil, `${label} nil`).toBeLessThanOrEqual(3);
    row.rage.forEach((value, team) => expect.soft(value, `${label} rage team ${team}`).toBeLessThan(0.6));
    if (i) expect.soft(row.hits, `${label} aggression ordering`).toBeGreaterThan(rows[i - 1].hits);
  });
  for (const m of matchups) {
    const label = `${m.level}, seeds ${m.seeds[0]}–${m.seeds[9]}`;
    if (m.level === 'psycho') expect.soft(m.wins, `${label} wins`).toBeGreaterThanOrEqual(7);
    else expect.soft(m.losses, `${label} losses`).toBeLessThanOrEqual(3);
  }
  for (const p of possessions) {
    expect.soft(p.rows[0].median, `rookie possession seeds ${p.seeds}`).toBeGreaterThanOrEqual(240);
    expect.soft(p.rows[3].median, `psycho possession seeds ${p.seeds}`).toBeLessThanOrEqual(150);
  }
}, 600000);
