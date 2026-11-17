import type { MatchKits } from '../content/teams';
import Phaser from 'phaser';
import { canvasRect } from '../art/canvasRect';
import { PAL } from '../art/palette';
import { ORIGIN_X, ORIGIN_Y, frameIndex, frameKey } from '../art/sprites';
import { ANIMATIONS, airTicks } from '../content/animations';
import type { MatchState, PlayerState, TeamId, Vec } from '../sim';
import { outgoingAt } from './outgoing';
import { animFor } from './playerAnim';
import { ATLAS_KEY, BALL_KEY, BALL_PX } from './BootScene';
import { DEPTH, PITCH_TEX_H, PITCH_TEX_W, arcLift, cameraTarget, nextFlip, pitchImagePos, worldToScreen } from './layout';
import { CRATER_H, CRATER_W, drawCrater, drawPitch } from './pitchArt';
import { STAR_BURST, shakeOffset, starOffsets, strongerShake, type Shake } from './hitFeedback';
import { dazedMarkerVisible } from './indicators';

const PITCH_KEY = 'pitch';
const CRATER_KEY = 'crater';
const CAMERA_EASE = 0.1; // fraction of the gap to the target closed per frame
const SHADOW = { w: 10, h: 2, color: 0x000000, alpha: 0.28 };
const BALL_SHADOW_W = BALL_PX + 1;
const BALL_CENTER_PX = Math.floor(BALL_PX / 2); // sprite columns left of the ball's position
/** Body centre is column ORIGIN_X, but flipX mirrors about x = ORIGIN_X; shift a flipped sprite right to keep the body still. */
const FLIP_OFFSET_PX = 1;
const MARKER = { w: 8, h: 5, above: 19, color: Phaser.Display.Color.HexStringToColor(PAL.yel).color }; // px above the feet
/** Dazed marker: two yellow pixels this far above the feet, and this far either side of the body centre. */
const DAZED = { above: 24, dxLeft: -3, dxRight: 2, color: MARKER.color };

/** Star pixels: this big, this far above the feet at the burst centre. */
const STAR = { size: 2, centerAbove: 8, color: MARKER.color };

interface StarBurst { pos: Vec; startMs: number; stars: Phaser.GameObjects.Rectangle[] }
interface Crater { pos: Vec; image: Phaser.GameObjects.Image }

interface PlayerView { sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Rectangle; dazed: Phaser.GameObjects.Rectangle[]; flip: boolean }

/** Draws the pitch, players and ball from match state. Reads state, never writes it. */
export class MatchView {
  private readonly pitch: Phaser.GameObjects.Image;
  private readonly ball: Phaser.GameObjects.Image;
  private readonly ballShadow: Phaser.GameObjects.Rectangle;
  private readonly markers: Phaser.GameObjects.Triangle[];
  private players: PlayerView[] = [];
  private readonly outgoing: { player: PlayerState; start: number; view: PlayerView }[] = [];
  private readonly craters: Crater[] = [];
  private readonly bursts: StarBurst[] = [];
  private camX: number | null = null;
  private shaking: Shake | null = null;
  /** Whole-pixel shake offset for this frame, applied to everything drawn in the world (never to the HUD or controls). */
  private offset = { x: 0, y: 0 };

  /** `random` feeds the shake; it is the presentation's own generator, never the sim's. */
  constructor(private readonly scene: Phaser.Scene, private readonly random: () => number, private readonly kits: MatchKits) {
    const tex = scene.textures.createCanvas(PITCH_KEY, PITCH_TEX_W, PITCH_TEX_H);
    if (!tex) throw new Error('pitch texture could not be created');
    drawPitch(canvasRect(tex.context));
    tex.refresh();
    this.pitch = scene.add.image(0, 0, PITCH_KEY).setOrigin(0, 0).setDepth(DEPTH.pitch);
    this.ballShadow = this.shadowRect(BALL_SHADOW_W);
    this.ball = scene.add.image(0, 0, BALL_KEY).setOrigin(0, 1).setDepth(DEPTH.ball);
    this.markers = [0, 1].map(() => scene.add.triangle(0, 0, 0, 0, MARKER.w, 0, MARKER.w / 2, MARKER.h, MARKER.color).setStrokeStyle(1, 0x171722).setOrigin(0.5, 1).setDepth(DEPTH.marker).setVisible(false));
    const crater = scene.textures.createCanvas(CRATER_KEY, CRATER_W, CRATER_H);
    if (!crater) throw new Error('crater texture could not be created');
    drawCrater(canvasRect(crater.context));
    crater.refresh();
    scene.events.once('shutdown', () => { scene.textures.remove(PITCH_KEY); scene.textures.remove(CRATER_KEY); });
  }

