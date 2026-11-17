import { test, expect, beforeEach } from 'vitest';
import { createMatch, neutralPad } from '../../src/sim/setup';
import { pickPassTarget, updatePossession } from '../../src/sim/possession';
import { len } from '../../src/sim/vec';
import type { MatchState, PadInput } from '../../src/sim/types';
import { runTicks, matchConfig } from '../helpers';

const pad = (o: Partial<PadInput>): PadInput => ({ ...neutralPad(), ...o });
let s: MatchState;
beforeEach(() => {
  s = createMatch(matchConfig({ human: [true, true] }));
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
  expect(s.players[4].status).toEqual({ kind: 'kicking' }); expect(s.players[4].statusTicks).toBe(12);
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

function freeBallAt(player: number, speed: number): void {
  const p = s.players[player];
  s.ball.owner = null; s.ball.passTarget = null;
  s.ball.pos = { x: p.pos.x + 2, y: p.pos.y }; s.ball.vel = { x: speed, y: 0 };
  s.players.forEach(o => { o.kickCooldown = 0; });
}
test('an outfield player cannot trap a ball moving at shot speed', () => {
  freeBallAt(9, 220); updatePossession(s);
  expect(s.ball.owner).toBeNull();
});
test('an outfield player can trap a ball moving at pass speed', () => {
  freeBallAt(9, 150); updatePossession(s);
  expect(s.ball.owner).toBe(9);
});
test('a keeper can trap a ball moving at shot speed', () => {
  freeBallAt(5, 220); updatePossession(s);
  expect(s.ball.owner).toBe(5);
});
test('the pickup speed limit is inclusive: 170 is trapped, 171 is not', () => {
  freeBallAt(9, 170); updatePossession(s); expect(s.ball.owner).toBe(9);
  freeBallAt(9, 171); updatePossession(s); expect(s.ball.owner).toBeNull();
});
test('a kicking status ends 12 ticks after the kick and the player is free again', () => {
  runTicks(s, 1, [pad({ pass: true }), neutralPad()]);
  runTicks(s, 11);
  expect(s.players[4].status.kind).toBe('kicking');
  runTicks(s, 1);
  expect(s.players[4].status).toEqual({ kind: 'free' });
});
