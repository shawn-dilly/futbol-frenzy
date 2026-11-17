export type SfxName =
  | 'pass' | 'shot' | 'bounce' | 'whistle' | 'goal'
  | 'thud' | 'grunt' | 'crunch' | 'ooh' | 'gasp' | 'whiff' | 'charge';

/** One oscillator note: pitch glides from startHz to endHz over durationS, starting offsetS after play(). */
export interface ToneSpec {
  wave: OscillatorType;
  startHz: number; endHz: number;
  offsetS: number; durationS: number;
  attackS: number; peakGain: number;
}
/** A burst of white noise with a rise-and-fall envelope. */
export interface NoiseSpec { durationS: number; attackS: number; peakGain: number }
/** `minGapS`: a request for this sound within that many seconds of its last play is ignored, so rapid events never stack into noise. */
export interface SoundSpec { tones: ToneSpec[]; noise?: NoiseSpec; minGapS: number }

const ATTACK_S = 0.005;

const ARPEGGIO_HZ = [262, 330, 392]; // C4 E4 G4
const ARPEGGIO_STEP_S = 0.12;
const WHISTLE_HZ = 1800;

const tone = (wave: OscillatorType, startHz: number, endHz: number, durationS: number, peakGain: number, attackS = ATTACK_S): ToneSpec =>
  ({ wave, startHz, endHz, offsetS: 0, durationS, attackS, peakGain });

export const SOUNDS: Record<SfxName, SoundSpec> = {
  // Short low square blip.
  pass: { tones: [tone('square', 330, 300, 0.08, 0.6)], minGapS: 0.05 },
  // Lower, longer, punchier thump with a fast pitch drop.
  shot: { tones: [tone('square', 220, 60, 0.16, 1)], minGapS: 0.05 },
  // Soft, very short high tick.
  bounce: { tones: [tone('triangle', 700, 500, 0.04, 0.4, 0.002)], minGapS: 0.03 },
  // Two high chirps.
  whistle: {
    tones: [0, 0.2].map((offsetS) => ({ ...tone('square', WHISTLE_HZ, WHISTLE_HZ * 1.2, 0.14, 0.5), offsetS })),
    minGapS: 0.3,
  },
  // Rising three-note arpeggio over a one-second crowd swell.
  goal: {
    tones: ARPEGGIO_HZ.map((hz, i) => ({ ...tone('square', hz, hz, 0.2, 0.6), offsetS: i * ARPEGGIO_STEP_S })),
    noise: { durationS: 1, attackS: 0.7, peakGain: 0.5 },
    minGapS: 1,
  },
  // Low sine drop with a short noise slap: a body hitting the ground.
  thud: { tones: [tone('sine', 120, 50, 0.12, 1)], noise: { durationS: 0.05, attackS: ATTACK_S, peakGain: 0.4 }, minGapS: 0.08 },
  // Short growl: falling sawtooth.
  grunt: { tones: [tone('sawtooth', 140, 90, 0.15, 0.5)], minGapS: 0.15 },
  // Noise burst plus a falling square: something breaking.
  crunch: { tones: [tone('square', 200, 60, 0.1, 0.5)], noise: { durationS: 0.12, attackS: ATTACK_S, peakGain: 0.8 }, minGapS: 0.1 },
  // Crowd "ooh": a 0.6 s noise swell under a falling tone.
  ooh: { tones: [tone('sine', 500, 300, 0.6, 0.3, 0.2)], noise: { durationS: 0.6, attackS: 0.3, peakGain: 0.25 }, minGapS: 0.6 },
  // Crowd gasp: a 0.9 s noise swell under a rising tone.
  gasp: { tones: [tone('sine', 300, 600, 0.9, 0.3, 0.5)], noise: { durationS: 0.9, attackS: 0.6, peakGain: 0.3 }, minGapS: 0.9 },
  // Quick high swish of a missed tackle.
  whiff: { tones: [tone('triangle', 2400, 1200, 0.08, 0.15, 0.02)], noise: { durationS: 0.08, attackS: 0.02, peakGain: 0.3 }, minGapS: 0.1 },
  // Rising tone while a big hit charges.
  charge: { tones: [tone('sine', 200, 800, 0.5, 0.3, 0.05)], minGapS: 0.5 },
};

/** Seconds of the longest noise burst; the shared noise buffer is this long. */
export const NOISE_SECONDS = Math.max(...Object.values(SOUNDS).map((s) => s.noise?.durationS ?? 0));