  /** Starts a screen shake of `px` pixels dying away over `ms`, timed in real milliseconds so it runs through a hit-stop; the stronger of it and a running shake carries on. */
  shake(px: number, ms: number, nowMs: number): void {
    this.shaking = strongerShake(this.shaking, { startMs: nowMs, px, ms }, nowMs);
  }

  /** A short burst of yellow stars flying out from a world position (an over-the-top hit). */
  addStarBurst(pos: Vec, nowMs: number): void {
    const stars = Array.from({ length: STAR_BURST.count }, () =>
      this.scene.add.rectangle(0, 0, STAR.size, STAR.size, STAR.color).setOrigin(0.5, 0.5).setDepth(DEPTH.marker));
    this.bursts.push({ pos, startMs: nowMs, stars });
  }

  /** Leaves a crater decal on the pitch at a world position; it stays until clearCraters(). */
  addCrater(pos: Vec): void {
    this.craters.push({ pos, image: this.scene.add.image(0, 0, CRATER_KEY).setDepth(DEPTH.crater) });
  }

  clearCraters(): void {
    this.craters.forEach(c => c.image.destroy());
    this.craters.length = 0;
  }

  clearTransientEffects(): void {
    this.clearCraters();
    this.bursts.forEach(b => b.stars.forEach(star => star.destroy()));
    this.bursts.length = 0;
    this.outgoing.forEach(({ view }) => { view.sprite.destroy(); view.shadow.destroy(); view.dazed.forEach(d => d.destroy()); });
    this.outgoing.length = 0;
    this.shaking = null;
  }

  /** Visible sprites for one roster slot, including its outgoing actor during a substitution. */
  renderedPlayers(id: number) {
    return this.scene.children.getChildren()
      .filter((child): child is Phaser.GameObjects.Image =>
        child instanceof Phaser.GameObjects.Image && child.name === `player-${id}` && child.visible)
      .map(sprite => ({ frame: sprite.frame.name, y: sprite.y }));
  }

  markerY(team: TeamId): number | null {
    const marker = this.markers[team];
    return marker.visible ? marker.y : null;
  }

  addOutgoing(player: PlayerState, start: number): void {
    this.outgoing.push({ player, start, view: this.createPlayerView(player) });
  }

  sync(state: MatchState, nowMs: number): void {
    this.offset = this.currentShake(nowMs);
    const target = cameraTarget(state.ball.pos.x);
    this.camX = this.camX === null ? target : this.camX + (target - this.camX) * CAMERA_EASE;
    const camX = Math.round(this.camX);
    const pitchAt = pitchImagePos(camX, this.offset);
    this.pitch.setPosition(pitchAt.x, pitchAt.y);
    if (this.players.length === 0) this.players = state.players.map(p => this.createPlayerView(p));

    this.markers.forEach(m => m.setVisible(false));
    state.players.forEach((p, i) => this.syncPlayer(this.players[i], p, state, camX));

    for (let i = this.outgoing.length - 1; i >= 0; i--) {
      const actor = this.outgoing[i];
      const elapsed = state.tick - actor.start;
      if (elapsed >= actor.player.statusTicks) {
        actor.view.sprite.destroy(); actor.view.shadow.destroy(); actor.view.dazed.forEach(d => d.destroy());
        this.outgoing.splice(i, 1); continue;
      }
      this.syncPlayer(actor.view, outgoingAt(actor.player, elapsed), state, camX, false);
    }
    const b = this.screenPos(state.ball.pos, camX);
    this.ball.setPosition(Math.round(b.x) - BALL_CENTER_PX, Math.round(b.y)).setDepth(state.ball.pos.y + DEPTH.ball);
    this.ballShadow.setPosition(Math.round(b.x) - BALL_CENTER_PX, Math.round(b.y));
    this.syncBursts(camX, nowMs);
    for (const c of this.craters) {
      const at = this.screenPos(c.pos, camX);
      c.image.setPosition(Math.round(at.x), Math.round(at.y));
    }
  }

