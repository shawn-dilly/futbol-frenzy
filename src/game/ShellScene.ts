import Phaser from 'phaser';
import { drawText } from '../art/pixelFont';
import { PAL } from '../art/palette';
import { TEAMS } from '../content/teams';
import { LEVEL_ORDER, type Level } from '../sim';
import { parseMatchParams } from './params';
import { setupConfig, type MatchLength, type SetupSelection } from './setupSelection';
import type { MatchLaunch } from './launch';

const lengths: MatchLength[] = ['short', 'long', 'five'];

/** Friendly match title and setup. */
export class ShellScene extends Phaser.Scene {
  private screen: 'title' | 'setup' = 'title';
  private selection: SetupSelection = { team: 0, opponent: 1, level: 'pro', length: 'short' };
  private focus = 0;
  constructor() { super('shell'); }

  create(): void {
    this.input.keyboard?.on('keydown', this.onKey, this);
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown', this.onKey, this));
    this.render();
  }
  private onKey(event: KeyboardEvent): void {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape'].includes(event.key)) event.preventDefault();
    const count = this.screen === 'title' ? 1 : 6;
    if (event.key === 'ArrowUp') this.focus = (this.focus + count - 1) % count;
    else if (event.key === 'ArrowDown' || event.key === 'Tab') this.focus = (this.focus + (event.shiftKey ? count - 1 : 1)) % count;
    else if (event.key === 'Escape') { this.screen = 'title'; this.focus = 0; }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') this.activate(this.focus, event.key === 'ArrowLeft' ? -1 : 1);
    else if (event.key === 'Enter' || event.key === ' ') this.activate(this.focus, 1);
    this.render();
  }
  private activate(index: number, direction: number): void {
    if (this.screen === 'title') { this.screen = 'setup'; this.focus = 0; return; }
    const s = this.selection;
    if (index === 0) s.team = (s.team + direction + TEAMS.length) % TEAMS.length;
    if (index === 1) s.opponent = (s.opponent + direction + TEAMS.length) % TEAMS.length;
    if (index === 2) s.level = LEVEL_ORDER[(LEVEL_ORDER.indexOf(s.level) + direction + LEVEL_ORDER.length) % LEVEL_ORDER.length] as Level;
    if (index === 3) s.length = lengths[(lengths.indexOf(s.length) + direction + lengths.length) % lengths.length];
    if (index === 4) { this.screen = 'title'; this.focus = 0; }
    if (index === 5) this.startMatch();
  }
  private startMatch(): void {
    const params = parseMatchParams(window.location.search);
    const launch: MatchLaunch = { config: setupConfig(this.selection, params.seed), mode: 'friendly', matchId: null, mute: params.mute };
    this.scene.start('match', launch);
  }
  private render(): void {
    this.children.removeAll(true);
    const g = this.add.graphics();
    const rect = (x: number, y: number, w: number, h: number, color: string) => { g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color); g.fillRect(x, y, w, h); };
    const text = (s: string, x: number, y: number, color: string = PAL.wht, scale = 1, align: 'l' | 'c' = 'l') => drawText(rect, s, x, y, color, scale, align);
    rect(0, 0, 320, 180, PAL.navy);
    const button = (index: number, x: number, y: number, w: number, h: number, label: string, color: string = PAL.dk) => {
      rect(x, y, w, h, index === this.focus ? PAL.yel : PAL.gry); rect(x + 1, y + 1, w - 2, h - 2, color);
      text(label, x + w / 2, y + Math.floor((h - 5) / 2), PAL.wht, 1, 'c');
      this.add.zone(x, y, w, h).setOrigin(0).setInteractive().on('pointerdown', (p: Phaser.Input.Pointer) => { this.focus = index; this.activate(index, p.x < x + w / 2 ? -1 : 1); this.render(); });
    };
    if (this.screen === 'title') {
      for (let i = 0; i < 8; i++) rect(i * 40, 132, 40, 48, i % 2 ? PAL.g1 : PAL.g2);
      text('FUTBOL', 160, 18, PAL.wht, 6, 'c'); text('FRENZY', 160, 57, PAL.yel, 7, 'c');
      button(0, 100, 112, 120, 23, '1P VS CPU', PAL.red);
      return;
    }
    text('MATCH SETUP', 160, 5, PAL.yel, 2, 'c');
    const opponent = this.selection.opponent;
    [this.selection.team, opponent].forEach((teamIndex, side) => {
      const x = side ? 180 : 12; const team = TEAMS[teamIndex]; const col = side ? PAL.blue : PAL.red;
      rect(x, 22, 128, 80, col); rect(x + 1, 23, 126, 78, PAL.dk); rect(x + 1, 23, 126, 12, col);
      text(team.name, x + 64, 26, PAL.ink, 1, 'c'); rect(x + 8, 43, 30, 28, col); text(side ? 'CPU' : 'P1', x + 23, 78, PAL.wht, 1, 'c');
      Object.entries(team.ratings).forEach(([name, value], i) => { const y = 38 + i * 12; text(name, x + 45, y); for (let j = 0; j < 8; j++) rect(x + 45 + j * 8, y + 6, 7, 3, j < Math.round(value * 8) ? PAL.yel : PAL.navy); });
      button(side, x, 88, 128, 13, '<  CHANGE  >');
    });
    text('VS', 160, 55, PAL.wht, 3, 'c');
    button(2, 12, 108, 145, 18, `LEVEL: < ${this.selection.level} >`);
    const label = this.selection.length === 'short' ? '2 X 120S' : this.selection.length === 'long' ? '2 X 240S' : 'FIRST TO 5';
    button(3, 163, 108, 145, 18, `LENGTH: < ${label} >`);
    button(4, 12, 145, 90, 24, '< BACK'); button(5, 110, 145, 198, 24, 'KICK OFF >', PAL.red);
  }
}
