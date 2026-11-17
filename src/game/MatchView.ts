import Phaser from 'phaser';
import { canvasRect } from '../art/canvasRect';
import { PAL } from '../art/palette';
import { ORIGIN_X, ORIGIN_Y, frameIndex, frameKey } from '../art/sprites';
import { ANIMATIONS } from '../content/animations';
import type { MatchState, PlayerState, TeamId } from '../sim';
import { animFor } from './playerAnim';
import { ATLAS_KEY, BALL_KEY, BALL_PX } from './BootScene';
import { DEPTH, PITCH_TEX_ORIGIN_X, PITCH_TEX_W, SCREEN_H, arcLift, cameraTarget, nextFlip, worldToScreen } from './layout';
import { drawPitch } from './pitchArt';

const PITCH_KEY = 'pitch';
const CAMERA_EASE = 0.1; // fraction of the gap to the target closed per frame
const SHADOW = { w: 10, h: 2, color: 0x000000, alpha: 0.28 };
const BALL_SHADOW_W = BALL_PX + 1;
const BALL_CENTER_PX = Math.floor(BALL_PX / 2); // sprite columns left of the ball's position
/** Body centre is column ORIGIN_X, but flipX mirrors about x = ORIGIN_X; shift a flipped sprite right to keep the body still. */
const FLIP_OFFSET_PX = 1;
const MARKER = { w: 3, h: 2, above: 20, color: Phaser.Display.Color.HexStringToColor(PAL.yel).color }; // px above the feet
const GOALKEEPER_KIT_OFFSET = 2;

interface PlayerView { sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Rectangle; flip: boolean }

/** Draws the pitch, players and ball from match state. Reads state, never writes it. */
export class MatchView {
  private readonly pitch: Phaser.GameObjects.Image;
  private readonly ball: Phaser.GameObjects.Image;
  private readonly ballShadow: Phaser.GameObjects.Rectangle;
  private readonly markers: Phaser.GameObjects.Rectangle[];
  private players: PlayerView[] = [];
  private camX: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const tex = scene.textures.createCanvas(PITCH_KEY, PITCH_TEX_W, SCREEN_H);
    if (!tex) throw new Error('pitch texture could not be created');
    drawPitch(canvasRect(tex.context));
    tex.refresh();
    this.pitch = scene.add.image(0, 0, PITCH_KEY).setOrigin(0, 0).setDepth(DEPTH.pitch);
    this.ballShadow = this.shadowRect(BALL_SHADOW_W);
    this.ball = scene.add.image(0, 0, BALL_KEY).setOrigin(0, 1).setDepth(DEPTH.ball);
    this.markers = [0, 1].map(() => scene.add.rectangle(0, 0, MARKER.w, MARKER.h, MARKER.color).setOrigin(0, 0).setDepth(DEPTH.marker).setVisible(false));
    scene.events.once('shutdown', () => scene.textures.remove(PITCH_KEY));
  }

  sync(state: MatchState): void {
    const target = cameraTarget(state.ball.pos.x);
    this.camX = this.camX === null ? target : this.camX + (target - this.camX) * CAMERA_EASE;
    const camX = Math.round(this.camX);
    this.pitch.setPosition(-PITCH_TEX_ORIGIN_X - camX, 0);
    if (this.players.length === 0) this.players = state.players.map(p => this.createPlayerView(p));

    this.markers.forEach(m => m.setVisible(false));
    state.players.forEach((p, i) => this.syncPlayer(this.players[i], p, state, camX));

    const b = worldToScreen(state.ball.pos, camX);
    this.ball.setPosition(Math.round(b.x) - BALL_CENTER_PX, Math.round(b.y)).setDepth(state.ball.pos.y + DEPTH.ball);
    this.ballShadow.setPosition(Math.round(b.x) - BALL_CENTER_PX, Math.round(b.y));
  }

  private shadowRect(w: number): Phaser.GameObjects.Rectangle {
    return this.scene.add.rectangle(0, 0, w, SHADOW.h, SHADOW.color, SHADOW.alpha).setOrigin(0, 0).setDepth(DEPTH.shadow);
  }

  private createPlayerView(p: PlayerState): PlayerView {
    return { sprite: this.scene.add.image(0, 0, ATLAS_KEY).setOrigin(0, 0), shadow: this.shadowRect(SHADOW.w), flip: nextFlip(false, p.facing.x) };
  }

  private syncPlayer(view: PlayerView, p: PlayerState, state: MatchState, camX: number): void {
    const s = worldToScreen(p.pos, camX);
    const x = Math.round(s.x), y = Math.round(s.y);
    const kit = p.team + (p.role === 'gk' ? GOALKEEPER_KIT_OFFSET : 0);
    view.flip = nextFlip(view.flip, p.facing.x);
    const { key, tick } = animFor(p, state.tick);
    const def = ANIMATIONS[key];
    const lift = arcLift(def.arcHeight, tick, (def.airFrames ?? 0) * def.ticksPerFrame);
    view.sprite
      .setFrame(frameKey(kit, key, frameIndex(key, tick)))
      .setFlipX(view.flip)
      .setPosition(x - ORIGIN_X + (view.flip ? FLIP_OFFSET_PX : 0), y - ORIGIN_Y - Math.round(lift))
      .setDepth(p.pos.y);
    view.shadow.setPosition(x - SHADOW.w / 2, y);
    if (state.config.human[p.team] && state.controlled[p.team] === p.id) {
      this.markers[p.team as TeamId].setVisible(true).setPosition(x - 1, y - MARKER.above);
    }
  }
}
