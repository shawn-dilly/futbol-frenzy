import Phaser from 'phaser';
import { DEPTH, GOAL_BANNER_TICKS, SCREEN_H, SCREEN_W, canRestart } from './layout';
import { HALFTIME_PAUSE_TICKS, createMatch, neutralPad, step, type HitType, type HurtTier, type MatchState, type PadInput, type SimEvent } from '../sim';
import { KeyboardPad, mergePads } from '../input/keyboard';
import { TouchControls } from '../input/TouchControls';
import { CALLOUTS } from '../content/callouts';
import { seededRandom } from '../content/shuffleBag';
import { CalloutBanner } from './CalloutBanner';
import { CALLOUT_SEED_SALT, CalloutPicker } from './calloutPicker';
import { Hud } from './Hud';
import { EFFECT_SEED_SALT, HIT_FEEDBACK, craterLandTicks, flashAlpha, soundsForHit } from './hitFeedback';
import { bigHitReady, chargeFill, chargeJustStarted } from './indicators';
import { MatchView } from './MatchView';
import { FixedStepper } from './loop';
import { parseMatchParams } from './params';
import { outgoingAt } from './outgoing';
import { Sfx, sfxForEvent } from '../audio/sfx';

declare global {
  interface Window {
    /** Dev/test hooks: `showCallout` shows the callout a hit of that tier and type would; `calloutText` is what the banner shows now ('' if nothing). */
    __ff?: { state: MatchState; showCallout: (tier: HurtTier, hit: HitType) => void; calloutText: () => string }
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
  private flash!: Phaser.GameObjects.Rectangle;
  /** Real time of the latest frame, and of the latest flash; the shake and flash run on real time so they play through a hit-stop. */
  private nowMs = 0;
  private flashStartMs = -Infinity;
  /** Hit-stop ticks asked for by the events of the step just run; update() hands them to the stepper. */
  private freezeTicks = 0;
  /** Whether the human's controlled player was charging on the previous step, to play the charge sound once per charge. */
  private wasCharging = false;
  /** Craters waiting for their victim to land: the sim tick they appear on, and who lands. */
  private pendingCraters: { tick: number; victim: number; impact?: import('../sim').PlayerState; startTick: number }[] = [];
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
    this.pendingCraters = [];
    this.freezeTicks = 0;
    this.wasCharging = false;
    this.flashStartMs = -Infinity;
    const params = parseMatchParams(window.location.search);
    this.sfx.muted = params.mute;
    this.state = createMatch({ seed: this.seed, halfSeconds: params.halfSeconds, human: [!params.demo, false], level: [params.level2 ?? params.level, params.level] });
    this.callouts = new CalloutPicker(CALLOUTS, seededRandom(this.seed ^ CALLOUT_SEED_SALT));
    window.__ff = {
      state: this.state,
      showCallout: (tier, hit) => { const c = this.callouts.pick(tier, hit); if (c) this.calloutBanner.show(c.text, tier, this.state.tick); },
      calloutText: () => this.calloutBanner.visibleText(this.state.tick),
    };
    this.view = new MatchView(this, seededRandom(this.seed ^ EFFECT_SEED_SALT));
    this.hud = new Hud(this);
    this.calloutBanner = new CalloutBanner(this);
    this.flash = this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0xffffff).setOrigin(0, 0).setDepth(DEPTH.flash).setAlpha(0);
    this.keys = new KeyboardPad(this);
    this.touch = params.demo ? null : new TouchControls(this);
    this.handleEvents(this.state.events);
    this.syncPresentation();

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

  update(time: number, delta: number): void {
    this.nowMs = time;
    const steps = this.stepper.advance(delta);
    for (let i = 0; i < steps; i++) {
      step(this.state, this.readPads());
      this.handleEvents(this.state.events);
      this.landCraters();
      this.playChargeSound();
      if (this.freezeTicks > 0) {
        // Hit-stop: the rest of this frame's steps are dropped and count towards the pause.
        this.stepper.freeze(this.freezeTicks, steps - i - 1);
        this.freezeTicks = 0;
        break;
      }
    }
    this.syncPresentation();
  }

  private syncPresentation(): void {
    this.view.sync(this.state, this.nowMs);
    this.hud.sync(this.state);
    this.calloutBanner.sync(this.state.tick);
    this.flash.setAlpha(flashAlpha(this.nowMs - this.flashStartMs));
    if (this.touch) {
      const me = this.state.players[this.state.controlled[0]];
      this.touch.draw(chargeFill(me), bigHitReady(me, this.state.turbo[0]));
    }
  }

  /** The charge sound starts when the human's player starts charging a hit. */
  private playChargeSound(): void {
    if (!this.state.config.human[0]) return;
    const me = this.state.players[this.state.controlled[0]];
    if (chargeJustStarted(this.wasCharging, me)) this.sfx.play('charge');
    this.wasCharging = me.status.kind === 'charging';
  }

  /** Team 0 is the human (touch and keyboard, absent in demo mode); team 1 is always the CPU. */
  private readPads(): [PadInput, PadInput] {
    if (!this.touch) return [neutralPad(), neutralPad()];
    return [mergePads(this.touch.read(), this.keys.read()), neutralPad()];
  }

  /** The one place sim events become presentation: banners, sound, shake, hit-stop, flash and craters. */
  private handleEvents(events: SimEvent[]): void {
    for (const e of events) {
      const sound = sfxForEvent(e);
      if (sound) this.sfx.play(sound);
      if (e.type === 'hit') this.onHit(e);
      else if (e.type === 'goal') {
        this.calloutBanner.clear();
        this.hud.showBanner('GOAL!', GOAL_BANNER_TICKS, this.state.tick);
      } else if (e.type === 'whistle') {
        this.calloutBanner.clear();
        if (e.what === 'kickoff') { this.view.clearCraters(); this.pendingCraters = []; }
        if (e.what === 'halftime') this.hud.showBanner('HALF TIME', HALFTIME_PAUSE_TICKS, this.state.tick);
        else if (e.what === 'fulltime') {
          this.fulltimeTick = this.state.tick;
          this.hud.showFullTime(this.state.tick);
        }
      }
    }
  }

  private onHit(e: Extract<SimEvent, { type: 'hit' }>): void {
    const fb = HIT_FEEDBACK[e.tier];
    const callout = this.callouts.pick(e.tier, e.hit);
    const clipPlayed = !!callout?.audio && this.sfx.playClip(callout.audio);
    soundsForHit(fb, clipPlayed).forEach(name => this.sfx.play(name));
    this.view.shake(fb.shakePx, fb.shakeMs, this.nowMs);
    this.freezeTicks = Math.max(this.freezeTicks, fb.freezeTicks);
    if (fb.flash) this.flashStartMs = this.nowMs;
    if (e.substituted && e.impact) this.view.addOutgoing(e.impact, this.state.tick);
    if (fb.stars) this.view.addStarBurst({ ...(e.impact?.pos ?? this.state.players[e.victim].pos) }, this.nowMs);
    const landTicks = craterLandTicks(e.tier, e.variant);
    if (landTicks !== null) this.pendingCraters.push({ tick: this.state.tick + landTicks, victim: e.victim, impact: e.substituted ? e.impact : undefined, startTick: this.state.tick });
    if (callout) this.calloutBanner.show(callout.text, e.tier, this.state.tick);
  }

  /** Puts a crater where each over-the-top victim has landed by now. */
  private landCraters(): void {
    this.pendingCraters = this.pendingCraters.filter(c => {
      if (c.tick > this.state.tick) return true;
      const { x, y } = c.impact ? outgoingAt(c.impact, this.state.tick - c.startTick).pos : this.state.players[c.victim].pos;
      this.view.addCrater({ x, y });
      return false;
    });
  }
}
