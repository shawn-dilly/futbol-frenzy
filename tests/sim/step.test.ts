import { test, expect } from 'vitest';
import { padToIntent } from '../../src/sim/step';
import { createMatch, neutralPad } from '../../src/sim/setup';
import { runTicks } from '../helpers';
import type { PadInput } from '../../src/sim/types';

const pad = (o: Partial<PadInput>): PadInput => ({ ...neutralPad(), ...o });

for (const button of ['pass', 'shoot', 'turbo'] as const) {
  test(`${button} triggers only on the tick the button goes down`, () => {
    expect(padToIntent(pad({ [button]: true }), pad({ [button]: true }))[button]).toBe(false);
    expect(padToIntent(pad({ [button]: true }), pad({}))[button]).toBe(true);
    expect(padToIntent(pad({}), pad({ [button]: true }))[button]).toBe(false);
  });
}
test('move axes pass through unchanged', () => {
  const i = padToIntent(pad({ moveX: -0.4, moveY: 3 }), pad({}));
  expect(i.moveX).toBe(-0.4); expect(i.moveY).toBe(3);
});

test('step moves a free ball by its velocity', () => {
  const s = createMatch({ seed: 1, halfSeconds: 120, human: [true, false] });
  runTicks(s, 60);
  s.ball.owner = null; s.ball.pos = { x: 240, y: 62 }; s.ball.vel = { x: 60, y: 0 };
  runTicks(s, 1);
  expect(s.ball.pos.x - 240).toBeCloseTo(1, 5);
});
