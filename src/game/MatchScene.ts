import Phaser from 'phaser';
import { drawText } from '../art/pixelFont';
import { PAL } from '../art/palette';
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
import { launchFromSearch, type MatchLaunch } from './launch';
import { createReplayRecord, recordReplayInput, reconstructReplay, type ReplayRecord } from './replay';
import { outgoingAt } from './outgoing';
import { Sfx, sfxForEvent } from '../audio/sfx';

declare global {
  interface Window {
    /** Dev/test hooks: `showCallout` shows the callout a hit of that tier and type would; `calloutText` is what the banner shows now ('' if nothing). */
    __ff?: { state: MatchState; showCallout: (tier: HurtTier, hit: HitType) => void; calloutText: () => string; replay: () => ReplayRecord; startReplay: (half: 0 | 1) => void; endReplay: () => void; replayTick: () => number | null; pause: () => void; resume: () => void; halftimeGate: () => boolean; continueHalftime: () => void; launch: (launch: MatchLaunch) => void }
  }
}

/** Runs the sim at a fixed 60 Hz and hands the state to the view and HUD. */
export class MatchScene extends Phaser.Scene {
  private state!: MatchState;
  private replay!: ReplayRecord;
  private playback: { states: MatchState[]; cursor: number } | null = null;
  private readonly playbackStepper = new FixedStepper();
  private replayLabel?: Phaser.GameObjects.Graphics;
  private replayReturn?: Phaser.GameObjects.Rectangle;
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
  private paused = false;
  private hidden = false;
  private seed = 0;
  private launch!: MatchLaunch;
  private halftimeGated = false;
  private halftimeUI: Phaser.GameObjects.GameObject[] = [];
  /** Sim tick of the full-time whistle, null until it blows. */
  private fulltimeTick: number | null = null;
  /** Audio resources are released on each shutdown. */
  private readonly sfx = new Sfx();

  constructor() { super('match'); }

  init(data?: MatchLaunch | { seed?: number }): void {
    const fallback = launchFromSearch(window.location.search);
    this.launch = data && 'config' in data ? structuredClone(data) : fallback;
    if (data && 'seed' in data && data.seed !== undefined) this.launch.config.seed = data.seed;
    this.seed = this.launch.config.seed;
  }

  create(): void {
    this.playback = null;
    this.paused = false;
    this.halftimeGated = false;
    this.hidden = document.hidden;
    this.stepper.reset();
    this.fulltimeTick = null;
    this.pendingCraters = [];
    this.freezeTicks = 0;
    this.wasCharging = false;
    this.flashStartMs = -Infinity;
    this.sfx.muted = this.launch.mute;
    this.state = createMatch(this.launch.config);
    this.replay = createReplayRecord(this.state.config);
    this.callouts = new CalloutPicker(CALLOUTS, seededRandom(this.seed ^ CALLOUT_SEED_SALT));
    let active = true;
    const hook: NonNullable<Window["__ff"]> = {
      state: this.state,
      pause: () => { if (active) this.pause(); },
      resume: () => { if (active) this.resume(); },
      replay: () => structuredClone(this.replay),
      startReplay: (half) => { if (active) this.startReplay(half); },
      endReplay: () => { if (active) this.endReplay(); },
      replayTick: () => this.playback?.states[this.playback.cursor]?.tick ?? null,
      launch: (launch) => { if (active) this.scene.restart(launch); },
      halftimeGate: () => this.isHalftimeGated(),
      continueHalftime: () => { if (active) this.continueHalftime(); },
      showCallout: (tier, hit) => { if (!active) return; const c = this.callouts.pick(tier, hit); if (c) this.calloutBanner.show(c.text, tier, this.state.tick); },
      calloutText: () => this.calloutBanner.visibleText(this.state.tick),
    };
    window.__ff = hook;
    this.view = new MatchView(this, seededRandom(this.seed ^ EFFECT_SEED_SALT));
    this.hud = new Hud(this);
    this.calloutBanner = new CalloutBanner(this);
    this.flash = this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0xffffff).setOrigin(0, 0).setDepth(DEPTH.flash).setAlpha(0);
    this.keys = new KeyboardPad(this);
    this.touch = this.state.config.human[0] ? new TouchControls(this) : null;
    this.handleEvents(this.state.events);
    this.syncPresentation();

