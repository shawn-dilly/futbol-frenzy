# Futbol Frenzy M1 — Playable Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 5-a-side match you can play in a browser and on an Android phone: move, pass, shoot, score against a basic computer side, with a clock, two halves, and a final score. No tackling yet (that is M2).

**Architecture:** A deterministic match simulation in pure TypeScript (`src/sim/`) advanced at a fixed 60 ticks per second by one `step(state, inputs)` function. Phaser 4 scenes draw the state, turn touches into inputs, and turn sim events into sound; they never change match state. Capacitor 8 wraps the built web app for Android.

**Tech Stack:** TypeScript 7, Phaser 4.2, Vite 8, Vitest 5, Playwright (e2e smoke and screenshots), Capacitor 8, Node 22.

**Spec:** `docs/superpowers/specs/2026-11-16-futbol-frenzy-design.md`. Visual reference: `mockups.html` in the project root (open it in a browser; its drawing code is the source for the palette, font, and sprites).

## Global Constraints

- Logical resolution is exactly 320x180, pixel-art rendering, scaled to fit, landscape only.
- `src/sim/` imports nothing from Phaser, the DOM, or any other `src/` folder, and never calls `Math.random`, `Date.now`, or `performance.now`. Randomness comes only from `nextRandom(state)`.
- The sim runs at 60 ticks per second. All sim durations are in ticks; all speeds in `constants.ts` are game units per second and are divided by `TICK_HZ` when applied.
- Every tunable number lives in `src/sim/constants.ts` with the exact values listed in Task 2. Do not inline them.
- The game is named "Futbol Frenzy". Teams are fictional: "IRON RHINOS" (red, team 0, attacks right) and "NEON VIPERS" (blue, team 1, attacks left).
- All art is drawn in code and all sound is synthesised in code. No image or audio files in M1.
- Phaser 4 and Capacitor 8 differ from older versions. Before using an API you are unsure of, check current docs: `npx ctx7@latest library "Phaser" "<topic>"` then `npx ctx7@latest docs <id> "<topic>"`.
- Commit after every task. Commit messages end with the trailer the session's instructions give for agent commits.

## Suggested model per task

Opus: Tasks 2 to 7 and 9 (rules, interfaces, and the frame loop that everything else depends on). Sonnet: Tasks 1, 8, 10, 11, 12, 13 (scaffolding, porting the mockup art, input, sound, packaging).

## Review Focus

1. **Tab or app backgrounded, then resumed.** The frame delta is huge; the match must not fast-forward or freeze the device. Expected: at most 5 sim steps per frame, the rest dropped. Test in Task 9.
2. **Stick pushed diagonally, or past its radius.** Expected: diagonal speed equals straight speed, never faster. Tests in Tasks 3 and 10.
3. **A touch that ends off-canvas or is cancelled by the OS** (notification shade, palm). Expected: the stick returns to neutral and no button stays held. Test in Task 10.
4. **A fast diagonal shot near a post or into a corner.** Expected: it is a goal only if it crosses the goal line inside the mouth; otherwise it bounces and never leaves the pitch or sticks in a corner. Tests in Task 4.
5. **Sound before the first touch.** Browsers and WebViews block audio until a user gesture. Expected: no errors before the first touch, sound works after it. Test in Task 11.

## File Structure

```
index.html                     page shell, black background, #game container
src/sim/types.ts               all sim types
src/sim/constants.ts           every tunable number
src/sim/vec.ts                 2D vector helpers
src/sim/rng.ts                 seeded random
src/sim/setup.ts               createMatch, formations, kickoff placement
src/sim/movement.ts            player movement, turbo bursts
src/sim/ball.ts                free-ball physics, walls, goal-line crossing
src/sim/possession.ts          pickup, dribble, pass, shoot, control switching
src/sim/brain.ts               placeholder computer intents (replaced in M3)
src/sim/flow.ts                phases, clock, goals, halves
src/sim/step.ts                step(): the one entry point that advances a tick
src/sim/index.ts               public exports
src/art/palette.ts             colour constants from the mockup
src/art/pixelFont.ts           3x5 glyph table, drawText
src/art/sprites.ts             player frame drawing, atlas builder
src/game/main.ts               Phaser game config and boot
src/game/loop.ts               FixedStepper
src/game/BootScene.ts          builds textures, starts MatchScene
src/game/MatchScene.ts         owns MatchState, runs the loop, wires input/view/sound
src/game/MatchView.ts          draws pitch, players, ball, camera
src/game/Hud.ts                score bar, clock, turbo pips, banners
src/input/stick.ts             stick math (pure)
src/input/TouchControls.ts     on-screen stick and buttons
src/input/keyboard.ts          desktop keys
src/audio/sfx.ts               synthesised effects
tests/sim/*.test.ts            one file per sim module
tests/helpers.ts               neutralPad, runTicks
tests/game/*.test.ts, tests/input/*.test.ts, tests/art/*.test.ts, tests/audio/*.test.ts
e2e/demo.spec.ts               headless smoke test and screenshot
android/                       Capacitor project (generated)
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`, `index.html`, `src/game/main.ts`, `tests/sim/purity.test.ts`

**Interfaces:**
- Produces: npm scripts `dev` (Vite on port 5173), `build` (`tsc --noEmit && vite build`, output `dist/`), `test` (`vitest run`), `typecheck`. A page with a `#game` div holding a 320x180 Phaser canvas.

- [x] **Step 1:** `git init` in the project root. Add `.gitignore` with `node_modules`, `dist`, `artifacts`, `test-results`, `android/app/build`, `android/.gradle`, `android/build`.
- [x] **Step 2:** `npm init -y`, then `npm i phaser@^4.2` and `npm i -D typescript@^7 vite@^8 vitest@^5`. Set `"type": "module"` and the scripts above. `tsconfig.json`: `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `noEmit: true`, include `src`, `tests`, `e2e`. `vitest.config.ts`: `environment: 'node'`, include `tests/**/*.test.ts`.
- [x] **Step 3:** Write the failing purity test.

```ts
// tests/sim/purity.test.ts
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { test, expect } from 'vitest';
test('sim is pure: no engine, DOM, clock, or Math.random', () => {
  expect(existsSync('src/sim')).toBe(true);
  for (const f of readdirSync('src/sim')) {
    const src = readFileSync(`src/sim/${f}`, 'utf8');
    expect(src, f).not.toMatch(/from ['"]phaser['"]|from ['"]\.\.\/|Math\.random|Date\.now|performance\.now|\bwindow\b|\bdocument\b/);
  }
});
```

- [x] **Step 4:** Run `npm test`. Expected: FAIL, `src/sim` does not exist. Create `src/sim/index.ts` containing `export {};`. Run again. Expected: PASS.
- [x] **Step 5:** `index.html`: black page, no margins, `touch-action: none; user-select: none`, viewport meta `width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no`, title "Futbol Frenzy", a `#game` div filling the window. `src/game/main.ts`: create a `Phaser.Game` with `width: 320`, `height: 180`, `pixelArt: true`, `parent: 'game'`, `backgroundColor: '#16162a'`, scale mode FIT with centring on both axes, and one empty scene.
- [x] **Step 6:** Run `npm run build`. Expected: exits 0, `dist/index.html` exists. Run `npm run dev`, open the page, confirm a navy 16:9 rectangle that letterboxes when the window is resized.
- [x] **Step 7:** Commit: `chore: scaffold Futbol Frenzy (Vite, Phaser 4, Vitest)`.

---

### Task 2: Sim foundations — types, constants, vectors, random, match setup

**Files:**
- Create: `src/sim/types.ts`, `src/sim/constants.ts`, `src/sim/vec.ts`, `src/sim/rng.ts`, `src/sim/setup.ts`, `tests/helpers.ts`, `tests/sim/setup.test.ts`, `tests/sim/rng.test.ts`
- Modify: `src/sim/index.ts` (re-export everything public)

**Interfaces:**
- Produces (every later task uses these exact names):