  private syncBursts(camX: number, nowMs: number): void {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const { pos, startMs, stars } = this.bursts[i];
      const offsets = starOffsets(nowMs - startMs);
      if (offsets.length === 0) { stars.forEach(r => r.destroy()); this.bursts.splice(i, 1); continue; }
      const at = this.screenPos(pos, camX);
      stars.forEach((r, k) => r.setPosition(Math.round(at.x) + offsets[k].x, Math.round(at.y) - STAR.centerAbove + offsets[k].y));
    }
  }

  private currentShake(nowMs: number): { x: number; y: number } {
    if (!this.shaking) return { x: 0, y: 0 };
    const { startMs, px, ms } = this.shaking;
    if (nowMs - startMs >= ms) { this.shaking = null; return { x: 0, y: 0 }; }
    return shakeOffset(nowMs - startMs, px, ms, this.random);
  }

  /** World position to screen pixels, including this frame's shake. */
  private screenPos(pos: Vec, camX: number): { x: number; y: number } {
    const s = worldToScreen(pos, camX);
    return { x: s.x + this.offset.x, y: s.y + this.offset.y };
  }

  private shadowRect(w: number): Phaser.GameObjects.Rectangle {
    return this.scene.add.rectangle(0, 0, w, SHADOW.h, SHADOW.color, SHADOW.alpha).setOrigin(0, 0).setDepth(DEPTH.shadow);
  }

  private createPlayerView(p: PlayerState): PlayerView {
    const dazed = [0, 1].map(() => this.scene.add.rectangle(0, 0, 1, 1, DAZED.color).setOrigin(0, 0).setDepth(DEPTH.marker).setVisible(false));
    return { sprite: this.scene.add.image(0, 0, ATLAS_KEY).setName(`player-${p.id}`).setOrigin(0, 0), shadow: this.shadowRect(SHADOW.w), dazed, flip: nextFlip(false, p.facing.x) };
  }

  private syncPlayer(view: PlayerView, p: PlayerState, state: MatchState, camX: number, marker = true): void {
    const s = this.screenPos(p.pos, camX);
    const x = Math.round(s.x), y = Math.round(s.y);
    const kit = this.kits[p.team][p.role === 'gk' ? 'keeper' : 'outfield'];
    view.flip = nextFlip(view.flip, p.facing.x);
    const { key, tick } = animFor(p, state.tick);
    const def = ANIMATIONS[key];
    const lift = arcLift(def.arcHeight, tick, airTicks(def));
    view.sprite
      .setFrame(frameKey(kit, key, frameIndex(key, tick)))
      .setFlipX(view.flip)
      .setPosition(x - ORIGIN_X + (view.flip ? FLIP_OFFSET_PX : 0), y - ORIGIN_Y - Math.round(lift))
      .setDepth(p.pos.y);
    view.shadow.setPosition(x - SHADOW.w / 2, y);
    const dazedOn = dazedMarkerVisible(p, state.tick);
    view.dazed.forEach((d, i) => d.setVisible(dazedOn).setPosition(x + (i === 0 ? DAZED.dxLeft : DAZED.dxRight), y - DAZED.above - Math.round(lift)));
    if (marker && state.config.human[p.team] && state.controlled[p.team] === p.id) {
      this.markers[p.team as TeamId].setVisible(true).setPosition(x, y - MARKER.above - Math.round(lift));
    }
  }
}
