import { PAL } from '../art/palette';
import { drawText, type RectFn } from '../art/pixelFont';
import { FIELD_H, FIELD_MID_Y, FIELD_W, GOAL_HALF } from '../sim';
import { FIELD_TOP, PITCH_TEX_ORIGIN_X, PITCH_TEX_W, SCREEN_H } from './layout';

const CROWD_DOTS = 672;
const CROWD_TOP = 13, CROWD_DEPTH = 20, CROWD_DOT_PX = 2;
const CROWD_SEED = 11;
const CROWD_COLORS = [PAL.red, PAL.blue, PAL.yel, PAL.wht, PAL.org, PAL.pur, PAL.gry];
const LCG_MUL = 16807, LCG_MOD = 2147483647;

const BOARD_Y = 35, BOARD_H = 9, BOARD_TEXT_DY = 2, BOARD_SPACING = 80, BOARD_FIRST_X = 8;
const ADS: [string, string][] = [
  ['CRUNCH COLA', PAL.yel], ['BONEZ BOOTS', PAL.red], ['NO REF TV', PAL.blue], ['OUCH! GUM', PAL.grn], ['KO', PAL.org],
];

const GRASS_TOP = 44, STRIPE_W = 40;
const CIRCLE_R = 22, LINE_PX = 1.5;
const BIG_BOX_DEPTH = 58, BIG_BOX_HALF_H = 35;
const SMALL_BOX_DEPTH = 24, SMALL_BOX_HALF_H = 17;
const GOAL_DEPTH = 9, NET_STEP = 2;
const NET_COLOR = 'rgba(255,255,255,.25)';

/** Deterministic Park-Miller generator for the crowd; the same dots on every run. */
function crowdRandom(seed: number): () => number {
  let s = seed;
  return () => (s = (s * LCG_MUL) % LCG_MOD) / LCG_MOD;
}

function drawCrowdAndBoards(rect: RectFn): void {
  const rnd = crowdRandom(CROWD_SEED);
  for (let i = 0; i < CROWD_DOTS; i++) {
    const x = Math.floor(rnd() * PITCH_TEX_W);
    const y = CROWD_TOP + Math.floor(rnd() * CROWD_DEPTH);
    rect(x, y, CROWD_DOT_PX, CROWD_DOT_PX, CROWD_COLORS[Math.floor(rnd() * CROWD_COLORS.length)]);
  }
  rect(0, BOARD_Y, PITCH_TEX_W, BOARD_H, PAL.ink);
  for (let i = 0, x = BOARD_FIRST_X; x < PITCH_TEX_W; i++, x += BOARD_SPACING) {
    const [text, color] = ADS[i % ADS.length];
    drawText(rect, text, x, BOARD_Y + BOARD_TEXT_DY, color);
  }
}

function drawRing(rect: RectFn, cx: number, cy: number, radius: number): void {
  const reach = Math.ceil(radius + LINE_PX);
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    if (Math.abs(Math.hypot(dx, dy) - radius) <= LINE_PX / 2) rect(cx + dx, cy + dy, 1, 1, PAL.line);
  }
}

/** One end of the pitch. `dir` is +1 for the goal at the right end (world x FIELD_W), -1 for the left. */
function drawEnd(rect: RectFn, dir: 1 | -1): void {
  const lineX = dir > 0 ? FIELD_W - 1 : 0;
  const mid = FIELD_TOP + FIELD_MID_Y;
  /** Horizontal span from world x `from` running `len` pixels away from the goal line. */
  const span = (from: number, len: number, y: number, h: number, color: string) =>
    rect(PITCH_TEX_ORIGIN_X + (dir > 0 ? from - len + 1 : from), y, len, h, color);
  const box = (depth: number, halfH: number) => {
    span(lineX, depth, mid - halfH, 1, PAL.line);
    span(lineX, depth, mid + halfH, 1, PAL.line);
    rect(PITCH_TEX_ORIGIN_X + lineX - dir * (depth - 1), mid - halfH, 1, 2 * halfH + 1, PAL.line);
  };
  box(BIG_BOX_DEPTH, BIG_BOX_HALF_H);
  box(SMALL_BOX_DEPTH, SMALL_BOX_HALF_H);
  rect(PITCH_TEX_ORIGIN_X + lineX, FIELD_TOP, 1, FIELD_H, PAL.line);
  const goalX = dir > 0 ? FIELD_W : -GOAL_DEPTH;
  const outerX = dir > 0 ? FIELD_W + GOAL_DEPTH - 1 : -GOAL_DEPTH;
  rect(PITCH_TEX_ORIGIN_X + goalX, mid - GOAL_HALF, GOAL_DEPTH, 1, PAL.wht);
  rect(PITCH_TEX_ORIGIN_X + goalX, mid + GOAL_HALF - 1, GOAL_DEPTH, 1, PAL.wht);
  rect(PITCH_TEX_ORIGIN_X + outerX, mid - GOAL_HALF, 1, 2 * GOAL_HALF, PAL.wht);
  for (let i = 0; i < GOAL_DEPTH / NET_STEP; i++) {
    rect(PITCH_TEX_ORIGIN_X + goalX + i * NET_STEP + (dir > 0 ? 0 : 1), mid - GOAL_HALF + 1, 1, 2 * GOAL_HALF - 2, NET_COLOR);
  }
}

/** Draws the static scrolling background (crowd, ad boards, grass, markings, goals) onto a PITCH_TEX_W x SCREEN_H canvas. */
export function drawPitch(rect: RectFn): void {
  rect(0, 0, PITCH_TEX_W, SCREEN_H, PAL.navy);
  drawCrowdAndBoards(rect);
  const firstStripe = Math.floor(-PITCH_TEX_ORIGIN_X / STRIPE_W);
  for (let i = firstStripe; i * STRIPE_W < PITCH_TEX_W - PITCH_TEX_ORIGIN_X; i++) {
    rect(PITCH_TEX_ORIGIN_X + i * STRIPE_W, GRASS_TOP, STRIPE_W, SCREEN_H - GRASS_TOP, Math.abs(i) % 2 ? PAL.g1 : PAL.g2);
  }
  rect(PITCH_TEX_ORIGIN_X, FIELD_TOP, FIELD_W, 1, PAL.line);
  rect(PITCH_TEX_ORIGIN_X, FIELD_TOP + FIELD_H - 1, FIELD_W, 1, PAL.line);
  rect(PITCH_TEX_ORIGIN_X + FIELD_W / 2, FIELD_TOP, 1, FIELD_H, PAL.line);
  drawRing(rect, PITCH_TEX_ORIGIN_X + FIELD_W / 2, FIELD_TOP + FIELD_MID_Y, CIRCLE_R);
  drawEnd(rect, 1);
  drawEnd(rect, -1);
}

/** Over-the-top crater decal: a dark oval with a deeper hole, drawn on its own small texture. */
const CRATER_ROW_WIDTHS = [10, 14, 16, 14, 10];
const CRATER_RIM_INSET = 2; // px between the rim edge and the hole, each side
export const CRATER_W = Math.max(...CRATER_ROW_WIDTHS);
export const CRATER_H = CRATER_ROW_WIDTHS.length;

export function drawCrater(rect: RectFn): void {
  CRATER_ROW_WIDTHS.forEach((w, row) => {
    rect((CRATER_W - w) / 2, row, w, 1, PAL.dk);
    const hole = w - 2 * CRATER_RIM_INSET;
    if (row > 0 && row < CRATER_H - 1) rect((CRATER_W - hole) / 2, row, hole, 1, PAL.ink);
  });
}