```ts
// types.ts
export type Vec = { x: number; y: number };
export type TeamId = 0 | 1;
export type Phase = 'kickoff' | 'play' | 'goal' | 'halftime' | 'fulltime';
export type AnimName = 'idle' | 'run' | 'kick';
export interface PadInput { moveX: number; moveY: number; pass: boolean; shoot: boolean; hit: boolean; turbo: boolean }
export interface PlayerIntent { moveX: number; moveY: number; pass: boolean; shoot: boolean; turbo: boolean }
export interface PlayerState {
  id: number; team: TeamId; role: 'gk' | 'out';
  pos: Vec; vel: Vec; facing: Vec; anchor: Vec;
  kickCooldown: number; turboTicks: number; anim: AnimName; animTick: number;
}
export interface BallState { pos: Vec; vel: Vec; owner: number | null; ownerTicks: number; passTarget: number | null }
export interface MatchConfig { seed: number; halfSeconds: number; human: [boolean, boolean] }
export type SimEvent =
  | { type: 'kick'; kind: 'pass' | 'shot'; player: number }
  | { type: 'bounce' }
  | { type: 'goal'; team: TeamId }
  | { type: 'whistle'; what: 'kickoff' | 'halftime' | 'fulltime' };
export interface MatchState {
  config: MatchConfig; tick: number; rng: number;
  phase: Phase; phaseTicks: number; half: 1 | 2; clockTicks: number;
  score: [number, number]; kickoffTeam: TeamId;
  players: PlayerState[]; ball: BallState;
  controlled: [number, number]; turbo: [number, number];
  prevInput: [PadInput, PadInput]; events: SimEvent[];
}
// vec.ts
export const add, sub, scale: ...; export function len(v: Vec): number; export function dist(a: Vec, b: Vec): number;
export function norm(v: Vec): Vec;            // zero vector stays zero
export function clampLen(v: Vec, max: number): Vec;
export function angleBetween(a: Vec, b: Vec): number; // radians, 0..PI
// rng.ts
export function nextRandom(state: { rng: number }): number; // mulberry32, returns [0,1), advances state.rng
// setup.ts
export function createMatch(config: MatchConfig): MatchState;
export function placeForKickoff(state: MatchState, kicking: TeamId): void;
export function attackDir(team: TeamId): 1 | -1;         // team 0 → 1
export function goalCenter(defending: TeamId): Vec;       // team 0 → {x:0,y:62}
export function neutralPad(): PadInput;
// tests/helpers.ts
export function runTicks(state: MatchState, n: number, inputs?: [PadInput, PadInput]): void; // calls step n times (step arrives in Task 3; until then the helper file only exports what exists)
```

- Constants (exact values):

```ts
export const TICK_HZ = 60;
export const FIELD_W = 480, FIELD_H = 124, FIELD_MID_Y = 62, GOAL_HALF = 16;
export const PLAYER_RADIUS = 4, BALL_RADIUS = 2;
export const RUN_SPEED = 60, TURBO_SPEED = 92;
export const GK_SPEED = 40; // units/s, keepers are slower than outfield players
export const TURBO_BURST_TICKS = 90, TURBO_COST = 1 / 3, TURBO_REFILL_PER_TICK = 1 / (12 * 60);
export const PASS_SPEED = 150, SHOT_SPEED = 220;
export const BALL_FRICTION = 0.985, BALL_STOP_SPEED = 4, WALL_RESTITUTION = 0.7;
export const PICKUP_RADIUS = 6, KICK_COOLDOWN_TICKS = 15, DRIBBLE_OFFSET = 7, KICK_ANIM_TICKS = 12;
export const PICKUP_MAX_BALL_SPEED = 170; // units/s; outfield players cannot trap a faster ball
export const PASS_CONE_RAD = Math.PI / 3;
export const KICKOFF_PAUSE_TICKS = 60, GOAL_PAUSE_TICKS = 120, HALFTIME_PAUSE_TICKS = 180;
export const KICKER_BEHIND_BALL = 6; // units behind the ball on the kicker's own side at kickoff
export const DEFAULT_HALF_SECONDS = 120;
export const CPU_SHOOT_RANGE = 90, GK_HOLD_TICKS = 30, GK_LINE_X = 12;
export const ANCHOR_SHIFT_X = 0.35, ANCHOR_SHIFT_Y = 0.3;
export const ARRIVE_DIST = 3; // units: closer than this to a stand-here target means stand still
export const SHOT_Y_MARGIN = 3; // units kept between a CPU shot's aim point and the post
export const FORMATION: Vec[] = [ // team 0; team 1 mirrors x → FIELD_W - x. Index 0 is the keeper.
  { x: 12, y: 62 }, { x: 100, y: 62 }, { x: 160, y: 28 }, { x: 160, y: 96 }, { x: 220, y: 62 },
];
```

- Player ids: 0 to 4 are team 0, 5 to 9 are team 1; ids 0 and 5 are keepers. `players[i].id === i`.
- `placeForKickoff`: every player to their anchor with zero velocity, facing the opponent goal; ball at `{240, 62}` with zero velocity, `ownerTicks 0`, `passTarget null`; the kicking team's last formation player (id 4 or 9) moves to 6 units behind the ball on their own side and becomes `ball.owner`; `controlled[kicking]` is the kicker; `controlled[other]` is that team's outfield player nearest the ball; `phase = 'kickoff'`, `phaseTicks = KICKOFF_PAUSE_TICKS`; pushes `{type:'whistle', what:'kickoff'}`.
- `createMatch`: `tick 0`, `rng = config.seed`, `half 1`, `clockTicks = halfSeconds * TICK_HZ`, score `[0,0]`, turbo `[1,1]`, `kickoffTeam 0`, then `placeForKickoff(state, 0)`.

- [x] **Step 1: Write the failing tests**

```ts
// tests/sim/setup.test.ts
const cfg = { seed: 1, halfSeconds: 120, human: [true, false] as [boolean, boolean] };
test('ten players, mirrored, in their own halves', () => {
  const s = createMatch(cfg);
  expect(s.players).toHaveLength(10);
  s.players.forEach((p, i) => expect(p.id).toBe(i));
  expect(s.players[0].role).toBe('gk'); expect(s.players[5].role).toBe('gk');
  expect(s.players[5].anchor).toEqual({ x: 468, y: 62 });
  expect(s.players[7].anchor).toEqual({ x: 320, y: 28 });
});
test('kickoff: team 0 striker owns the ball at the centre spot', () => {
  const s = createMatch(cfg);
  expect(s.ball.pos).toEqual({ x: 240, y: 62 });
  expect(s.ball.owner).toBe(4); expect(s.controlled[0]).toBe(4);
  expect(s.players[4].pos).toEqual({ x: 234, y: 62 });
  expect(s.phase).toBe('kickoff'); expect(s.clockTicks).toBe(7200);
});
test('attackDir and goalCenter', () => {
  expect(attackDir(0)).toBe(1); expect(attackDir(1)).toBe(-1);
  expect(goalCenter(1)).toEqual({ x: 480, y: 62 });
});
// tests/sim/rng.test.ts
test('same seed gives the same sequence, in [0,1)', () => {
  const a = { rng: 42 }, b = { rng: 42 };
  const xs = Array.from({ length: 100 }, () => nextRandom(a));
  expect(Array.from({ length: 100 }, () => nextRandom(b))).toEqual(xs);
  expect(xs.every(x => x >= 0 && x < 1)).toBe(true);
  expect(new Set(xs).size).toBeGreaterThan(95);
});
```

- [x] **Step 2:** Run `npm test`. Expected: FAIL, modules not found.
- [x] **Step 3:** Implement the five files to the interfaces above.
- [x] **Step 4:** Run `npm test`. Expected: PASS, including the purity test.
- [x] **Step 5:** Commit: `feat(sim): types, constants, vectors, seeded random, match setup`.

---

### Task 3: Player movement, turbo bursts, and the step skeleton

**Files:**
- Create: `src/sim/movement.ts`, `src/sim/step.ts`, `tests/sim/movement.test.ts`
- Modify: `tests/helpers.ts` (add `runTicks`), `src/sim/index.ts`

**Interfaces:**
- Consumes: Task 2 types, constants, `createMatch`, `neutralPad`.
- Produces:

```ts
// movement.ts
export function applyMovement(state: MatchState, p: PlayerState, intent: PlayerIntent): void;
export function updateTurboMeters(state: MatchState): void;
// step.ts
export function step(state: MatchState, inputs: [PadInput, PadInput]): void;
export function padToIntent(pad: PadInput, prev: PadInput): PlayerIntent; // pass/shoot/turbo true only on the tick the button goes down
```

