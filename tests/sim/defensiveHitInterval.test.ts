import { describe, expect, test } from 'vitest';
import { brainIntent } from '../../src/sim/brain';
import { createMatch, placeForKickoff } from '../../src/sim/setup';
import { LEVELS } from '../../src/sim/levels';
import { matchConfig, runTicks } from '../helpers';

function scene(team: 0 | 1, humanCarrier = false, level: 'rookie' | 'pro' = 'rookie') {
  const s = createMatch(matchConfig({ human: team === 0 ? [false, humanCarrier] : [humanCarrier, false], level: [level, level] }));
  const defender = s.players[team === 0 ? 1 : 6];
  const carrier = s.players[team === 0 ? 9 : 4];
  for (const p of s.players) p.pos = { x: p.team === team ? 40 : 440, y: 20 + p.id * 3 };
  defender.pos = { x: 240, y: 62 }; carrier.pos = { x: 245, y: 62 };
  s.ball.owner = carrier.id; s.ball.pos = { ...carrier.pos };
  return { s, defender, carrier };
}

describe('defensive hit eligibility', () => {
  for (const team of [0, 1] as const) for (const human of [false, true]) {
    test(`team ${team}, ${human ? 'human' : 'CPU'} carrier: boundary and attempt reset`, () => {
      const { s, defender } = scene(team, human);
      const interval = human ? 440 : 240;
      s.liveTicks = interval - 1; s.tick = interval - 1;
      expect(brainIntent(s, defender).hitPress).toBe(false);
      s.liveTicks = interval; s.tick = interval; s.brain[defender.id].thinkAt = interval;
      expect(brainIntent(s, defender).hitPress).toBe(true);
      expect(s.defensiveHitAt[defender.id]).toBe(2 * interval);
      placeForKickoff(s, 0);
      expect(s.liveTicks).toBe(0);
      expect(s.defensiveHitAt[defender.id]).toBe(interval);
    });
  }
  test('an attempt suppresses repeated attempts until the next eligible decision', () => {
    const { s, defender } = scene(1);
    s.liveTicks = 240; s.tick = 240; s.brain[defender.id].thinkAt = 240;
    expect(brainIntent(s, defender).hitPress).toBe(true);
    s.liveTicks = 479; s.tick = 479; s.brain[defender.id].thinkAt = 479;
    expect(brainIntent(s, defender).hitPress).toBe(false);
    s.liveTicks = 480; s.tick = 480; s.brain[defender.id].thinkAt = 480;
    expect(brainIntent(s, defender).hitPress).toBe(true);
  });
  test('knockdown clears brain memory without clearing the hit timer', () => {
    const { s, defender } = scene(1);
    s.phase = 'play'; s.liveTicks = 240; s.tick = 240;
    expect(brainIntent(s, defender).hitPress).toBe(true);
    defender.status = { kind: 'hurt', tier: 'knockdown', variant: 0 };
    defender.statusTick = 0; defender.statusTicks = 10;
    runTicks(s, 1);
    expect(s.defensiveHitAt[defender.id]).toBe(480);
    expect(s.brain[defender.id].thinkAt).toBe(0);
  });
  test('eligibility does not force a think', () => {
    const { s, defender } = scene(1);
    s.liveTicks = 239; s.tick = 239;
    expect(brainIntent(s, defender).hitPress).toBe(false);
    s.liveTicks = 240; s.tick = 240;
    expect(brainIntent(s, defender).hitPress).toBe(false);
    s.liveTicks = 263; s.tick = 263;
    expect(brainIntent(s, defender).hitPress).toBe(true);
  });
  test('kickoff pause does not count as live play', () => {
    const { s } = scene(1);
    runTicks(s, 1);
    expect(s.liveTicks).toBe(0);
    while (s.phase !== 'play') runTicks(s, 1);
    expect(s.liveTicks).toBe(0);
    runTicks(s, 1);
    expect(s.liveTicks).toBe(1);
  });
  test('rookie attacking cadence remains unchanged', () => {
    const { s, carrier } = scene(1);
    brainIntent(s, carrier);
    expect(s.brain[carrier.id].role).toBe('carrier');
    expect(s.brain[carrier.id].thinkAt).toBe(24);
  });
  test('zero interval permits immediate decision and does not delay attacking decisions', () => {
    const { s, defender, carrier } = scene(1, false, 'pro');
    expect(LEVELS.pro.defensiveHitIntervalTicks).toBe(0);
    expect(brainIntent(s, defender).hitPress).toBe(true);
    brainIntent(s, carrier);
    expect(s.brain[carrier.id].thinkAt).toBe(s.tick + LEVELS.pro.reactionTicks);
    expect(s.brain[carrier.id].role).toBe('carrier');
  });
});
