import { test, expect, beforeEach } from 'vitest';
import { createMatch, neutralPad } from '../../src/sim/setup';
import { pickPassTarget } from '../../src/sim/possession';
import { len } from '../../src/sim/vec';
import type { MatchState, PadInput } from '../../src/sim/types';
import { runTicks } from '../helpers';

const pad = (o: Partial<PadInput>): PadInput => ({ ...neutralPad(), ...o });
let s: MatchState;
beforeEach(() => {
  s = createMatch({ seed: 1, halfSeconds: 120, human: [true, false] });
  runTicks(s, 60);
});

test('the ball is carried 7 units ahead of the owner', () => {
  runTicks(s, 30, [pad({ moveX: 1 }), neutralPad()]);
  expect(s.ball.owner).toBe(4);
  expect(s.ball.pos.x - s.players[4].pos.x).toBeCloseTo(7, 5);
});
test('pass with no stick goes to the nearest teammate and leaves the passer', () => {
  runTicks(s, 1, [pad({ pass: true }), neutralPad()]);
  expect(s.ball.owner).toBeNull();
  expect(len(s.ball.vel)).toBeCloseTo(150 * 0.985, 0);
  expect(s.events).toContainEqual({ type: 'kick', kind: 'pass', player: 4 });
  expect(s.players[4].anim).toBe('kick');
});
test('pass with the stick up-left picks the teammate in that direction', () => {
  expect(pickPassTarget(s, s.players[4], { x: -1, y: -0.6 })).toBe(2);
  expect(pickPassTarget(s, s.players[4], { x: -1, y: 0.6 })).toBe(3);
  expect(pickPassTarget(s, s.players[4], { x: 1, y: 0 })).toBe(2);
});
test('a completed pass gives the receiver the ball and control', () => {
  runTicks(s, 1, [pad({ moveX: -1, moveY: -0.6, pass: true }), neutralPad()]);
  expect(s.ball.passTarget).toBe(2); expect(s.controlled[0]).toBe(2);
  runTicks(s, 90);
  expect(s.ball.owner).toBe(2); expect(s.ball.passTarget).toBeNull();
});
test('the passer cannot re-collect for 15 ticks', () => {
  runTicks(s, 1, [pad({ pass: true }), neutralPad()]);
  expect(s.players[4].kickCooldown).toBe(15);
  runTicks(s, 3); expect(s.ball.owner).not.toBe(4);
});
test('shoot with no stick aims at the opponent goal centre at 220', () => {
  runTicks(s, 1, [pad({ shoot: true }), neutralPad()]);
  expect(s.ball.vel.x).toBeGreaterThan(200); expect(Math.abs(s.ball.vel.y)).toBeLessThan(5);
  expect(s.events).toContainEqual({ type: 'kick', kind: 'shot', player: 4 });
});
test('holding pass does not fire twice', () => {
  runTicks(s, 1, [pad({ moveX: -1, moveY: -0.6, pass: true }), neutralPad()]);
  runTicks(s, 120, [pad({ pass: true }), neutralPad()]);
  expect(s.ball.owner).toBe(2);
});
test('pass without the ball switches control to the outfield teammate nearest the ball', () => {
  s.ball.owner = null; s.ball.pos = { x: 150, y: 30 }; s.ball.vel = { x: 0, y: 0 }; s.players[2].kickCooldown = 999;
  runTicks(s, 1, [pad({ pass: true }), neutralPad()]);
  expect(s.controlled[0]).toBe(2);
});
test('a carried ball pushed against the goal line does not score or leave the pitch', () => {
  s.players[4].pos = { x: 474, y: 62 };
  runTicks(s, 60, [pad({ moveX: 1 }), neutralPad()]);
  expect(s.ball.pos.x).toBeLessThanOrEqual(478); expect(s.score).toEqual([0, 0]);
});
test('equal angles inside the cone go to the nearer teammate', () => {
  expect(pickPassTarget(s, s.players[4], { x: -1, y: 0 })).toBe(1);
});
test('equal angles with the nearer teammate on the lower id still pick the nearer', () => {
  expect(pickPassTarget(s, s.players[0], { x: 1, y: 0 })).toBe(1);
});