- `applyMovement`: direction is `(moveX, moveY)` with length clamped to 1. Speed is `TURBO_SPEED` while `p.turboTicks > 0`, else `RUN_SPEED`. If `intent.turbo` and the team meter is at least `TURBO_COST` and `p.turboTicks === 0`: subtract `TURBO_COST`, set `p.turboTicks = TURBO_BURST_TICKS`. Decrement `turboTicks` each tick. Position clamps to `[PLAYER_RADIUS, FIELD_W - PLAYER_RADIUS]` by `[PLAYER_RADIUS, FIELD_H - PLAYER_RADIUS]`. `facing` updates to the move direction when it is non-zero. `anim` is `'run'` when moving, `'idle'` when not, unless a `'kick'` anim has `animTick < KICK_ANIM_TICKS`; `animTick` increments each tick and resets to 0 when `anim` changes.
- `updateTurboMeters`: each team meter rises by `TURBO_REFILL_PER_TICK`, capped at 1.
- `step` in this task: clear `state.events`; for each team where `config.human[team]` is true, the controlled player's intent is `padToIntent(inputs[team], state.prevInput[team])` and every other player's intent is all-zero (the brain arrives in Task 7); if `phase` is `'kickoff'`, count `phaseTicks` down and switch to `'play'` at 0 without moving anyone; if `'play'`, apply movement and turbo meters; store `prevInput`; `tick += 1`. Later tasks extend this function at the marked points; keep each phase's work in a small function.

- [x] **Step 1: Write the failing tests**

```ts
// tests/sim/movement.test.ts
const cfg = { seed: 1, halfSeconds: 120, human: [true, false] as [boolean, boolean] };
const pad = (o: Partial<PadInput>) => ({ ...neutralPad(), ...o });
const playing = () => { const s = createMatch(cfg); runTicks(s, 60); expect(s.phase).toBe('play'); return s; };
test('nobody moves during the kickoff pause', () => {
  const s = createMatch(cfg); const x0 = s.players[4].pos.x;
  runTicks(s, 59, [pad({ moveX: 1 }), neutralPad()]);
  expect(s.players[4].pos.x).toBe(x0);
});
test('runs at 60 units per second', () => {
  const s = playing(); const x0 = s.players[4].pos.x;
  runTicks(s, 60, [pad({ moveX: 1 }), neutralPad()]);
  expect(s.players[4].pos.x - x0).toBeCloseTo(60, 1);
  expect(s.players[4].anim).toBe('run'); expect(s.players[4].facing).toEqual({ x: 1, y: 0 });
});
test('diagonal and oversized stick input is not faster', () => {
  const s = playing(); const p0 = { ...s.players[4].pos };
  runTicks(s, 30, [pad({ moveX: 3, moveY: -3 }), neutralPad()]);
  expect(dist(s.players[4].pos, p0)).toBeCloseTo(30, 1);
});
test('turbo tap: one burst of 90 ticks at 92, costs a third, needs a new press', () => {
  const s = playing(); const x0 = s.players[4].pos.x;
  runTicks(s, 90, [pad({ moveX: 1, turbo: true }), neutralPad()]);   // held the whole time
  expect(s.players[4].pos.x - x0).toBeCloseTo(92 * 1.5, 0);
  expect(s.turbo[0]).toBeGreaterThan(0.66); expect(s.turbo[0]).toBeLessThan(0.8);
  expect(s.players[4].turboTicks).toBe(0);
});
test('no burst when the meter is under a third', () => {
  const s = playing(); s.turbo[0] = 0.2;
  runTicks(s, 1, [pad({ moveX: 1, turbo: true }), neutralPad()]);
  expect(s.players[4].turboTicks).toBe(0);
});
test('players stay on the pitch', () => {
  const s = playing();
  runTicks(s, 600, [pad({ moveX: -1, moveY: -1 }), neutralPad()]);
  expect(s.players[4].pos).toEqual({ x: 4, y: 4 });
});
```

- [x] **Step 2:** Run `npm test`. Expected: FAIL.
- [x] **Step 3:** Implement `movement.ts`, `step.ts`, `runTicks`.
- [x] **Step 4:** Run `npm test`. Expected: PASS.
- [x] **Step 5:** Commit: `feat(sim): player movement, turbo bursts, step loop`.

---

### Task 4: Ball physics, walls, and goal-line crossing

**Files:**
- Create: `src/sim/ball.ts`, `tests/sim/ball.test.ts`
- Modify: `src/sim/step.ts` (call `moveFreeBall` during `'play'`, after movement)

**Interfaces:**
- Produces: `export function moveFreeBall(state: MatchState): TeamId | null;` Returns the scoring team when the ball crosses a goal line inside the mouth this tick, else `null`. Does nothing and returns `null` when `ball.owner !== null`.
- Rules: advance by `vel / TICK_HZ`; then `vel *= BALL_FRICTION`; if speed is below `BALL_STOP_SPEED`, velocity becomes zero. Top and bottom walls (`y < BALL_RADIUS` or `y > FIELD_H - BALL_RADIUS`): reflect position, `vel.y *= -WALL_RESTITUTION`, push `{type:'bounce'}`. End lines (`x < 0` or `x > FIELD_W`): compute the y at which the ball's path this tick crossed the line by linear interpolation; if `|y - FIELD_MID_Y| <= GOAL_HALF` it is a goal (crossing `x < 0` scores for team 1, `x > FIELD_W` for team 0) and the ball stops where it is; otherwise reflect position about the line, `vel.x *= -WALL_RESTITUTION`, push `{type:'bounce'}`. Resolve the end line before the side walls so a corner hit handles both in one tick.
- `step` ignores the return value until Task 6.

- [x] **Step 1: Write the failing tests**

```ts
// tests/sim/ball.test.ts — each test builds a state in 'play' and sets ball.owner = null, then sets pos/vel directly
test('friction slows the ball to a full stop', () => {
  s.ball.pos = { x: 240, y: 62 }; s.ball.vel = { x: 150, y: 0 };
  for (let i = 0; i < 600; i++) moveFreeBall(s);
  expect(s.ball.vel).toEqual({ x: 0, y: 0 });
  expect(s.ball.pos.x).toBeGreaterThan(300); expect(s.ball.pos.x).toBeLessThan(420);
});
test('bounces off the top wall and loses speed', () => {
  s.ball.pos = { x: 240, y: 4 }; s.ball.vel = { x: 0, y: -120 };
  for (let i = 0; i < 5; i++) moveFreeBall(s);
  expect(s.ball.vel.y).toBeGreaterThan(0); expect(s.ball.vel.y).toBeLessThan(120 * 0.7 + 0.01);
  expect(s.ball.pos.y).toBeGreaterThanOrEqual(2);
  expect(s.events.some(e => e.type === 'bounce')).toBe(true);
});
test('straight shot into the right goal scores for team 0', () => {
  s.ball.pos = { x: 478, y: 62 }; s.ball.vel = { x: 220, y: 0 };
  expect(moveFreeBall(s)).toBe(0);
});
test('shot into the left goal scores for team 1', () => {
  s.ball.pos = { x: 2, y: 70 }; s.ball.vel = { x: -220, y: 0 };
  expect(moveFreeBall(s)).toBe(1);
});
test('fast diagonal that crosses the line just outside the post bounces', () => {
  s.ball.pos = { x: 478, y: 84 }; s.ball.vel = { x: 200, y: -90 };   // crosses near y ≈ 83.1, post is at 78
  expect(moveFreeBall(s)).toBeNull();
  expect(s.ball.pos.x).toBeLessThanOrEqual(480); expect(s.ball.vel.x).toBeLessThan(0);
});
test('fast diagonal that crosses the line just inside the post is a goal', () => {
  s.ball.pos = { x: 478, y: 79.5 }; s.ball.vel = { x: 200, y: -180 }; // crosses near y ≈ 77.7
  expect(moveFreeBall(s)).toBe(0);
});
test('a ball fired into a corner stays on the pitch and keeps moving', () => {
  s.ball.pos = { x: 476, y: 4 }; s.ball.vel = { x: 220, y: -220 };
  for (let i = 0; i < 30; i++) {
    expect(moveFreeBall(s)).toBeNull();
    expect(s.ball.pos.x).toBeGreaterThanOrEqual(0); expect(s.ball.pos.x).toBeLessThanOrEqual(480);
    expect(s.ball.pos.y).toBeGreaterThanOrEqual(2); expect(s.ball.pos.y).toBeLessThanOrEqual(122);
  }
  expect(s.ball.pos.x).toBeLessThan(470);
});
test('an owned ball is left alone', () => {
  s.ball.owner = 4; s.ball.vel = { x: 100, y: 0 }; const p = { ...s.ball.pos };
  expect(moveFreeBall(s)).toBeNull(); expect(s.ball.pos).toEqual(p);
});
```

