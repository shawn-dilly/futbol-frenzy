import Phaser from 'phaser';
import { GOAL_BANNER_TICKS } from './layout';
import { HALFTIME_PAUSE_TICKS, createMatch, neutralPad, step, type MatchState, type PadInput, type SimEvent } from '../sim';
import { Hud } from './Hud';
import { MatchView } from './MatchView';
import { FixedStepper } from './loop';
import { parseMatchParams } from './params';

declare global {
  interface Window { __ff?: { state: MatchState } }
}

/** Runs the sim at a fixed 60 Hz and hands the state to the view and HUD. */
export class MatchScene extends Phaser.Scene {
  private state!: MatchState;
  private view!: MatchView;
  private hud!: Hud;
  private readonly stepper = new FixedStepper();
  private seed = 0;

  constructor() { super('match'); }

  init(data: { seed?: number }): void {
    this.seed = data.seed ?? parseMatchParams(window.location.search).seed;
  }

  create(): void {
    const params = parseMatchParams(window.location.search);
    this.state = createMatch({ seed: this.seed, halfSeconds: params.halfSeconds, human: [!params.demo, false] });
    window.__ff = { state: this.state };
    this.view = new MatchView(this);
    this.hud = new Hud(this);
    this.handleEvents(this.state.events);
    this.view.sync(this.state);
    this.hud.sync(this.state);

    const restart = () => { if (this.state.phase === 'fulltime') this.scene.restart({ seed: this.seed + 1 }); };
    this.input.on('pointerdown', restart);
    this.input.keyboard?.on('keydown', restart);
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

  /** Task 10 replaces this body with touch and keyboard input. */
  private readPads(): [PadInput, PadInput] {
    return [neutralPad(), neutralPad()];
  }

  /** The one place sim events become presentation; sound joins here. */
  private handleEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'goal') this.hud.showBanner('GOAL!', GOAL_BANNER_TICKS, this.state.tick);
      else if (e.type === 'whistle' && e.what === 'halftime') this.hud.showBanner('HALF TIME', HALFTIME_PAUSE_TICKS, this.state.tick);
      else if (e.type === 'whistle' && e.what === 'fulltime') this.hud.showBanner('FULL TIME', Infinity, this.state.tick);
    }
  }
}
