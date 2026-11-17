import Phaser from 'phaser';
import { BootScene } from './BootScene';
import { MatchScene } from './MatchScene';
import { SCREEN_H, SCREEN_W } from './layout';
import { PAL } from '../art/palette';

new Phaser.Game({
  type: Phaser.AUTO,
  width: SCREEN_W,
  height: SCREEN_H,
  pixelArt: true,
  audio: { noAudio: true }, // all sound is our own Web Audio in src/audio
  parent: 'game',
  backgroundColor: PAL.navy,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MatchScene],
});