- [x] **Step 2:** Run `npm test`. Expected: FAIL.
- [x] **Step 3:** Implement `ball.ts` and the `step` call.
- [x] **Step 4:** Run `npm test`. Expected: PASS.
- [x] **Step 5:** Commit: `feat(sim): ball physics, wall bounces, goal-line crossing`.

---

### Task 5: Possession, dribbling, passing, shooting, control switching

**Files:**
- Create: `src/sim/possession.ts`, `tests/sim/possession.test.ts`
- Modify: `src/sim/step.ts`

**Interfaces:**
- Produces:

```ts
export function updatePossession(state: MatchState): void;   // pickup + dribble position; call after movement, before moveFreeBall
export function pickPassTarget(state: MatchState, passer: PlayerState, aim: Vec): number; // teammate id
export function kick(state: MatchState, p: PlayerState, kind: 'pass' | 'shot', aim: Vec): void;
export function switchControl(state: MatchState, team: TeamId): void;
```

- `updatePossession`: decrement every player's `kickCooldown` to a floor of 0. If the ball is free, the nearest player within `PICKUP_RADIUS` whose `kickCooldown` is 0 becomes owner (ties go to the lower id); set `ownerTicks = 0`, zero the ball velocity, and set `controlled[owner.team] = owner.id`. If the ball is owned: `ownerTicks += 1` and the ball sits at `owner.pos + owner.facing * DRIBBLE_OFFSET`, clamped inside the pitch (`x` in `[BALL_RADIUS, FIELD_W - BALL_RADIUS]`), so a carried ball can never score.
- `pickPassTarget`: among teammates other than the passer: if `aim` is non-zero, the one with the smallest angle between `aim` and the direction to them, provided it is within `PASS_CONE_RAD`; if `aim` is zero or nobody is in the cone, the nearest teammate.
- `kick`: only acts if `p` owns the ball. Pass: velocity is `PASS_SPEED` toward the target's current position; `ball.passTarget` is the target's id; and if the passer's team is human, `controlled[team]` switches to the target immediately so the person steers the receiver onto the ball. A shot sets `ball.passTarget = null`; so does any pickup. Shot: velocity is `SHOT_SPEED` along `aim` if non-zero, else toward `goalCenter` of the opposing team. Then `ball.owner = null`, `p.kickCooldown = KICK_COOLDOWN_TICKS`, `p.anim = 'kick'`, `p.animTick = 0`, push `{type:'kick', kind, player: p.id}`. The ball starts from its dribble position.
- `switchControl`: `controlled[team]` becomes that team's outfield player nearest the ball.
- `step` changes: for a human team's controlled player, `intent.pass` with the ball calls `kick(..., 'pass', moveDir)`; `intent.pass` without the ball calls `switchControl`; `intent.shoot` with the ball calls `kick(..., 'shot', moveDir)`. Order within a `'play'` tick: intents → kicks → movement → `updatePossession` → `moveFreeBall`.

- [x] **Step 1: Write the failing tests**

```ts
// tests/sim/possession.test.ts — state in 'play' via createMatch + 60 ticks; player 4 owns the ball
test('the ball is carried 7 units ahead of the owner', () => {
  runTicks(s, 30, [pad({ moveX: 1 }), neutralPad()]);
  expect(s.ball.owner).toBe(4);
  expect(s.ball.pos.x - s.players[4].pos.x).toBeCloseTo(7, 5);
});
test('pass with no stick goes to the nearest teammate and leaves the passer', () => {
  runTicks(s, 1, [pad({ pass: true }), neutralPad()]);
  expect(s.ball.owner).toBeNull();
  expect(len(s.ball.vel)).toBeCloseTo(150 * 0.985, 0);
  expect(s.events).toContainEqual({ type: 'kick', kind: 'pass', player: 4 });
  expect(s.players[4].anim).toBe('kick');
});
test('pass with the stick up-left picks the teammate in that direction', () => {
  expect(pickPassTarget(s, s.players[4], { x: -1, y: -0.6 })).toBe(2);   // anchor (160,28)
  expect(pickPassTarget(s, s.players[4], { x: -1, y: 0.6 })).toBe(3);    // anchor (160,96)
  expect(pickPassTarget(s, s.players[4], { x: 1, y: 0 })).toBe(2);       // nobody ahead: falls back to nearest (2 wins the tie with 3 by id)
});
test('a completed pass gives the receiver the ball and control', () => {
  runTicks(s, 1, [pad({ moveX: -1, moveY: -0.6, pass: true }), neutralPad()]);
  expect(s.ball.passTarget).toBe(2); expect(s.controlled[0]).toBe(2);   // control moves to the receiver at once
  runTicks(s, 90);
  expect(s.ball.owner).toBe(2); expect(s.ball.passTarget).toBeNull();
});
test('the passer cannot re-collect for 15 ticks', () => {
  runTicks(s, 1, [pad({ pass: true }), neutralPad()]);
  expect(s.players[4].kickCooldown).toBe(15);
  runTicks(s, 3); expect(s.ball.owner).not.toBe(4);
});
test('shoot with no stick aims at the opponent goal centre at 220', () => {
  runTicks(s, 1, [pad({ shoot: true }), neutralPad()]);
  expect(s.ball.vel.x).toBeGreaterThan(200); expect(Math.abs(s.ball.vel.y)).toBeLessThan(5);
  expect(s.events).toContainEqual({ type: 'kick', kind: 'shot', player: 4 });
});
test('holding pass does not fire twice', () => {
  runTicks(s, 1, [pad({ moveX: -1, moveY: -0.6, pass: true }), neutralPad()]);
  runTicks(s, 120, [pad({ pass: true }), neutralPad()]);
  expect(s.ball.owner).toBe(2);
});
test('pass without the ball switches control to the outfield teammate nearest the ball', () => {
  s.ball.owner = null; s.ball.pos = { x: 150, y: 30 }; s.ball.vel = { x: 0, y: 0 }; s.players[2].kickCooldown = 999;
  runTicks(s, 1, [pad({ pass: true }), neutralPad()]);
  expect(s.controlled[0]).toBe(2);
});
test('a carried ball pushed against the goal line does not score or leave the pitch', () => {
  s.players[4].pos = { x: 474, y: 62 };
  runTicks(s, 60, [pad({ moveX: 1 }), neutralPad()]);
  expect(s.ball.pos.x).toBeLessThanOrEqual(478); expect(s.score).toEqual([0, 0]);
});
```

- [x] **Step 2:** Run `npm test`. Expected: FAIL.
- [x] **Step 3:** Implement `possession.ts` and the `step` changes.
- [x] **Step 4:** Run `npm test`. Expected: PASS.
- [x] **Step 5:** Commit: `feat(sim): possession, dribbling, pass, shoot, control switching`.

---

### Task 6: Match flow — goals, clock, halves, full time

**Files:**
- Create: `src/sim/flow.ts`, `tests/sim/flow.test.ts`
- Modify: `src/sim/step.ts`

**Interfaces:**
- Produces: `export function advanceFlow(state: MatchState, scored: TeamId | null): void;` called once at the end of every tick with the value `moveFreeBall` returned (or `null` outside `'play'`).
- Rules:
  - `'kickoff'`: count down `phaseTicks`; at 0 → `'play'`. (Move the Task 3 countdown here.)
  - `'play'`: if `scored !== null`: `score[scored] += 1`, push `{type:'goal', team: scored}`, `phase = 'goal'`, `phaseTicks = GOAL_PAUSE_TICKS`, `kickoffTeam` becomes the conceding team. Otherwise `clockTicks -= 1`; at 0: in half 1 → `'halftime'`, `phaseTicks = HALFTIME_PAUSE_TICKS`, push `whistle halftime`; in half 2 → `'fulltime'`, push `whistle fulltime`.
  - `'goal'`: nobody acts; the ball stays put; at `phaseTicks` 0 → `placeForKickoff(state, kickoffTeam)`.
  - `'halftime'`: at `phaseTicks` 0 → `half = 2`, `clockTicks = halfSeconds * TICK_HZ`, `placeForKickoff(state, 1)`.
  - `'fulltime'`: terminal. `step` still clears events and advances `tick`, nothing else changes.
  - The clock only runs during `'play'`.

