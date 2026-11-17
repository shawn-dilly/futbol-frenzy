import Phaser from 'phaser';
import { GOAL_BANNER_TICKS } from './layout';
import { HALFTIME_PAUSE_TICKS, createMatch, neutralPad, step, type MatchState, type PadInput, type SimEvent } from '../sim';
import { KeyboardPad, mergePads } from '../input/keyboard';
import { TouchControls } from '../input/TouchControls';
import { Hud } from './Hud';
import { MatchView } from './MatchView';
import { FixedStepper } from './loop';
import { parseMatchParams } from './params';
import { Sfx, sfxForEvent } from '../audio/sfx';

declare global {
  interface Window { __ff?: { state: MatchState } }
}

/** Runs the sim at a fixed 60 Hz and hands the state to the view and HUD. */
export class MatchScene extends Phaser.Scene {
  private state!: MatchState;
  private view!: MatchView;
  private hud!: Hud;
  private touch: TouchControls | null = null;
  private keys!: KeyboardPad;
  private readonly stepper = new FixedStepper();
  private seed = 0;
  /** One instance for the scene's lifetime so a restart keeps the unlocked audio context. */
  private readonly sfx = new Sfx();

  constructor() { super('match'); }

  init(data: { seed?: number }): void {
    this.seed = data.seed ?? parseMatchParams(window.location.search).seed;
  }

  create(): void {
    const params = parseMatchParams(window.location.search);
    this.sfx.muted = params.mute;
    this.state = createMatch({ seed: this.seed, halfSeconds: params.halfSeconds, human: [!params.demo, false] });
    window.__ff = { state: this.state };
    this.view = new MatchView(this);
    this.hud = new Hud(this);
    this.keys = new KeyboardPad(this);
    this.touch = params.demo ? null : new TouchControls(this);
    this.handleEvents(this.state.events);
    this.view.sync(this.state);
    this.hud.sync(this.state);

    // Only a fresh press restarts: a key already held at full time keeps auto-repeating keydown, which must not count.
    const restart = () => { if (this.state.phase === 'fulltime') this.scene.restart({ seed: this.seed + 1 }); };
    this.input.on('pointerdown', restart);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => { if (!e.repeat) restart(); });
    // Browsers block audio until a gesture: the first press unlocks it (idempotent, so listening to every press is harmless).
    const unlock = () => this.sfx.unlock();
    this.input.on('pointerdown', unlock);
    this.input.keyboard?.on('keydown', unlock);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', unlock);
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
      if (e.type === 'goal') this.hud.showBanner('GOAL!', GOAL_BANNER_TICKS, this.state.tick);
      else if (e.type === 'whistle' && e.what === 'halftime') this.hud.showBanner('HALF TIME', HALFTIME_PAUSE_TICKS, this.state.tick);
      else if (e.type === 'whistle' && e.what === 'fulltime') this.hud.showBanner('FULL TIME', Infinity, this.state.tick);
    }
  }
}
