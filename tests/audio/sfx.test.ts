import { expect, test } from 'vitest';
import { Sfx, sfxForEvent } from '../../src/audio/sfx';
import { SOUNDS } from '../../src/content/sounds';

test('event to sound mapping', () => {
  expect(sfxForEvent({ type: 'kick', kind: 'pass', player: 1 })).toBe('pass');
  expect(sfxForEvent({ type: 'kick', kind: 'shot', player: 1 })).toBe('shot');
  expect(sfxForEvent({ type: 'bounce' })).toBe('bounce');
  expect(sfxForEvent({ type: 'goal', team: 0 })).toBe('goal');
  expect(sfxForEvent({ type: 'whistle', what: 'halftime' })).toBe('whistle');
  expect(sfxForEvent({ type: 'whiff', player: 3, hit: 'shoulder' })).toBe('whiff');
});
test('a hit has no single sound: its sounds come from HIT_FEEDBACK', () => {
  expect(sfxForEvent({ type: 'hit', tackler: 1, victim: 2, hit: 'big', tier: 'wipeout', variant: 0, damage: 30, late: false })).toBeNull();
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

interface FakeOptions { startState?: string; rejectResume?: boolean }

/** Minimal stand-in for the parts of AudioContext that Sfx calls. */
function fakeContext({ startState = 'suspended', rejectResume = false }: FakeOptions = {}) {
  const log = { oscillators: 0, started: 0, stopped: 0, resumed: 0, buffers: 0, nodes: 0, disconnected: 0, sources: [] as Array<{ onended: null | (() => void) }>, closed: 0 };
  const param = () => ({
    value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {},
  });
  const node = () => {
    log.nodes++;
    const n = { connect() {}, disconnect() { log.disconnected++; }, onended: null as null | (() => void) };
    log.sources.push(n);
    return n;
  };
  const ctx = {
    state: startState, currentTime: 0, sampleRate: 8000, destination: {},
    resume() {
      log.resumed++;
      if (rejectResume) return Promise.reject(new Error('blocked'));
      ctx.state = 'running'; return Promise.resolve();
    },
    close() { log.closed++; return Promise.resolve(); },
    createOscillator() {
      log.oscillators++;
      return Object.assign(node(), { type: 'square', frequency: param(), start() { log.started++; }, stop() { log.stopped++; } });
    },
    createGain() { return Object.assign(node(), { gain: param() }); },
    createBuffer(_c: number, length: number) { log.buffers++; return { getChannelData: () => new Float32Array(length) }; },
    createBufferSource() {
      return Object.assign(node(), { buffer: null, start() { log.started++; }, stop() { log.stopped++; } });
    },
  };
  return { ctx: ctx as unknown as AudioContext, log };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test('after unlock, play creates and starts an oscillator', () => {
  const { ctx, log } = fakeContext(); const s = new Sfx(() => ctx);
  s.unlock(); s.play('pass');
  expect(log.resumed).toBe(1);
  expect(log.oscillators).toBeGreaterThanOrEqual(1);
  expect(log.started).toBeGreaterThanOrEqual(1);
  expect(log.stopped).toBe(log.started);
});
test('goal plays exactly three tones, and its noise buffer is built once', () => {
  const { ctx, log } = fakeContext(); const s = new Sfx(() => ctx);
  s.unlock(); s.play('goal');
  (ctx as { currentTime: number }).currentTime = SOUNDS.goal.minGapS; // past the minimum gap
  s.play('goal');
  expect(log.oscillators).toBe(6);
  expect(log.buffers).toBe(1);
});
test('each sound creates its tones', () => {
  const counts = { pass: 1, shot: 1, bounce: 1, whistle: 2, goal: 3, thud: 1, grunt: 1, crunch: 1, ooh: 1, gasp: 1, whiff: 1, charge: 1 };
  for (const [name, n] of Object.entries(counts)) {
    const { ctx, log } = fakeContext(); const s = new Sfx(() => ctx);
    s.unlock(); s.play(name as keyof typeof counts);
    expect(log.oscillators, name).toBe(n);
  }
});
test('nodes are disconnected when their source ends', () => {
  const { ctx, log } = fakeContext(); const s = new Sfx(() => ctx);
  s.unlock(); s.play('pass');
  expect(log.disconnected).toBe(0);
  log.sources.forEach((n) => n.onended?.());
  expect(log.disconnected).toBe(2); // oscillator and its envelope gain
});
test('unlock creates the context once across several unlocks', () => {
  let made = 0; const { ctx } = fakeContext(); const s = new Sfx(() => { made++; return ctx; });
  s.unlock(); s.unlock(); s.unlock(); expect(made).toBe(1);
});
test('a suspended context whose resume rejects stays silent without throwing', async () => {
  const { ctx, log } = fakeContext({ rejectResume: true }); const s = new Sfx(() => ctx);
  expect(() => { s.unlock(); s.play('goal'); }).not.toThrow();
  await flush();
  expect(log.oscillators).toBe(0); expect(log.nodes).toBe(1); // only the master gain
});
test('a later unlock resumes a suspended context again, then sound plays', () => {
  const { ctx, log } = fakeContext(); let allow = false;
  const real = ctx.resume.bind(ctx);
  ctx.resume = () => { if (!allow) { log.resumed++; return Promise.resolve(); } return real(); };
  const s = new Sfx(() => ctx);
  s.unlock(); s.play('pass'); expect(log.oscillators).toBe(0);
  allow = true; s.unlock(); expect(log.resumed).toBe(2);
  s.play('pass'); expect(log.oscillators).toBe(1);
});
test('muted unlock creates no context; unmuting then unlocking creates one', () => {
  let made = 0; const { ctx } = fakeContext(); const s = new Sfx(() => { made++; return ctx; });
  s.muted = true; s.unlock(); expect(made).toBe(0);
  s.muted = false; s.unlock(); expect(made).toBe(1);
});
test('muted play creates no oscillators', () => {
  const { ctx, log } = fakeContext(); const s = new Sfx(() => ctx);
  s.unlock(); s.muted = true; s.play('pass');
  expect(log.oscillators).toBe(0);
});
test('play before unlock creates no oscillators', () => {
  const { ctx, log } = fakeContext(); const s = new Sfx(() => ctx);
  s.play('pass'); expect(log.oscillators).toBe(0);
});
test('a context left over from a failed setup is closed, and unlock can retry', () => {
  const { ctx, log } = fakeContext();
  ctx.createGain = () => { throw new Error('boom'); };
  let made = 0; const s = new Sfx(() => { made++; return ctx; });
  expect(() => s.unlock()).not.toThrow();
  expect(log.closed).toBe(1);
  s.unlock(); expect(made).toBe(2);
});

test('playClip is the hook for recorded lines: no clips exist yet, so it reports false and stays silent', () => {
  const s = new Sfx(() => { throw new Error('x'); });
  expect(s.playClip('crunch')).toBe(false);
});

test('a sound requested again inside its minimum gap makes no nodes; after the gap it plays', () => {
  const { ctx, log } = fakeContext({ startState: 'running' }); const s = new Sfx(() => ctx);
  s.unlock();
  const gap = SOUNDS.grunt.minGapS;
  (ctx as { currentTime: number }).currentTime = 10;
  s.play('grunt'); expect(log.oscillators).toBe(1);
  (ctx as { currentTime: number }).currentTime = 10 + gap / 2;
  s.play('grunt'); expect(log.oscillators).toBe(1);
  s.play('thud'); expect(log.oscillators).toBe(2); // a different sound is not blocked
  (ctx as { currentTime: number }).currentTime = 10 + gap;
  s.play('grunt'); expect(log.oscillators).toBe(3);
});
test('every sound has a positive minimum gap', () => {
  for (const [name, spec] of Object.entries(SOUNDS)) expect(spec.minGapS, name).toBeGreaterThan(0);
});