- [x] **Step 1: Write the failing tests**

```ts
// tests/sim/flow.test.ts
const short = { seed: 1, halfSeconds: 2, human: [true, true] as [boolean, boolean] };   // both human with neutral pads: nobody shoots, so tick counts are exact
test('a goal scores, pauses 120 ticks, then the conceding team kicks off', () => {
  const s = createMatch(cfg); runTicks(s, 60);
  s.ball.owner = null; s.ball.pos = { x: 478, y: 62 }; s.ball.vel = { x: 220, y: 0 };
  runTicks(s, 1);
  expect(s.score).toEqual([1, 0]); expect(s.phase).toBe('goal');
  expect(s.events).toContainEqual({ type: 'goal', team: 0 });
  const clock = s.clockTicks; runTicks(s, 120);
  expect(s.phase).toBe('kickoff'); expect(s.ball.owner).toBe(9); expect(s.clockTicks).toBe(clock);
});
test('clock does not run during the kickoff pause', () => {
  const s = createMatch(cfg); runTicks(s, 60); expect(s.clockTicks).toBe(7200);
  runTicks(s, 10); expect(s.clockTicks).toBe(7190);
});
test('halftime, then team 1 kicks off the second half, then full time', () => {
  const s = createMatch(short);
  runTicks(s, 60 + 120); expect(s.phase).toBe('halftime');
  runTicks(s, 180); expect(s.half).toBe(2); expect(s.phase).toBe('kickoff'); expect(s.ball.owner).toBe(9);
  expect(s.clockTicks).toBe(120);
  runTicks(s, 60 + 120); expect(s.phase).toBe('fulltime');
  const snap = JSON.stringify({ ...s, tick: 0, events: [] }); runTicks(s, 100);
  expect(JSON.stringify({ ...s, tick: 0, events: [] })).toBe(snap);
});
test('events are cleared every tick', () => {
  const s = createMatch(cfg); expect(s.events.length).toBe(1);
  runTicks(s, 1); expect(s.events).toEqual([]);
});
```

- [x] **Step 2:** Run `npm test`. Expected: FAIL.
- [x] **Step 3:** Implement `flow.ts`; wire it into `step`.
- [x] **Step 4:** Run `npm test`. Expected: PASS.
- [x] **Step 5:** Commit: `feat(sim): goals, clock, halves, full time`.

---

### Task 7: Placeholder computer brain

A deliberately simple brain so the match is playable. M3 replaces `brainIntent`; nothing else should depend on how it decides.

**Files:**
- Create: `src/sim/brain.ts`, `tests/sim/brain.test.ts`, `tests/sim/determinism.test.ts`
- Modify: `src/sim/step.ts`

**Interfaces:**
- Produces: `export function brainIntent(state: MatchState, p: PlayerState): PlayerIntent & { kick?: 'pass' | 'shot'; aim?: Vec };`
- `step` change: every player that is not a human team's controlled player gets `brainIntent`. A `kick` of `'pass'` calls `kick(state, p, 'pass', {x:0,y:0})`; `'shot'` calls `kick(state, p, 'shot', aim)`.
- Rules, first match wins:
  1. Keeper with the ball: stand still; once `ball.ownerTicks >= GK_HOLD_TICKS`, `kick: 'pass'`.
  2. Keeper without the ball: move toward `{ x: GK_LINE_X (or FIELD_W - GK_LINE_X), y: clamp(ball.pos.y, FIELD_MID_Y - GOAL_HALF, FIELD_MID_Y + GOAL_HALF) }`.
  3. Carrier: move toward the opposing `goalCenter`; when within `CPU_SHOOT_RANGE` of it, `kick: 'shot'` with `aim` pointing from the ball to a point on the goal line at `y = FIELD_MID_Y + (nextRandom(state) * 2 - 1) * (GOAL_HALF - 3)`. Call `nextRandom` only on the tick the shot is taken.
  3a. Pass receiver: if the ball is free and `ball.passTarget === p.id`, move toward the ball.
  4. Chaser: if the player's team does not own the ball and this player is the team's outfield player nearest the ball (on a human team, the controlled player counts as the chaser, so no teammate chases), move toward the ball.
  5. Everyone else: move toward `anchor + ((ball.x - 240) * ANCHOR_SHIFT_X, (ball.y - FIELD_MID_Y) * ANCHOR_SHIFT_Y)`, clamped to the pitch. In rules 2 and 5, a player within 3 units of the target stands still.
- Move vectors are unit length or zero. The brain never uses turbo in M1.
- Outfield players cannot pick up a ball faster than PICKUP_MAX_BALL_SPEED; keepers can. Keepers move at GK_SPEED.

- [x] **Step 1: Write the failing tests**

```ts
// tests/sim/brain.test.ts
const cpu = { seed: 7, halfSeconds: 120, human: [false, false] as [boolean, boolean] };
test('keeper tracks the ball inside the goal mouth only', () => {
  const s = createMatch(cpu); s.ball.owner = null; s.ball.pos = { x: 300, y: 5 };
  const i = brainIntent(s, s.players[0]); expect(i.moveY).toBeLessThan(0);
  s.players[0].pos = { x: 12, y: 46 };
  const j = brainIntent(s, s.players[0]); expect(Math.hypot(j.moveX, j.moveY)).toBe(0);
});
test('carrier heads for goal and shoots inside CPU_SHOOT_RANGE', () => {
  const s = createMatch(cpu); runTicks(s, 60);
  expect(brainIntent(s, s.players[4]).moveX).toBeGreaterThan(0.9);
  s.players[4].pos = { x: 400, y: 62 };
  expect(brainIntent(s, s.players[4]).kick).toBe('shot');
});
test('exactly one defender chases a ball the other team owns', () => {
  const s = createMatch(cpu); runTicks(s, 60);
  const toward = s.players.filter(p => p.team === 1 && p.role === 'out').filter(p => {
    const i = brainIntent(s, p), d = norm(sub(s.ball.pos, p.pos));
    return i.moveX * d.x + i.moveY * d.y > 0.99;
  });
  expect(toward).toHaveLength(1);
});
test('keeper releases the ball after holding it 30 ticks', () => {
  const s = createMatch(cpu); runTicks(s, 60);
  s.ball.owner = 5; s.ball.ownerTicks = 0; runTicks(s, 40);
  expect(s.ball.owner).not.toBe(5);
});
// tests/sim/determinism.test.ts
test('two CPU-v-CPU matches with the same seed are identical; a full match finishes', () => {
  const a = createMatch({ ...cpu, halfSeconds: 30 }), b = createMatch({ ...cpu, halfSeconds: 30 });
  runTicks(a, 12000); runTicks(b, 12000);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  expect(a.phase).toBe('fulltime');
  for (const p of a.players) { expect(Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y)).toBe(true); }
});
```

- [x] **Step 2:** Run `npm test`. Expected: FAIL.
- [x] **Step 3:** Implement `brain.ts`; wire it into `step`.
- [x] **Step 4:** Run `npm test`. Expected: PASS. Then print the score of the determinism match once (temporary `console.log`), confirm the match is not stuck (the ball changed owner at least a few times), and remove the log.
- [x] **Step 5:** Commit: `feat(sim): placeholder computer brain, determinism test`.

---

### Task 8: Art — palette, pixel font, sprite atlas

Port the drawing code from `mockups.html`. That file is the visual reference: palette `P`, glyph table `FONT`, `T` (text), `man` (player), `ball`, `shadow`, `disc`.

**Files:**
- Create: `src/art/palette.ts`, `src/art/pixelFont.ts`, `src/art/sprites.ts`, `tests/art/pixelFont.test.ts`, `tests/art/sprites.test.ts`

**Interfaces:**
- Produces:

