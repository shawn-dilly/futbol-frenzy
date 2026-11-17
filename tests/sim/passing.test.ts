import { describe, expect, test } from 'vitest';
import { createMatch, neutralPad } from '../../src/sim/setup';
import type { PadInput } from '../../src/sim/types';
import { norm, sub } from '../../src/sim/vec';
import { step } from '../../src/sim/step';
import { runTicks, matchConfig } from '../helpers';

const STRIKER = 4, PASS_RUN_TICKS = 120;
const pad = (o: Partial<PadInput>): PadInput => ({ ...neutralPad(), ...o });

describe('a human can complete a pass after dribbling', () => {
  test.each([30, 60, 120])('dribble %i ticks then pass straight back', dribbleTicks => {
    const s = createMatch(matchConfig({ human: [true, false] }));
    runTicks(s, 60);
    // this test is about passing: the opponents neither tackle nor pick up the ball
    for (const q of s.players) if (q.team === 1) { q.hitCooldown = Infinity; q.kickCooldown = Infinity; }
    runTicks(s, dribbleTicks, [pad({ moveX: 1 }), neutralPad()]);
    expect(s.ball.owner).toBe(STRIKER);
    runTicks(s, 1, [pad({ moveX: -1, pass: true }), neutralPad()]);
    // After the pass the human controls the receiver and runs at the ball.
    for (let i = 0; i < PASS_RUN_TICKS && s.ball.owner === null; i++) {
      const toBall = norm(sub(s.ball.pos, s.players[s.controlled[0]].pos));
      step(s, [pad({ moveX: toBall.x, moveY: toBall.y }), neutralPad()]);
    }
    expect(s.ball.owner).not.toBeNull();
    expect(s.players[s.ball.owner!].team).toBe(0);
  });
});
