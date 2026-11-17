import { test, expect } from 'vitest';
import { createMatch } from '../../src/sim/setup';
import { moveFreeBall } from '../../src/sim/ball';
import { runTicks } from '../helpers';

const cfg = { seed: 1, halfSeconds: 120, human: [true, false] as [boolean, boolean] };
const freeBall = () => {
  const s = createMatch(cfg); runTicks(s, 60);
  expect(s.phase).toBe('play'); s.ball.owner = null; return s;
};

test('friction slows the ball to a full stop', () => {
  const s = freeBall();
  s.ball.pos = { x: 240, y: 62 }; s.ball.vel = { x: 150, y: 0 };
  for (let i = 0; i < 600; i++) moveFreeBall(s);
  expect(s.ball.vel).toEqual({ x: 0, y: 0 });
  expect(s.ball.pos.x).toBeGreaterThan(300); expect(s.ball.pos.x).toBeLessThan(420);
});
test('bounces off the top wall and loses speed', () => {
  const s = freeBall();
  s.ball.pos = { x: 240, y: 4 }; s.ball.vel = { x: 0, y: -120 };
  for (let i = 0; i < 5; i++) moveFreeBall(s);
  expect(s.ball.vel.y).toBeGreaterThan(0); expect(s.ball.vel.y).toBeLessThan(120 * 0.7 + 0.01);
  expect(s.ball.pos.y).toBeGreaterThanOrEqual(2);
  expect(s.events.some(e => e.type === 'bounce')).toBe(true);
});
test('straight shot into the right goal scores for team 0', () => {
  const s = freeBall();
  s.ball.pos = { x: 478, y: 62 }; s.ball.vel = { x: 220, y: 0 };
  expect(moveFreeBall(s)).toBe(0);
});
test('shot into the left goal scores for team 1', () => {
  const s = freeBall();
  s.ball.pos = { x: 2, y: 70 }; s.ball.vel = { x: -220, y: 0 };
  expect(moveFreeBall(s)).toBe(1);
});
test('fast diagonal that crosses the line just outside the post bounces', () => {
  const s = freeBall();
  s.ball.pos = { x: 478, y: 84 }; s.ball.vel = { x: 200, y: -90 }; // crosses near y ≈ 83.1, post is at 78
  expect(moveFreeBall(s)).toBeNull();
  expect(s.ball.pos.x).toBeLessThanOrEqual(480); expect(s.ball.vel.x).toBeLessThan(0);
});
test('fast diagonal that crosses the line just inside the post is a goal', () => {
  const s = freeBall();
  s.ball.pos = { x: 478, y: 79.5 }; s.ball.vel = { x: 200, y: -180 }; // crosses near y ≈ 77.7
  expect(moveFreeBall(s)).toBe(0);
});
test('a ball fired into a corner stays on the pitch and keeps moving', () => {
  const s = freeBall();
  s.ball.pos = { x: 476, y: 4 }; s.ball.vel = { x: 220, y: -220 };
  for (let i = 0; i < 30; i++) {
    expect(moveFreeBall(s)).toBeNull();
    expect(s.ball.pos.x).toBeGreaterThanOrEqual(0); expect(s.ball.pos.x).toBeLessThanOrEqual(480);
    expect(s.ball.pos.y).toBeGreaterThanOrEqual(2); expect(s.ball.pos.y).toBeLessThanOrEqual(122);
  }
  expect(s.ball.pos.x).toBeLessThan(470);
});
test('an owned ball is left alone', () => {
  const s = freeBall();
  s.ball.owner = 4; s.ball.vel = { x: 100, y: 0 }; const p = { ...s.ball.pos };
  expect(moveFreeBall(s)).toBeNull(); expect(s.ball.pos).toEqual(p);
});
test('a ball already beyond an end line is put back on the line with no goal and no NaN', () => {
  const s = freeBall();
  s.ball.pos = { x: 481.3, y: 62 }; s.ball.vel = { x: 0, y: 0 };
  expect(moveFreeBall(s)).toBeNull();
  expect(s.ball.pos.x).toBeLessThanOrEqual(480);
  for (const v of [s.ball.pos.x, s.ball.pos.y, s.ball.vel.x, s.ball.vel.y]) expect(Number.isNaN(v)).toBe(false);
});
