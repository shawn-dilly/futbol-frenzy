import { expect, test } from 'vitest';
import { createMatch, neutralPad } from '../../src/sim/setup';
import { step } from '../../src/sim/step';
import { LEVEL_ORDER } from '../../src/sim/levels';
import type { PadInput } from '../../src/sim/types';
import { matchConfig } from '../helpers';

for (const level of LEVEL_ORDER) test(`seeded human-side support at ${level}`, () => {
  let hits = 0, downs = 0, space = 0, samples = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const s = createMatch(matchConfig({ seed, level: [level, level] }));
    const pads: [PadInput, PadInput] = [neutralPad(), neutralPad()];
    for (let t = 0; t < 3600; t++) {
      step(s, pads);
      for (const e of s.events) if (e.type === 'hit' && s.players[e.tackler].team === 0) {
        hits++;
        if (e.tier !== 'stumble') downs++;
      }
      if (s.phase === 'play' && s.ball.owner === s.controlled[0]) {
        const carrier = s.players[s.ball.owner];
        space += Math.min(...s.players.filter(p => p.team === 1).map(p => Math.hypot(p.pos.x - carrier.pos.x, p.pos.y - carrier.pos.y)));
        samples++;
      }
    }
  }
  if (process.env.BALANCE_REPORT) console.log({ level, hits, downs, meanSpace: space / samples, samples });
  if (level === 'rookie') expect(space / samples).toBeGreaterThan(8);
  expect(downs).toBeGreaterThan(0);
  expect(hits).toBeGreaterThan(0);
});
