import { expect, test } from 'vitest';
import { Sfx, sfxForEvent } from '../../src/audio/sfx';

test('event to sound mapping', () => {
  expect(sfxForEvent({ type: 'kick', kind: 'pass', player: 1 })).toBe('pass');
  expect(sfxForEvent({ type: 'kick', kind: 'shot', player: 1 })).toBe('shot');
  expect(sfxForEvent({ type: 'bounce' })).toBe('bounce');
  expect(sfxForEvent({ type: 'goal', team: 0 })).toBe('goal');
  expect(sfxForEvent({ type: 'whistle', what: 'halftime' })).toBe('whistle');
});
test('play before unlock is a silent no-op and creates no context', () => {
  let made = 0; const s = new Sfx(() => { made++; throw new Error('blocked'); });
  expect(() => s.play('goal')).not.toThrow(); expect(made).toBe(0);
});
test('a context that fails to start never throws', () => {
  const s = new Sfx(() => { throw new Error('blocked'); });
  expect(() => { s.unlock(); s.play('pass'); s.unlock(); }).not.toThrow();
});
test('muted play never throws', () => {
  const s = new Sfx(() => { throw new Error('x'); }); s.muted = true;
  expect(() => { s.unlock(); s.play('pass'); }).not.toThrow();
});

/** Minimal stand-in for the parts of AudioContext that Sfx calls. */
function fakeContext() {
  const log = { oscillators: 0, started: 0, stopped: 0, resumed: 0, buffers: 0 };
  const param = () => ({
    value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {},
  });
  const node = () => ({ connect() {}, disconnect() {}, onended: null as null | (() => void) });
  const ctx = {
    currentTime: 0, sampleRate: 8000, destination: {},
    resume() { log.resumed++; return Promise.resolve(); },
    createOscillator() {
      log.oscillators++;
      return { ...node(), type: 'square', frequency: param(), start() { log.started++; }, stop() { log.stopped++; } };
    },
    createGain() { return { ...node(), gain: param() }; },
    createBuffer(_c: number, length: number) { log.buffers++; return { getChannelData: () => new Float32Array(length) }; },
    createBufferSource() {
      return { ...node(), buffer: null, start() { log.started++; }, stop() { log.stopped++; } };
    },
  };
  return { ctx: ctx as unknown as AudioContext, log };
}

test('after unlock, play creates and starts an oscillator', () => {
  const { ctx, log } = fakeContext(); const s = new Sfx(() => ctx);
  s.unlock(); s.play('pass');
  expect(log.resumed).toBe(1);
  expect(log.oscillators).toBeGreaterThanOrEqual(1);
  expect(log.started).toBeGreaterThanOrEqual(1);
  expect(log.stopped).toBe(log.started);
});
test('every sound plays on a fake context, goal includes noise', () => {
  const { ctx, log } = fakeContext(); const s = new Sfx(() => ctx);
  s.unlock();
  for (const n of ['pass', 'shot', 'bounce', 'whistle', 'goal'] as const) s.play(n);
  expect(log.buffers).toBe(1);
  expect(log.oscillators).toBeGreaterThanOrEqual(5);
});
test('unlock is idempotent', () => {
  let made = 0; const { ctx } = fakeContext(); const s = new Sfx(() => { made++; return ctx; });
  s.unlock(); s.unlock(); expect(made).toBe(1);
});
test('muted creates no oscillators', () => {
  const { ctx, log } = fakeContext(); const s = new Sfx(() => ctx);
  s.unlock(); s.muted = true; s.play('pass');
  expect(log.oscillators).toBe(0);
});
test('play before unlock creates no oscillators', () => {
  const { ctx, log } = fakeContext(); const s = new Sfx(() => ctx);
  s.play('pass'); expect(log.oscillators).toBe(0);
});
