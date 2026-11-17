import Phaser from 'phaser';
import { neutralPad, type PadInput } from '../sim';

export { mergePads } from './stick';

type KeyMap = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'pass' | 'shoot' | 'hit' | 'turbo', Phaser.Input.Keyboard.Key>;

/** Arrows or WASD to move, J pass, K shoot, L hit, Space turbo. */
export class KeyboardPad {
  private readonly keys: KeyMap | null;

  constructor(scene: Phaser.Scene) {
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = scene.input.keyboard?.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D,
      pass: K.J, shoot: K.K, hit: K.L, turbo: K.SPACE,
    }) as KeyMap | null ?? null;
  }

  read(): PadInput {
    const pad = neutralPad();
    const k = this.keys;
    if (!k) return pad;
    pad.moveX = Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown);
    pad.moveY = Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown);
    pad.pass = k.pass.isDown; pad.shoot = k.shoot.isDown; pad.hit = k.hit.isDown; pad.turbo = k.turbo.isDown;
    return pad;
  }
}