```ts
// palette.ts
export const PAL: { g1, g2, line, navy, ink, red, blue, yel, wht, org, skin, skin2, gry, dk, pur, grn: string }; // values copied from mockups.html
export interface Kit { jersey: string; trim: string; shorts: string; hair: string; skin: string }
export const KITS: [Kit, Kit, Kit, Kit]; // 0 Rhinos outfield, 1 Vipers outfield, 2 Rhinos keeper (green), 3 Vipers keeper (orange)
// pixelFont.ts
export type RectFn = (x: number, y: number, w: number, h: number, color: string) => void;
export function textWidth(s: string, scale?: number): number;                 // s.length * 4 * scale - scale; 0 for ''
export function drawText(rect: RectFn, s: string, x: number, y: number, color: string, scale?: number, align?: 'l' | 'c' | 'r'): void;
// sprites.ts
export const FRAME_W = 24, FRAME_H = 20;            // feet centre at (12, 18) inside a frame
export const ANIMS: Record<AnimName, { frames: number; ticksPerFrame: number; loop: boolean }>;
  // idle: 2 frames, 30 ticks each, loop. run: 6 frames, 5 ticks each, loop. kick: 3 frames, 4 ticks each, no loop.
export function drawPlayerFrame(rect: RectFn, kit: Kit, anim: AnimName, frame: number): void; // draws facing right into a FRAME_W x FRAME_H box
export function frameIndex(anim: AnimName, animTick: number): number;
export function frameKey(kitIndex: number, anim: AnimName, frame: number): string;           // e.g. 'k0_run_3'
export function atlasLayout(): { key: string; x: number; y: number }[];                      // one row per kit, frames left to right, all anims
```

- `drawText` uppercases its input, draws unknown characters as `?`, and rounds positions to whole pixels. The glyph set is the one in `mockups.html` (as edited: `M` is `111111101101101`, `<` exists, no `#`).
- The run cycle has 6 distinct frames (the mockup has 2): two contact poses, two passing poses, two reach poses, with a 1-pixel body bob and the arm opposite the lead leg forward. This is the "better animation" requirement: keep the 8-bit palette and proportions, raise the frame count.
- The kick has wind-up, strike (leg extended forward), and follow-through.
- `drawPlayerFrame` never draws outside the frame box.

- [x] **Step 1: Write the failing tests**

```ts
// tests/art/pixelFont.test.ts
test('text width', () => { expect(textWidth('GOAL!')).toBe(19); expect(textWidth('GOAL!', 3)).toBe(57); expect(textWidth('')).toBe(0); });
test('draws lit pixels, uppercases, aligns', () => {
  const px: number[][] = []; const rect: RectFn = (x, y, w, h) => px.push([x, y, w, h]);
  drawText(rect, 'i', 10, 0, '#fff'); expect(px.length).toBe(9);              // I is 111 010 010 010 111
  expect(Math.min(...px.map(p => p[0]))).toBe(10);
  px.length = 0; drawText(rect, 'I', 10, 0, '#fff', 1, 'r'); expect(Math.max(...px.map(p => p[0]))).toBe(9);
  px.length = 0; drawText(rect, '~', 0, 0, '#fff'); expect(px.length).toBe(7); // falls back to '?' (111 001 011 000 010)
});
// tests/art/sprites.test.ts
const grid = (anim: AnimName, f: number) => { const g = new Map<string, string>(); let out = false;
  drawPlayerFrame((x, y, w, h, c) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
    if (x + i < 0 || y + j < 0 || x + i >= FRAME_W || y + j >= FRAME_H) out = true; g.set(`${x + i},${y + j}`, c); } }, KITS[0], anim, f);
  return { key: JSON.stringify([...g].sort()), out, size: g.size }; };
test('every frame of every anim draws inside its box and is not empty', () => {
  for (const a of Object.keys(ANIMS) as AnimName[]) for (let f = 0; f < ANIMS[a].frames; f++) {
    const r = grid(a, f); expect(r.out, `${a}${f}`).toBe(false); expect(r.size).toBeGreaterThan(40); }
});
test('the run cycle has six distinct frames', () => {
  expect(new Set([0, 1, 2, 3, 4, 5].map(f => grid('run', f).key)).size).toBe(6);
});
test('frameIndex loops run and holds the last kick frame', () => {
  expect(frameIndex('run', 0)).toBe(0); expect(frameIndex('run', 29)).toBe(5); expect(frameIndex('run', 30)).toBe(0);
  expect(frameIndex('kick', 11)).toBe(2); expect(frameIndex('kick', 500)).toBe(2);
});
test('atlas layout has one unique slot per kit, anim, and frame', () => {
  const l = atlasLayout(); expect(l.length).toBe(4 * (2 + 6 + 3));
  expect(new Set(l.map(e => e.key)).size).toBe(l.length);
  expect(l).toContainEqual({ key: frameKey(1, 'idle', 0), x: 0, y: 20 });
});
```

- [x] **Step 2:** Run `npm test`. Expected: FAIL.
- [x] **Step 3:** Implement the three files.
- [x] **Step 4:** Run `npm test`. Expected: PASS.
- [x] **Step 5:** Commit: `feat(art): palette, pixel font, code-drawn player sprites`.

---

### Task 9: Match scene — fixed-step loop, pitch, players, camera, HUD

**Files:**
- Create: `src/game/loop.ts`, `src/game/BootScene.ts`, `src/game/MatchScene.ts`, `src/game/MatchView.ts`, `src/game/Hud.ts`, `tests/game/loop.test.ts`, `tests/game/layout.test.ts`
- Modify: `src/game/main.ts` (scenes: `BootScene`, `MatchScene`)

**Interfaces:**
- Consumes: the sim (`createMatch`, `step`, `MatchState`), Task 8 art.
- Produces:

```ts
// loop.ts
export class FixedStepper { constructor(stepMs?: number, maxSteps?: number); advance(deltaMs: number): number; } // defaults 1000/60 and 5
// MatchView.ts
export const FIELD_TOP = 50;                                   // screen y of the top touchline
export function cameraTarget(ballX: number): number;           // clamp(ballX - 160, -16, 176)
export function worldToScreen(pos: Vec, camX: number): { x: number; y: number }; // { x: pos.x - camX, y: pos.y + FIELD_TOP }
export class MatchView { constructor(scene: Phaser.Scene); sync(state: MatchState): void; }
// Hud.ts
export function formatClock(clockTicks: number): string;       // 'M:SS', rounds up to the next second, never negative
export class Hud { constructor(scene: Phaser.Scene); sync(state: MatchState): void; showBanner(text: string, ticks: number): void; }
// MatchScene.ts — reads URL params: demo=1 (both teams CPU), seed=<int> (default 1), half=<seconds> (default 120), mute=1
// and exposes window.__ff = { state } for the e2e test.
```

- `FixedStepper.advance` accumulates `deltaMs` and returns how many whole steps to run; if more than `maxSteps` are due, it returns `maxSteps` and discards the remainder.
- `BootScene` builds two canvas textures: the sprite atlas (from `atlasLayout` and `drawPlayerFrame`, registering one named frame per `frameKey`) and a `ball` texture, then starts `MatchScene`. Use Phaser's canvas-texture API; check the Phaser 4 docs for its current name.
- `MatchView` draws, matching the Live match mockup: crowd band and ad boards above the pitch, striped grass (40-unit stripes), touchlines, halfway line, centre circle, both penalty boxes, both goals with nets; one sprite and one shadow per player; the ball. Players facing left use `flipX`. Sprites are depth-sorted by `pos.y`. The controlled human player has a small yellow marker above the head. The camera x eases toward `cameraTarget(ball.pos.x)` by 10% per frame.
- `Hud` draws the 11-pixel top bar from the mockup: "RHINOS" and its score on the left in red, "VIPERS" and its score on the right in blue, and `1ST M:SS` / `2ND M:SS` centred; three turbo pips bottom-centre for team 0, a pip lit when the meter covers it. It draws with `drawText` into one canvas texture and redraws only when the displayed values change.
- `MatchScene.update(time, delta)`: `n = stepper.advance(delta)`; for each of `n`: read input (neutral pad until Task 10), `step`, then handle `state.events` (banner "GOAL!" for 90 ticks on `goal`; "HALF TIME" and "FULL TIME" on those whistles). Then `view.sync` and `hud.sync` once. On `document.visibilitychange` to hidden, reset the stepper's accumulator. At `'fulltime'`, a tap or key press restarts with `seed + 1`.

