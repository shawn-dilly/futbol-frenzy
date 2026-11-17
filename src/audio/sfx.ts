import type { SimEvent } from '../sim';

export type SfxName = 'pass' | 'shot' | 'bounce' | 'whistle' | 'goal';

/** One oscillator note: pitch glides from startHz to endHz over durationS, starting offsetS after play(). */
interface ToneSpec {
  wave: OscillatorType;
  startHz: number; endHz: number;
  offsetS: number; durationS: number;
  attackS: number; peakGain: number;
}
/** A burst of white noise with a rise-and-fall envelope. */
interface NoiseSpec { durationS: number; attackS: number; peakGain: number }
interface SoundSpec { tones: ToneSpec[]; noise?: NoiseSpec }

const MASTER_GAIN = 0.3;
const ATTACK_S = 0.005;

const ARPEGGIO_HZ = [262, 330, 392]; // C4 E4 G4
const ARPEGGIO_STEP_S = 0.12;
const WHISTLE_HZ = 1800;

const SOUNDS: Record<SfxName, SoundSpec> = {
  // Short low square blip.
  pass: { tones: [{ wave: 'square', startHz: 330, endHz: 300, offsetS: 0, durationS: 0.08, attackS: ATTACK_S, peakGain: 0.6 }] },
  // Lower, longer, punchier thump with a fast pitch drop.
  shot: { tones: [{ wave: 'square', startHz: 220, endHz: 60, offsetS: 0, durationS: 0.16, attackS: ATTACK_S, peakGain: 1 }] },
  // Soft, very short high tick.
  bounce: { tones: [{ wave: 'triangle', startHz: 700, endHz: 500, offsetS: 0, durationS: 0.04, attackS: 0.002, peakGain: 0.4 }] },
  // Two high chirps.
  whistle: {
    tones: [0, 0.2].map((offsetS) => (
      { wave: 'square', startHz: WHISTLE_HZ, endHz: WHISTLE_HZ * 1.2, offsetS, durationS: 0.14, attackS: ATTACK_S, peakGain: 0.5 } as ToneSpec
    )),
  },
  // Rising three-note arpeggio over a one-second crowd swell.
  goal: {
    tones: ARPEGGIO_HZ.map((hz, i) => (
      { wave: 'square', startHz: hz, endHz: hz, offsetS: i * ARPEGGIO_STEP_S, durationS: 0.2, attackS: ATTACK_S, peakGain: 0.6 } as ToneSpec
    )),
    noise: { durationS: 1, attackS: 0.7, peakGain: 0.5 },
  },
};

const NOISE_SECONDS = Math.max(...Object.values(SOUNDS).map((s) => s.noise?.durationS ?? 0));

/** Maps a sim event to the sound it triggers, or null when it is silent. */
export function sfxForEvent(e: SimEvent): SfxName | null {
  switch (e.type) {
    case 'kick': return e.kind === 'shot' ? 'shot' : 'pass';
    case 'bounce': return 'bounce';
    case 'goal': return 'goal';
    case 'whistle': return 'whistle';
  }
}

/** Synthesised sound effects. Silent until unlock(); never throws. */
export class Sfx {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

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
      for (const tone of spec.tones) this.playTone(ctx, master, now, tone);
      if (spec.noise) this.playNoise(ctx, master, now, spec.noise);
    } catch { /* stay silent */ }
  }

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