    // Only a fresh press restarts: a key already held at full time keeps auto-repeating keydown, which must not count.
    const restart = () => {
      if (!this.playback && canRestart(this.state.phase, this.state.tick, this.fulltimeTick)) this.scene.restart({ ...this.launch, config: { ...this.launch.config, seed: this.seed + 1 } });
    };
    this.input.on('pointerdown', restart);
    const restartKey = (e: KeyboardEvent) => { if (this.halftimeGated && !this.playback && !e.repeat) { if (e.key === 'Enter' || e.key === ' ') this.continueHalftime(); else if (e.key.toLowerCase() === 'r') this.startReplay(0); return; } if (e.key === 'Escape' && this.playback) { this.endReplay(); return; } if (!e.repeat) restart(); };
    this.input.keyboard?.on('keydown', restartKey);
    // Browsers block audio until a gesture: the first press unlocks it (idempotent, so listening to every press is harmless).
    const unlock = () => this.sfx.unlock();
    // pointerup too: on touch devices pointerdown comes from touchstart, which does not count as a gesture.
    this.input.on('pointerdown', unlock);
    this.input.on('pointerup', unlock);
    this.input.keyboard?.on('keydown', unlock);
    this.events.once('shutdown', () => {
      active = false;
      this.disposeReplay();
      this.hideHalftime();
      this.sfx.dispose();
      this.input.off('pointerdown', restart);
      this.input.keyboard?.off('keydown', restartKey);
      this.clearControls();
      this.pendingCraters = [];
      if (window.__ff === hook) delete window.__ff;
      this.input.off('pointerdown', unlock);
      this.input.off('pointerup', unlock);
      this.input.keyboard?.off('keydown', unlock);
    });
    const onVisibility = () => { this.hidden = document.hidden; this.clearControls(); };
    document.addEventListener('visibilitychange', onVisibility);
    this.events.once('shutdown', () => document.removeEventListener('visibilitychange', onVisibility));
  }

  update(time: number, delta: number): void {
    this.nowMs = time;
    if (this.playback) {
      if (!this.hidden) {
        const steps = this.playbackStepper.advance(delta);
        for (let i = 0; i < steps && this.playback.cursor < this.playback.states.length - 1; i++) {
          this.playback.cursor++;
          const snapshot = this.playback.states[this.playback.cursor];
          for (const event of snapshot.events) if (event.type === 'hit') this.view.addStarBurst({ ...(event.impact?.pos ?? snapshot.players[event.victim].pos) }, time);
        }
        this.syncPresentation();
      }
      return;
    }
    if (this.paused || this.hidden || this.halftimeGated) return;
    const steps = this.stepper.advance(delta);
    for (let i = 0; i < steps; i++) {
      const inputs = this.readPads();
      recordReplayInput(this.replay, inputs);
      const previousPhase = this.state.phase;
      step(this.state, inputs);
      const gate = previousPhase !== 'halftime' && this.state.phase === 'halftime' && (this.launch.mode === 'friendly' || this.launch.mode === 'cup');
      this.handleEvents(this.state.events);
      this.landCraters();
      this.playChargeSound();
      if (gate) {
        this.halftimeGated = true;
        this.freezeTicks = 0;
        this.clearControls();
        this.showHalftime();
        break;
      }
      if (this.freezeTicks > 0) {
        // Hit-stop: the rest of this frame's steps are dropped and count towards the pause.
        this.stepper.freeze(this.freezeTicks, steps - i - 1);
        this.freezeTicks = 0;
        break;
      }
    }
    this.syncPresentation();
  }

  startReplay(half: 0 | 1): void {
    this.endReplay();
    this.hideHalftime();
    const result = reconstructReplay(this.replay, this.state.halfHits[half], 60, 60);
    this.playback = { states: result.kind === 'window' ? result.states : [], cursor: 0 };
    this.clearControls();
    this.playbackStepper.reset();
    this.calloutBanner.clear();
    this.view.clearTransientEffects();
    this.pendingCraters = [];
    this.flashStartMs = -Infinity;
    this.replayLabel = this.add.graphics().setDepth(2200);
    const graphics = this.replayLabel;
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      graphics.fillStyle(Phaser.Display.Color.HexStringToColor(color).color).fillRect(x, y, w, h);
    };
    rect(8, 20, result.kind === 'no-hit' ? 124 : 60, 20, PAL.ink);
    drawText(rect, result.kind === 'no-hit' ? 'REPLAY - NO HIT' : 'REPLAY', 12, 25, PAL.wht, 2);
    rect(SCREEN_W - 76, 20, 68, 24, PAL.ink);
    drawText(rect, 'RETURN', SCREEN_W - 70, 27, PAL.yel, 2);
    this.replayReturn = this.add.rectangle(SCREEN_W - 42, 32, 68, 24, 0, 0).setDepth(2201).setInteractive();
    this.replayReturn.on('pointerdown', () => this.endReplay());
    this.syncPresentation();
  }

  endReplay(): void {
    if (!this.playback) return;
    this.disposeReplay();
    if (this.halftimeGated) this.showHalftime();
    this.syncPresentation();
  }

  private disposeReplay(): void {
    if (!this.playback) return;
    this.playback = null;
    this.playbackStepper.reset();
    this.replayLabel?.destroy(); this.replayLabel = undefined;
    this.replayReturn?.destroy(); this.replayReturn = undefined;
    this.calloutBanner?.clear();
    this.view?.clearTransientEffects();
    this.pendingCraters = [];
    this.flashStartMs = -Infinity;
    this.clearControls();
  }

  isHalftimeGated(): boolean { return this.halftimeGated; }

  continueHalftime(): void { if (!this.halftimeGated || this.playback) return; this.halftimeGated = false; this.hideHalftime(); this.clearControls(); }

  private hideHalftime(): void { this.halftimeUI.forEach(item => item.destroy()); this.halftimeUI = []; }

  private showHalftime(): void {
    this.hideHalftime();
    const g = this.add.graphics().setDepth(2200); this.halftimeUI.push(g);
    const rect = (x: number, y: number, w: number, h: number, color: string) => { g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color).fillRect(x, y, w, h); };
    const text = (s: string, x: number, y: number, color: string = PAL.wht, scale = 1, align: 'l' | 'c' | 'r' = 'l') => drawText(rect, s, x, y, color, scale, align);
    const panel = (x: number, y: number, w: number, h: number, border: string, fill: string = PAL.ink) => { rect(x, y, w, h, border); rect(x + 1, y + 1, w - 2, h - 2, fill); };
    rect(0, 0, 320, 180, PAL.navy);
    text('HALF TIME', 160, 6, PAL.yel, 3, 'c');
    panel(12, 28, 176, 22, PAL.gry); text(this.launch.teamNames?.[0] ?? 'HOME', 20, 36, PAL.wht, 1); text(`${this.state.score[0]} - ${this.state.score[1]}`, 100, 33, PAL.yel, 2, 'c'); text(this.launch.teamNames?.[1] ?? 'AWAY', 180, 36, PAL.wht, 1, 'r');
    panel(12, 54, 176, 84, PAL.gry);
    const rows = [['SHOTS', 'shots'], ['BIG HITS', 'bigHits'], ['KOS', 'kos'], ['STEALS', 'steals']] as const;
    rows.forEach(([label, key], i) => { const y = 60 + i * 17; text(String(this.state.stats[0][key]), 24, y, PAL.wht, 2); text(label, 100, y + 2, PAL.gry, 1, 'c'); text(String(this.state.stats[1][key]), 176, y, PAL.wht, 2, 'r'); });
    panel(196, 28, 112, 76, PAL.yel); rect(197, 29, 110, 11, PAL.yel); text('HIT OF THE HALF', 252, 32, PAL.ink, 1, 'c');
    text(this.state.halfHits[0] ? 'HIT AVAILABLE' : 'NO HIT', 252, 57, PAL.wht, 2, 'c'); text('WATCH REPLAY >', 252, 87, PAL.yel, 1, 'c');
    panel(196, 108, 112, 30, PAL.gry, PAL.dk); text('RESERVES', 252, 113, PAL.wht, 1, 'c'); text(`${this.state.reserves[0]} - ${this.state.reserves[1]}`, 252, 123, PAL.yel, 2, 'c');
    panel(12, 144, 144, 26, PAL.gry, PAL.dk); text('REPLAY [R]', 84, 152, PAL.wht, 2, 'c');
    panel(164, 144, 144, 26, PAL.wht, PAL.red); text('2ND HALF >', 236, 152, PAL.wht, 2, 'c');
    const button = (x: number, y: number, w: number, h: number, action: () => void) => { const hit = this.add.rectangle(x, y, w, h, 0, 0).setOrigin(0).setDepth(2201).setInteractive(); hit.on('pointerdown', action); this.halftimeUI.push(hit); };
    button(12, 144, 144, 26, () => { if (this.halftimeGated && !this.playback) this.startReplay(0); });
    button(196, 40, 112, 64, () => { if (this.halftimeGated && !this.playback) this.startReplay(0); });
    button(164, 144, 144, 26, () => this.continueHalftime());
  }

  pause(): void { this.paused = true; this.clearControls(); }

  resume(): void { this.paused = false; this.clearControls(); }

  private clearControls(): void {
    this.stepper.reset();
    this.keys?.clear();
    this.touch?.clear();
  }

  private syncPresentation(): void {
    const displayed = this.playback?.states[this.playback.cursor] ?? this.state;
    this.view.sync(displayed, this.nowMs);
    this.hud.sync(displayed, !!this.playback);
    this.calloutBanner.sync(displayed.tick);
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
