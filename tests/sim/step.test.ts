import { test, expect } from 'vitest';
import { padToIntent } from '../../src/sim/step';
import { createMatch, neutralPad } from '../../src/sim/setup';
import { runTicks, matchConfig } from '../helpers';
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
  const s = createMatch(matchConfig({ human: [true, false] }));
  runTicks(s, 60);
  s.ball.owner = null; s.ball.pos = { x: 300, y: 40 }; s.ball.vel = { x: 60, y: 0 };
  runTicks(s, 1);
  expect(s.ball.owner).toBeNull();
  expect(s.ball.pos.x).toBeCloseTo(301, 5);
  expect(s.ball.vel.x).toBeCloseTo(60 * 0.985, 5);
});
test('hitPress is true only on the tick HIT goes down; hitHeld follows the button', () => {
  const down = padToIntent(pad({ hit: true }), pad({}));
  expect([down.hitPress, down.hitHeld]).toEqual([true, true]);
  const held = padToIntent(pad({ hit: true }), pad({ hit: true }));
  expect([held.hitPress, held.hitHeld]).toEqual([false, true]);
  const up = padToIntent(pad({}), pad({ hit: true }));
  expect([up.hitPress, up.hitHeld]).toEqual([false, false]);
});
