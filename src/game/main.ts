import Phaser from 'phaser';
import { BootScene } from './BootScene';
import { MatchScene } from './MatchScene';

const LOGICAL_WIDTH_PX = 320;
const LOGICAL_HEIGHT_PX = 180;

new Phaser.Game({
  type: Phaser.AUTO,
  width: LOGICAL_WIDTH_PX,
  height: LOGICAL_HEIGHT_PX,
  pixelArt: true,
  parent: 'game',
  backgroundColor: '#16162a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MatchScene],
});