- [x] **Step 1: Write the failing tests**

```ts
// tests/game/loop.test.ts
test('one step per 16.67 ms, remainder carried', () => {
  const s = new FixedStepper(); expect(s.advance(16)).toBe(0); expect(s.advance(1)).toBe(1); expect(s.advance(50)).toBe(3);
});
test('a ten-second stall runs 5 steps and drops the rest', () => {
  const s = new FixedStepper(); expect(s.advance(10_000)).toBe(5); expect(s.advance(1)).toBe(0); expect(s.advance(16.7)).toBe(1);
});
// tests/game/layout.test.ts  (import only the pure functions; they must not pull in Phaser at module load — keep them in files or exports that the test can import in node)
test('camera follows the ball and stops at both ends', () => {
  expect(cameraTarget(240)).toBe(80); expect(cameraTarget(0)).toBe(-16); expect(cameraTarget(480)).toBe(176);
});
test('world to screen', () => { expect(worldToScreen({ x: 240, y: 62 }, 80)).toEqual({ x: 160, y: 112 }); });
test('clock text', () => {
  expect(formatClock(7200)).toBe('2:00'); expect(formatClock(7199)).toBe('2:00'); expect(formatClock(7140)).toBe('1:59');
  expect(formatClock(1)).toBe('0:01'); expect(formatClock(0)).toBe('0:00'); expect(formatClock(-5)).toBe('0:00');
});
```

If importing `MatchView.ts` or `Hud.ts` in node fails because Phaser touches `window` at import, move `cameraTarget`, `worldToScreen`, `FIELD_TOP`, and `formatClock` into `src/game/layout.ts` and import from there in both the classes and the tests.

- [x] **Step 2:** Run `npm test`. Expected: FAIL.
- [x] **Step 3:** Implement the five files.
- [x] **Step 4:** Run `npm test` and `npm run build`. Expected: both pass.
- [x] **Step 5:** Run `npm run dev`, open `http://localhost:5173/?demo=1`. Confirm by looking: ten animated players, the camera follows the ball, the score and clock change, a "GOAL!" banner appears on a goal, the layout matches the Live match mockup. Take a screenshot and compare it side by side with `mockups.html`; fix differences in proportions or colour.
- [x] **Step 6:** Commit: `feat(game): match scene, fixed-step loop, pitch view, HUD`.

---

### Task 10: Input — touch controls and keyboard

**Files:**
- Create: `src/input/stick.ts`, `src/input/TouchControls.ts`, `src/input/keyboard.ts`, `tests/input/stick.test.ts`, `tests/input/padTracker.test.ts`
- Modify: `src/game/MatchScene.ts` (use real input for team 0 unless `demo=1`)

**Interfaces:**
- Produces:

```ts
// stick.ts (pure, no Phaser)
export const STICK_RADIUS = 26, STICK_DEADZONE = 0.18;
export function stickVector(origin: Vec, pointer: Vec): { x: number; y: number };  // length 0 inside the deadzone, else rescaled to (0,1], never above 1
export type ButtonName = 'pass' | 'shoot' | 'hit' | 'turbo';
export const BUTTONS: Record<ButtonName, { x: number; y: number; r: number }>;
  // pass (248,150,13), shoot (276,124,13), hit (302,152,13), turbo (222,166,10)
export function buttonAt(p: Vec): ButtonName | null;       // hit area is r + 4; nearest centre wins on overlap
export class PadTracker {                                   // pointer bookkeeping, pure
  down(id: number, p: Vec): void; move(id: number, p: Vec): void; up(id: number): void; cancelAll(): void;
  read(): PadInput;
}
// TouchControls.ts
export class TouchControls { constructor(scene: Phaser.Scene); read(): PadInput; }
// keyboard.ts
export class KeyboardPad { constructor(scene: Phaser.Scene); read(): PadInput; }  // arrows or WASD, J pass, K shoot, L hit, Space turbo
export function mergePads(a: PadInput, b: PadInput): PadInput;                    // buttons OR-ed; move from whichever has the larger length
```

- `PadTracker`: a pointer that goes down at `x < 144` (left 45% of the screen) and not on a button becomes the stick pointer, with its origin where it went down (floating stick); only one stick pointer at a time. A pointer that goes down on a button holds that button until it goes up; sliding off does not release it and does not press another. `up` for the stick pointer returns the stick to neutral. `cancelAll` clears everything.
- `TouchControls` enables 3 simultaneous pointers, feeds Phaser pointer events (down, move, up, and up-outside / cancel / game-out, whichever Phaser 4 provides) into a `PadTracker`, calls `cancelAll` on window `blur` and on `visibilitychange` to hidden, and draws the controls as in the mockup: translucent stick base and knob (the base moves to the floating origin while held), three translucent labelled buttons plus the smaller TURBO button, pressed buttons drawn brighter. Controls are hidden when `demo=1`.

- [x] **Step 1: Write the failing tests**

```ts
// tests/input/stick.test.ts
test('deadzone, scaling, and clamping', () => {
  const o = { x: 40, y: 140 };
  expect(stickVector(o, { x: 43, y: 140 })).toEqual({ x: 0, y: 0 });
  const half = stickVector(o, { x: 53, y: 140 }); expect(half.x).toBeGreaterThan(0.3); expect(half.x).toBeLessThan(0.6); expect(half.y).toBe(0);
  const far = stickVector(o, { x: 140, y: 240 }); expect(Math.hypot(far.x, far.y)).toBeCloseTo(1, 5); expect(far.x).toBeCloseTo(far.y, 5);
});
test('button hit areas', () => {
  expect(buttonAt({ x: 248, y: 150 })).toBe('pass'); expect(buttonAt({ x: 290, y: 118 })).toBe('shoot');
  expect(buttonAt({ x: 222, y: 166 })).toBe('turbo'); expect(buttonAt({ x: 160, y: 90 })).toBeNull();
});
// tests/input/padTracker.test.ts
test('stick and a button at the same time', () => {
  const t = new PadTracker(); t.down(1, { x: 40, y: 140 }); t.move(1, { x: 80, y: 140 }); t.down(2, { x: 276, y: 124 });
  const r = t.read(); expect(r.moveX).toBeCloseTo(1, 5); expect(r.shoot).toBe(true); expect(r.pass).toBe(false);
});
test('releasing the stick returns to neutral; the button stays held', () => {
  const t = new PadTracker(); t.down(1, { x: 40, y: 140 }); t.move(1, { x: 80, y: 140 }); t.down(2, { x: 302, y: 152 }); t.up(1);
  expect(t.read()).toMatchObject({ moveX: 0, moveY: 0, hit: true });
});
test('a second left-side touch does not steal the stick', () => {
  const t = new PadTracker(); t.down(1, { x: 40, y: 140 }); t.move(1, { x: 40, y: 100 }); t.down(2, { x: 100, y: 60 }); t.move(2, { x: 140, y: 60 });
  const r = t.read(); expect(r.moveX).toBeCloseTo(0, 5); expect(r.moveY).toBeCloseTo(-1, 5);
});
test('sliding off a button keeps it held and presses nothing else', () => {
  const t = new PadTracker(); t.down(1, { x: 248, y: 150 }); t.move(1, { x: 276, y: 124 });
  expect(t.read()).toMatchObject({ pass: true, shoot: false });
});
test('cancelAll clears a stuck stick and stuck buttons', () => {
  const t = new PadTracker(); t.down(1, { x: 40, y: 140 }); t.move(1, { x: 80, y: 140 }); t.down(2, { x: 248, y: 150 }); t.cancelAll();
  expect(t.read()).toEqual({ moveX: 0, moveY: 0, pass: false, shoot: false, hit: false, turbo: false });
});
test('mergePads', () => {
  const m = mergePads({ ...neutralPad(), moveX: 0.2, pass: true }, { ...neutralPad(), moveY: -1, shoot: true });
  expect(m).toMatchObject({ moveX: 0, moveY: -1, pass: true, shoot: true });
});
```

