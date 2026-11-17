import type { SimEvent } from '../sim';

import { NOISE_SECONDS, SOUNDS, type NoiseSpec, type SfxName, type ToneSpec } from '../content/sounds';

export type { SfxName };

const MASTER_GAIN = 0.3;

/** Maps a sim event to the sound it triggers, or null when it is silent. */
export function sfxForEvent(e: SimEvent): SfxName | null {
  switch (e.type) {
    case 'kick': return e.kind === 'shot' ? 'shot' : 'pass';
    case 'bounce': return 'bounce';
    case 'goal': return 'goal';
    case 'whistle': return 'whistle';
    case 'whiff': return 'whiff';
    case 'hit': return null; // a hit plays several sounds, chosen by tier: see HIT_FEEDBACK
  }
}

/** Synthesised sound effects. Silent until unlock(); never throws. */
export class Sfx {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  /** Context time each sound last played, for the per-sound minimum gap. */
  private readonly lastPlayedS = new Map<SfxName, number>();

  constructor(private readonly makeContext: () => AudioContext = () => new AudioContext()) {}

  /**
   * Call from a user gesture. Creates the context once (never while muted) and asks it to resume;
   * a context that is still not running is asked again on every later call. If creation throws, a later call retries.
   */
  unlock(): void {
    if (this.muted) return;
    if (this.ctx) { if (this.ctx.state !== 'running') this.resume(this.ctx); return; }
    let ctx: AudioContext | null = null;
    try {
      ctx = this.makeContext();
      const master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
      this.ctx = ctx; this.master = master;
      this.resume(ctx);
    } catch {
      this.ctx = null; this.master = null;
      try { void Promise.resolve(ctx?.close()).catch(() => {}); } catch { /* nothing to release */ }
    }
  }

  play(name: SfxName): void {
    const { ctx, master } = this;
    if (this.muted || !ctx || !master || ctx.state !== 'running') return;
    try {
      const spec = SOUNDS[name];
      const now = ctx.currentTime;
      const last = this.lastPlayedS.get(name);
      if (last !== undefined && now - last < spec.minGapS) return;
      this.lastPlayedS.set(name, now);
      for (const tone of spec.tones) this.playTone(ctx, master, now, tone);
      if (spec.noise) this.playNoise(ctx, master, now, spec.noise);
    } catch { /* stay silent */ }
  }

  /** Plays a recorded clip by name; returns false when it is unavailable (always, until clips are added). */
  playClip(_name: string): boolean { return false; }

  private resume(ctx: AudioContext): void {
    try { void Promise.resolve(ctx.resume()).catch(() => {}); } catch { /* stay silent */ }
  }

  private playTone(ctx: AudioContext, out: AudioNode, now: number, t: ToneSpec): void {
    const start = now + t.offsetS;
    const end = start + t.durationS;
    const osc = ctx.createOscillator();
    osc.type = t.wave;
    osc.frequency.setValueAtTime(t.startHz, start);
    osc.frequency.linearRampToValueAtTime(t.endHz, end);
    this.run(ctx, osc, out, start, end, t.attackS, t.peakGain);
  }

  private playNoise(ctx: AudioContext, out: AudioNode, now: number, n: NoiseSpec): void {
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer ??= makeNoise(ctx);
    this.run(ctx, src, out, now, now + n.durationS, n.attackS, n.peakGain);
  }

  /** Routes source through its own envelope gain, plays it for [start, end], then disconnects both nodes. */
  private run(ctx: AudioContext, source: OscillatorNode | AudioBufferSourceNode, out: AudioNode,
    start: number, end: number, attackS: number, peak: number): void {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attackS);
    gain.gain.linearRampToValueAtTime(0, end);
    source.connect(gain); gain.connect(out);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start(start); source.stop(end);
  }
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}
