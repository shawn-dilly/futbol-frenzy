import Phaser from 'phaser';
import { GOAL_BANNER_TICKS, canRestart } from './layout';
import { HALFTIME_PAUSE_TICKS, createMatch, neutralPad, step, type HitType, type HurtTier, type MatchState, type PadInput, type SimEvent } from '../sim';
import { KeyboardPad, mergePads } from '../input/keyboard';
import { TouchControls } from '../input/TouchControls';
import { CALLOUTS } from '../content/callouts';
import { seededRandom } from '../content/shuffleBag';
import { CalloutBanner } from './CalloutBanner';
import { CalloutPicker } from './calloutPicker';
import { Hud } from './Hud';
import { MatchView } from './MatchView';
import { FixedStepper } from './loop';
import { parseMatchParams } from './params';
import { Sfx, sfxForEvent } from '../audio/sfx';

declare global {
  interface Window {
    /** `showCallout` is a dev/test hook: shows the callout a hit of that tier and type would. */
    __ff?: { state: MatchState; showCallout: (tier: HurtTier, hit: HitType) => void }
  }
}

/** Runs the sim at a fixed 60 Hz and hands the state to the view and HUD. */
export class MatchScene extends Phaser.Scene {
  private state!: MatchState;
  private view!: MatchView;
  private hud!: Hud;
  private callouts!: CalloutPicker;
  private calloutBanner!: CalloutBanner;
  private touch: TouchControls | null = null;
  private keys!: KeyboardPad;
  private readonly stepper = new FixedStepper();
  private seed = 0;
  /** Sim tick of the full-time whistle, null until it blows. */
  private fulltimeTick: number | null = null;
  /** One instance for the scene's lifetime so a restart keeps the unlocked audio context. */
  private readonly sfx = new Sfx();

  constructor() { super('match'); }

  init(data: { seed?: number }): void {
    this.seed = data.seed ?? parseMatchParams(window.location.search).seed;
  }

  create(): void {
    this.fulltimeTick = null;
    const params = parseMatchParams(window.location.search);
    this.sfx.muted = params.mute;
    this.state = createMatch({ seed: this.seed, halfSeconds: params.halfSeconds, human: [!params.demo, false] });
    this.callouts = new CalloutPicker(CALLOUTS, seededRandom(this.seed));
    window.__ff = { state: this.state, showCallout: (tier, hit) => this.showCallout(tier, hit) };
    this.view = new MatchView(this);
    this.hud = new Hud(this);
    this.calloutBanner = new CalloutBanner(this);
    this.keys = new KeyboardPad(this);
    this.touch = params.demo ? null : new TouchControls(this);
    this.handleEvents(this.state.events);
    this.view.sync(this.state);
    this.hud.sync(this.state);
    this.calloutBanner.sync(this.state.tick);

    // Only a fresh press restarts: a key already held at full time keeps auto-repeating keydown, which must not count.
    const restart = () => {
      if (canRestart(this.state.phase, this.state.tick, this.fulltimeTick)) this.scene.restart({ seed: this.seed + 1 });
    };
    this.input.on('pointerdown', restart);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => { if (!e.repeat) restart(); });
    // Browsers block audio until a gesture: the first press unlocks it (idempotent, so listening to every press is harmless).
    const unlock = () => this.sfx.unlock();
    // pointerup too: on touch devices pointerdown comes from touchstart, which does not count as a gesture.
    this.input.on('pointerdown', unlock);
    this.input.on('pointerup', unlock);
    this.input.keyboard?.on('keydown', unlock);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', unlock);
      this.input.off('pointerup', unlock);
      this.input.keyboard?.off('keydown', unlock);
    });
    const onVisibility = () => { if (document.hidden) this.stepper.reset(); };
    document.addEventListener('visibilitychange', onVisibility);
    this.events.once('shutdown', () => document.removeEventListener('visibilitychange', onVisibility));
  }

  update(_time: number, delta: number): void {
    const steps = this.stepper.advance(delta);
    for (let i = 0; i < steps; i++) {
      step(this.state, this.readPads());
      this.handleEvents(this.state.events);
    }
    this.view.sync(this.state);
    this.hud.sync(this.state);
    this.calloutBanner.sync(this.state.tick);
  }

  /** Team 0 is the human (touch and keyboard, absent in demo mode); team 1 is always the CPU. */
  private readPads(): [PadInput, PadInput] {
    if (!this.touch) return [neutralPad(), neutralPad()];
    return [mergePads(this.touch.read(), this.keys.read()), neutralPad()];
  }

  /** The one place sim events become presentation: banners and sound. */
  private handleEvents(events: SimEvent[]): void {
    for (const e of events) {
      const sound = sfxForEvent(e);
      if (sound) this.sfx.play(sound);
      if (e.type === 'hit') this.showCallout(e.tier, e.hit);
      else if (e.type === 'goal') this.hud.showBanner('GOAL!', GOAL_BANNER_TICKS, this.state.tick);
      else if (e.type === 'whistle' && e.what === 'halftime') this.hud.showBanner('HALF TIME', HALFTIME_PAUSE_TICKS, this.state.tick);
      else if (e.type === 'whistle' && e.what === 'fulltime') {
        this.fulltimeTick = this.state.tick;
        this.hud.showFullTime(this.state.tick);
      }
    }
  }

  /** Shows the next callout for a hit of this tier and type, if the pool has one; the newest always replaces the last. */
  private showCallout(tier: HurtTier, hit: HitType): void {
    const callout = this.callouts.pick(tier, hit);
    if (!callout) return;
    this.calloutBanner.show(callout.text, tier, this.state.tick);
    if (callout.audio) this.sfx.playClip(callout.audio);
  }
}