- [x] **Step 2:** Run `npm test`. Expected: FAIL.
- [x] **Step 3:** Implement the three files and wire `mergePads(touch.read(), keys.read())` into `MatchScene` for team 0.
- [x] **Step 4:** Run `npm test` and `npm run build`. Expected: both pass.
- [x] **Step 5:** Run `npm run dev`. With the keyboard: run, turbo, pass to a teammate, shoot, score. With the browser's device toolbar in a landscape phone profile: drive the stick and press buttons with touch emulation.
- [x] **Step 6:** Commit: `feat(input): touch stick and buttons, keyboard, multi-touch tracking`.

---

### Task 11: Sound effects

**Files:**
- Create: `src/audio/sfx.ts`, `tests/audio/sfx.test.ts`
- Modify: `src/game/MatchScene.ts` (play sounds for events)

**Interfaces:**
- Produces:

```ts
export type SfxName = 'pass' | 'shot' | 'bounce' | 'whistle' | 'goal';
export class Sfx {
  constructor(makeContext?: () => AudioContext);   // default: () => new AudioContext()
  unlock(): void;                                  // call from the first pointer or key press; creates and resumes the context
  play(name: SfxName): void;                       // silent no-op before unlock, when muted, or if the context failed to start
  muted: boolean;
}
export function sfxForEvent(e: SimEvent): SfxName | null;  // kick/pass→'pass', kick/shot→'shot', bounce→'bounce', whistle→'whistle', goal→'goal'
```

- All sounds are synthesised with Web Audio oscillators and noise buffers, 8-bit in character: `pass` a short low square blip; `shot` a punchier, lower thump with a quick pitch drop; `bounce` a soft tick; `whistle` two high square chirps; `goal` a rising three-note arpeggio over a 1-second noise swell (crowd).
- `Sfx` never throws: any failure creating or resuming the context, or scheduling a sound, is swallowed and leaves the game running silently.
- `MatchScene`: `mute=1` sets `muted`; the first pointer-down or key-down calls `unlock()`; each event maps through `sfxForEvent`. The `goal` event plays `goal` only (not also `whistle`).

- [x] **Step 1: Write the failing tests**

```ts
// tests/audio/sfx.test.ts
test('event to sound mapping', () => {
  expect(sfxForEvent({ type: 'kick', kind: 'pass', player: 1 })).toBe('pass');
  expect(sfxForEvent({ type: 'kick', kind: 'shot', player: 1 })).toBe('shot');
  expect(sfxForEvent({ type: 'bounce' })).toBe('bounce');
  expect(sfxForEvent({ type: 'goal', team: 0 })).toBe('goal');
  expect(sfxForEvent({ type: 'whistle', what: 'halftime' })).toBe('whistle');
});
test('play before unlock is a silent no-op and creates no context', () => {
  let made = 0; const s = new Sfx(() => { made++; throw new Error('blocked'); });
  expect(() => s.play('goal')).not.toThrow(); expect(made).toBe(0);
});
test('a context that fails to start never throws', () => {
  const s = new Sfx(() => { throw new Error('blocked'); });
  expect(() => { s.unlock(); s.play('pass'); s.unlock(); }).not.toThrow();
});
test('muted play never throws', () => {
  const s = new Sfx(() => { throw new Error('x'); }); s.muted = true;
  expect(() => { s.unlock(); s.play('pass'); }).not.toThrow();
});
```

- [x] **Step 2:** Run `npm test`. Expected: FAIL.
- [x] **Step 3:** Implement `sfx.ts` and the scene wiring.
- [x] **Step 4:** Run `npm test`. Expected: PASS. Run `npm run dev`, play, and listen: five distinguishable sounds, none before the first click, none with `?mute=1`, no console errors.
- [x] **Step 5:** Commit: `feat(audio): synthesised sound effects wired to sim events`.

---

### Task 12: End-to-end smoke test and screenshot

**Files:**
- Create: `playwright.config.ts`, `e2e/demo.spec.ts`
- Modify: `package.json` (script `e2e`: `playwright test`)

**Interfaces:**
- Consumes: `window.__ff.state` and the `demo`, `seed`, `half`, `mute` URL params from Task 9.

- [x] **Step 1:** `npm i -D @playwright/test` and `npx playwright install chromium`. `playwright.config.ts`: `testDir: 'e2e'`, `webServer` runs `npm run build && npx vite preview --port 4173 --strictPort`, `use.baseURL` `http://localhost:4173`, viewport 960x540.
- [x] **Step 2: Write the test**

```ts
// e2e/demo.spec.ts
test('a CPU-v-CPU match runs, players move, no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?demo=1&seed=1&mute=1&half=20');
  await page.waitForFunction(() => (window as any).__ff?.state.tick >= 600, null, { timeout: 30_000 });
  const s = await page.evaluate(() => (window as any).__ff.state);
  expect(s.phase === 'play' || s.phase === 'goal' || s.phase === 'kickoff').toBe(true);
  const moved = s.players.filter((p: any) => Math.hypot(p.pos.x - p.anchor.x, p.pos.y - p.anchor.y) > 5).length;
  expect(moved).toBeGreaterThanOrEqual(4);
  await page.screenshot({ path: 'artifacts/m1-demo.png' });
  await page.waitForFunction(() => (window as any).__ff.state.phase === 'fulltime', null, { timeout: 90_000 });
  await page.screenshot({ path: 'artifacts/m1-fulltime.png' });
  expect(errors).toEqual([]);
});
```

- [x] **Step 3:** Run `npm run e2e`. Expected: 1 passed, both screenshots written.
- [x] **Step 4:** Open `artifacts/m1-demo.png` and `artifacts/m1-fulltime.png` and look at them. Expected: pitch, crowd, ten players, ball, HUD all present and crisp (no blurred pixels); "FULL TIME" banner and the final score on the second. Fix anything wrong and re-run.
- [x] **Step 5:** Commit: `test(e2e): headless demo match smoke test with screenshots`.

---

### Task 13: Android build

**Files:**
- Create: `capacitor.config.ts`, `android/` (generated)
- Modify: `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/java/**/MainActivity.java`, `package.json` (scripts)

**Interfaces:**
- Produces: npm scripts `android:sync` (`npm run build && npx cap sync android`) and `android:apk` (`npm run android:sync && cd android && ./gradlew assembleDebug`). APK at `android/app/build/outputs/apk/debug/app-debug.apk`.

- [x] **Step 1:** Check the Capacitor 8 docs for current init and Android requirements (`npx ctx7@latest library "Capacitor" "add android platform"`). `npm i @capacitor/core@^8 @capacitor/android@^8` and `npm i -D @capacitor/cli@^8`.
- [x] **Step 2:** `npx cap init "Futbol Frenzy" com.futbolfrenzy.app --web-dir dist`, `npm run build`, `npx cap add android`. The application id is a placeholder the owner may change before any store upload; do not publish with it unconfirmed.
- [x] **Step 3:** In `AndroidManifest.xml`, on the main activity: `android:screenOrientation="sensorLandscape"`. In `MainActivity`, after `super.onCreate`: hide the system bars with `WindowInsetsControllerCompat` (behaviour: show transient bars by swipe) and add `FLAG_KEEP_SCREEN_ON`.
- [x] **Step 4:** Build. If `JAVA_HOME` or `ANDROID_HOME` is unset, on this machine they are `~/.local/opt/android-studio/jbr` and `~/Android/Sdk`. Run `npm run android:apk`. Expected: `BUILD SUCCESSFUL` and the APK exists.
- [x] **Step 5:** Run `adb devices`. If a device or emulator is listed: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`, launch it, and confirm: locked to landscape, no system bars, touch stick and all four buttons respond, stick plus a button work together, sound plays after the first touch, the game holds a steady frame rate. Save a screenshot with `adb exec-out screencap -p > artifacts/m1-android.png` and look at it. If no device is listed, stop and report that the APK is built but untested on hardware; do not claim it works on a phone.
- [x] **Step 6:** Run the whole suite once more: `npm test && npm run e2e`. Expected: all pass.
- [x] **Step 7:** Commit: `feat(android): Capacitor wrapper, landscape, immersive, debug APK`.

---

## Done when

- `npm test` and `npm run e2e` pass.
- In a browser, a person can play a full two-half match against the computer side with keyboard or touch, with sound, and see the final score.
- A debug APK builds, and either runs correctly on a phone or is reported as built but not hardware-tested.
- `src/sim/` still passes the purity test, and the determinism test still passes.
