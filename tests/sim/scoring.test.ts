import { expect, test } from 'vitest';
import { createMatch, neutralPad } from '../../src/sim/setup';
import { step } from '../../src/sim/step';
import { norm, sub } from '../../src/sim/vec';
import type { MatchState, PadInput } from '../../src/sim/types';
import { runTicks } from '../helpers';

const STRIKER = 4, KEEPER_1 = 5, KEEPER_1_SETTLE_TICKS = 30, MAX_SHOT_TICKS = 120;
const pad = (o: Partial<PadInput>): PadInput => ({ ...neutralPad(), ...o });

/** Team 0 (human) striker holds the ball at `at` in open play; the team-1 keeper settles where its brain puts it. */
function strikerWithBall(at: { x: number; y: number }): MatchState {
  const s = createMatch({ seed: 1, halfSeconds: 120, human: [true, false] });
  runTicks(s, 60);
  s.players[STRIKER].pos = { ...at };
  s.ball.owner = STRIKER; s.ball.ownerTicks = 0; s.ball.passTarget = null;
  // Team-1 outfielders are parked far from the shot so only the keeper can stop it.
  for (const id of [6, 7, 8, 9]) s.players[id].pos = { x: 100, y: 20 + 25 * (id - 6) };
  runTicks(s, KEEPER_1_SETTLE_TICKS);
  return s;
}

/** Shoots with `stick`, then runs up to MAX_SHOT_TICKS; reports whether the keeper held the ball at any point. */
function shootAndWatch(s: MatchState, stick: Partial<PadInput>): boolean {
  let keeperGotBall = false;
  const shot = [pad({ shoot: true, ...stick }), neutralPad()] as [PadInput, PadInput];
  for (let i = 0; i < MAX_SHOT_TICKS && s.score[0] === 0; i++) {
    step(s, i === 0 ? shot : [pad(stick), neutralPad()]);
    if (s.ball.owner === KEEPER_1) keeperGotBall = true;
  }
  return keeperGotBall;
}

test('an angled far-post shot scores', () => {
  const s = strikerWithBall({ x: 400, y: 30 });
  const toFarPost = norm(sub({ x: 480, y: 76 }, s.players[STRIKER].pos));
  shootAndWatch(s, { moveX: toFarPost.x, moveY: toFarPost.y });
  expect(s.score).toEqual([1, 0]);
});
test('a straight central shot is saved by the keeper', () => {
  const s = strikerWithBall({ x: 430, y: 62 });
  const keeperGotBall = shootAndWatch(s, {});
  expect(s.score).toEqual([0, 0]);
  expect(keeperGotBall).toBe(true);
});
