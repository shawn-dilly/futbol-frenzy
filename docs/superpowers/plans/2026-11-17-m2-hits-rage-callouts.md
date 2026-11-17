# M2: Hits, Rage, Hurt and Callouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players can tackle each other with three hit types; the tackling team's rage at contact decides how badly the victim is hurt; each hurt tier has its own animations, feedback and a rotating funny callout.

**Architecture:** The sim gains a player `status` (replacing `anim`), a hit pipeline (intent → charge → lunge → contact → `hurtPlayer`) and team rage, all deterministic. Presentation maps status to animation keys defined as data, and turns `hit` events into callouts, sound stacks, shake, flash and hit-stop. Callouts and sounds are data tables in `src/content/`.

**Tech Stack:** TypeScript 7, Phaser 4, Vite 8, Vitest 5, Playwright, Capacitor 8.

**Spec:** `docs/superpowers/specs/2026-11-16-futbol-frenzy-design.md` (sections "The hit system" and "Callouts"). Carry-over list: `docs/ROADMAP.md`.

## Global Constraints

- Logical resolution exactly 320x180, pixel art, landscape only.
- `src/sim/` imports nothing from Phaser, the DOM, or another `src/` folder; no `Math.random`, `Date.now`, `performance.now`; randomness only via `nextRandom(state)`.
- 60 ticks per second. Sim durations are ticks; speeds are units per second divided by `TICK_HZ` when applied.
- Every rule number lives in `src/sim/constants.ts` with this plan's exact values. Content (callouts, animations, sounds) lives in `src/content/` as data; adding an entry must need no logic change.
- All art drawn in code, all sound synthesised. No image or audio files.
- Cartoon hurt only: stars, spins, craters. No blood.
- Same seed plus same inputs gives the same match, including every hit, tier and variant.

## Scope calls (owner can overrule)

- `power` in the damage formula is 1 for both teams until team ratings arrive in M4.
- Health reaching 0 leaves the player on 1 health and Dazed; carry-off and substitution are M4.
- Stumble has no callout (the spec's feedback table gives it only a thud). Knockdown, Wipeout and Over the top each have at least 10 eligible lines.
- A hit fires when HIT is released: a tap is a shoulder charge (slide tackle if the tackler's turbo burst is active), a hold of 30+ ticks is a big hit. The ball carrier cannot hit. No friendly fire. Keepers can be hit.
- The placeholder computer side shoulder-charges the carrier when in reach. Anything smarter is M3.
- Callout and effect randomness is presentation-side, from its own generator seeded with the match seed; the sim rng is not touched by presentation.

## Shared definitions (every task uses these names exactly)

```ts
// src/sim/types.ts
export type HitType = 'shoulder' | 'slide' | 'big';
export type HurtTier = 'stumble' | 'knockdown' | 'wipeout' | 'overTheTop';
export type PlayerStatus =
  | { kind: 'free' } | { kind: 'kicking' } | { kind: 'charging' }
  | { kind: 'lunging'; hit: HitType }
  | { kind: 'recovering'; hit: HitType; landed: boolean }
  | { kind: 'hurt'; tier: HurtTier; variant: number };
// PlayerState: remove `anim`, `animTick`; add
//   status: PlayerStatus; statusTick: number /* ticks spent in this status */; statusTicks: number /* its length; 0 = open-ended */
//   health: number; hitCooldown: number; knock: Vec /* knockback velocity, units/s */
// PadInput is unchanged (`hit` is the held state of the button).
// PlayerIntent: add  hitPress: boolean (down this tick), hitHeld: boolean
// MatchState: add  rage: [number, number]; lastHitTick: [number, number] /* tick the team last landed a hit */
// SimEvent: add
//   | { type: 'hit'; tackler: number; victim: number; hit: HitType; tier: HurtTier; variant: number; damage: number; late: boolean }
//   | { type: 'whiff'; player: number; hit: HitType }
```

```ts
// src/sim/constants.ts additions
export const HITS: Record<HitType, { base: number; lungeTicks: number; lungeSpeed: number; reach: number; missTicks: number }> = {
  shoulder: { base: 10, lungeTicks: 8,  lungeSpeed: 110, reach: 7, missTicks: 12 },
  slide:    { base: 16, lungeTicks: 18, lungeSpeed: 130, reach: 9, missTicks: 40 },
  big:      { base: 24, lungeTicks: 14, lungeSpeed: 150, reach: 9, missTicks: 60 },
};
export const HURT: Record<HurtTier, { minDamage: number; downTicks: number; knockSpeed: number; rageGain: number; variants: number }> = {
  stumble:    { minDamage: 0,  downTicks: 24,  knockSpeed: 40,  rageGain: 10, variants: 2 },
  knockdown:  { minDamage: 15, downTicks: 72,  knockSpeed: 70,  rageGain: 14, variants: 2 },
  wipeout:    { minDamage: 30, downTicks: 132, knockSpeed: 110, rageGain: 18, variants: 2 },
  overTheTop: { minDamage: 45, downTicks: 210, knockSpeed: 170, rageGain: 22, variants: 3 },
};
export const HURT_TIERS: HurtTier[] = ['stumble', 'knockdown', 'wipeout', 'overTheTop']; // ascending
export const RAGE_MAX = 100, RAGE_DAMAGE_FACTOR = 1.5, RAGE_VICTIM_GAIN = 6, RAGE_CONCEDE_GAIN = 20;
export const RAGE_DECAY_DELAY_TICKS = 360, RAGE_DECAY_PER_TICK = 2 / 60, RAGE_BIG_HIT_SPEND = 30;
export const TURBO_HIT_FACTOR = 1.2, TEAM_POWER = 1;
export const BIG_HIT_CHARGE_TICKS = 30, BIG_HIT_MAX_HOLD_TICKS = 90, CHARGE_MOVE_FACTOR = 0.5;
export const HIT_COOLDOWN_TICKS = 20, LATE_HIT_COOLDOWN_TICKS = 90, HIT_LANDED_RECOVER_TICKS = 8;
export const KNOCK_DECAY = 0.9, LOOSE_BALL_SPEED = 60;
export const MAX_HEALTH = 100, DAZED_HEALTH = 35, DAZED_SPEED_FACTOR = 0.8, DAZED_FUMBLE_CHANCE = 0.15;
export const FUMBLE_COOLDOWN_TICKS = 20, HALFTIME_HEAL = 25;
export const CPU_HIT_RANGE = 10; // units; the placeholder chaser shoulder-charges a carrier this close
```

## Review Focus

1. Controlled player is flattened: the human must get control of another standing teammate at once, not steer a body on the ground.
2. Both teams land a hit on the same tick, or two tacklers reach one victim on the same tick: one deterministic result (lower tackler id resolves first; a player already hurt this tick is not hit again).
3. A hit during a goal pause, halftime or after full time must not happen; statuses must be cleared at every kickoff so nobody starts a half lying down.
4. HIT held across a kickoff or while being flattened must not launch a hit on the next free tick.
5. Rapid repeated hits: callout banner and sounds must not stack into noise (latest callout wins; per-sound minimum gap).

---

### Task 1: Sim housekeeping carried from M1

**Files:** Modify `src/sim/index.ts`, `tsconfig.json` (+ create `tsconfig.node.json` if needed), `tests/sim/purity.test.ts`, `tests/sim/determinism.test.ts`, any presentation import broken by the trim.

- [x] **Step 1:** Trim `src/sim/index.ts` to export only: everything from `types`, `constants`, `vec`; `nextRandom`; `createMatch`, `neutralPad`, `attackDir`, `goalCenter`; `step`. Fix presentation imports. Tests may import sim internals by file path.
- [x] **Step 2:** Scope Node types so files under `src/` cannot see `process` / `Buffer` / `node:` modules, while `tests/`, `e2e/` and config files still can. Prove it: temporarily add `process.cwd()` to a `src/sim` file, see `npm run typecheck` fail, remove it. `npm run typecheck` must still check every file it checks today.
- [x] **Step 3:** Make the purity test walk `src/sim` recursively and also forbid `process`, `Buffer`, `node:` and `setTimeout`.
- [x] **Step 4:** Strengthen the determinism test: (a) two matches with `halfSeconds: 120`, same seed, driven for the full match by one scripted team-0 pad sequence (a fixed function of tick that moves, passes, shoots, uses turbo and HIT) end with `JSON.stringify`-equal states; (b) run 1500 ticks, `JSON.parse(JSON.stringify(state))`, continue both the copy and the original 1500 more ticks with the same pads: states equal; (c) a different seed gives a different state.
- [x] **Step 5:** `npm test && npm run typecheck && npm run build`; commit `chore(sim): trim public surface, scope Node types, stronger determinism and purity tests`.

### Task 2: Player status replaces `anim`

**Files:** Modify `src/sim/types.ts`, `setup.ts`, `movement.ts`, `possession.ts`, `constants.ts`; create `src/sim/status.ts`, `src/game/playerAnim.ts`; modify `src/art/sprites.ts`, `src/game/MatchView.ts`; tests `tests/sim/status.test.ts`, `tests/game/playerAnim.test.ts`, update existing tests.

**Interfaces — produces:**
```ts
// src/sim/status.ts
export function setStatus(p: PlayerState, status: PlayerStatus, ticks: number): void; // statusTick = 0, statusTicks = ticks
export function tickStatus(p: PlayerState): void; // statusTick += 1; when statusTicks > 0 and statusTick >= statusTicks -> free
export function canAct(p: PlayerState): boolean;  // true for free, kicking, charging
export function isDown(p: PlayerState): boolean;  // hurt with tier knockdown or worse
// src/game/playerAnim.ts  (no Phaser import)
export type AnimKey = string;
export function animFor(p: PlayerState, matchTick: number): { key: AnimKey; tick: number };
```

- [x] **Step 1:** Add all "Shared definitions" types and constants now (the whole block, so later tasks only add logic). `createMatch` / `placeForKickoff` set every player to `free`, `statusTick 0`, `statusTicks 0`, `health MAX_HEALTH` (createMatch only; kickoff keeps health), `hitCooldown 0`, `knock {0,0}`; `rage [0,0]`, `lastHitTick [0,0]`.
- [x] **Step 2:** Tests for `status.ts` with exact values: `setStatus` resets the counter; `tickStatus` returns to `free` exactly on tick `statusTicks` and never ends an open-ended status; `canAct` / `isDown` truth table over all six kinds and four tiers.
- [x] **Step 3:** `kick()` sets `kicking` for `KICK_ANIM_TICKS`; `stepPlay` calls `tickStatus` for every player once per tick (before intents). Remove `updateAnim`, `anim`, `animTick`.
- [x] **Step 4:** `animFor`: `free` → `run` when `vel` is non-zero else `idle`, with `tick = matchTick`; `kicking` → `kick`; `charging` → `charge`; `lunging` → `lunge_<hit>`; `recovering` → `recover_<hit>` when missed, `idle` when landed; `hurt` → `hurt_<tier>_<variant>`; all non-free use `tick = statusTick`. Unit-test every branch. Until Task 6 draws the new frames, `MatchView` falls back to `idle` for a key the atlas lacks (one helper, removed in Task 6).
- [x] **Step 5:** Full check, screenshot that the match still looks the same (run, kick), commit `refactor(sim): player status replaces anim; presentation derives the animation`.

### Task 3: Damage, tiers, rage, health

**Files:** Create `src/sim/rage.ts`, `src/sim/hurt.ts`; modify `flow.ts`, `movement.ts`, `possession.ts`, `brain.ts`, `step.ts`; tests `tests/sim/rage.test.ts`, `tests/sim/hurt.test.ts`.

**Interfaces — produces:**
```ts
// src/sim/rage.ts
export function hitDamage(hit: HitType, rage: number, turboActive: boolean): number; // base × (1 + 1.5 × rage/100) × TEAM_POWER × (turbo ? 1.2 : 1)
export function tierFor(damage: number): HurtTier;
export function addRage(state: MatchState, team: TeamId, amount: number): void;       // clamps 0..RAGE_MAX
export function rageAfterHit(state: MatchState, tacklerTeam: TeamId, tier: HurtTier): void; // +rageGain; then −30 for wipeout/overTheTop; victim team +6; lastHitTick
export function decayRage(state: MatchState): void; // per tick, per team: after RAGE_DECAY_DELAY_TICKS without landing a hit, −RAGE_DECAY_PER_TICK
// src/sim/hurt.ts
export function isDazed(p: PlayerState): boolean; // health < DAZED_HEALTH
export function hurtPlayer(state: MatchState, victim: PlayerState, tier: HurtTier, dir: Vec, damage: number): number; // returns the variant
```

- [x] **Step 1:** `rage.test.ts`, exact values: shoulder at rage 0 = 10 → stumble; shoulder at rage 100 = 25 → knockdown; slide at rage 0 = 16 → knockdown; slide at rage 100 with turbo = 48 → overTheTop; big at rage 0 = 24 → knockdown; big at rage 50 = 42 → wipeout; big at rage 100 = 60 → overTheTop; boundaries 14.99/15/29.99/30/44.99/45. Rage: knockdown from 0 → tackler 14, victim team 6; wipeout from 90 → clamp to 100 then spend → 70; decay starts at tick `lastHitTick + 360`, loses exactly 2 over the next 60 ticks, never below 0.
- [x] **Step 2:** Implement `rage.ts`. `advancePlay` adds `RAGE_CONCEDE_GAIN` to the conceding team on a goal; `stepPlay` calls `decayRage`. Halftime heals every player by `HALFTIME_HEAL` up to `MAX_HEALTH`.
- [x] **Step 3:** `hurt.test.ts`: `hurtPlayer` sets `hurt` with the tier's `downTicks`, a variant `floor(nextRandom × variants)` (assert it is in range and that 200 seeded calls produce every variant), `knock = norm(dir) × knockSpeed`, health reduced by damage with a floor of 1; if the victim owned the ball it becomes free at `LOOSE_BALL_SPEED` along `dir` and the victim's `kickCooldown` is at least `downTicks`; if the victim was a human team's controlled player and is now down, control moves to the nearest standing outfield teammate.
- [x] **Step 4:** Can-act gate and exclusions: a player who cannot act gets a neutral intent (no move, no kick, no turbo); `knock` is applied to position each tick (clamped to the pitch) then multiplied by `KNOCK_DECAY`, and zeroed below 1 unit/s; players who are down are skipped by `nearestPickup`, `pickPassTarget`, `switchControl` and the brain's chaser selection (if every teammate is down, fall back to the old behaviour rather than throwing). Dazed: run and turbo speed × `DAZED_SPEED_FACTOR`; when a Dazed player would trap a ball whose `passTarget` is him, `nextRandom(state) < DAZED_FUMBLE_CHANCE` makes him miss it (ball keeps moving, his `kickCooldown = FUMBLE_COOLDOWN_TICKS`). `placeForKickoff` clears status and knock. One test per rule, each with exact numbers.
- [x] **Step 5:** Full check; commit `feat(sim): hit damage, tiers, rage, health and the hurt state`.

### Task 4: Hit input and attacks

**Files:** Create `src/sim/attack.ts`; modify `step.ts`, `movement.ts`, `brain.ts`; tests `tests/sim/attack.test.ts`, extend `tests/sim/determinism.test.ts`, `tests/sim/brain.test.ts`.

**Interfaces — produces:**
```ts
// src/sim/attack.ts
export function updateAttack(state: MatchState, p: PlayerState, intent: BrainIntent): void; // charge start, release, launch
export function resolveContacts(state: MatchState): void; // every lunging player, ascending id
// BrainIntent gains  hit?: HitType  (the brain launches that hit this tick, skipping the charge)
```

Rules:
- `padToIntent` fills `hitPress` (down this tick, not last) and `hitHeld`.
- Start: `hitPress`, status `free`, `hitCooldown === 0`, not the ball owner → `charging` (open-ended). While charging the player moves at `CHARGE_MOVE_FACTOR` of his speed.
- Release (`hitHeld` false while charging) or `statusTick >= BIG_HIT_MAX_HOLD_TICKS`: if charged `>= BIG_HIT_CHARGE_TICKS` and the team's turbo meter `>= TURBO_COST` → `big`, spending `TURBO_COST`; else `slide` if `turboTicks > 0`; else `shoulder`. The player becomes `lunging` for that type's `lungeTicks`, moving along `facing` at `lungeSpeed`, not steerable.
- Gaining the ball, or being hurt, while charging cancels the charge. A press that began while the player could not act does not start a charge (Review Focus 4).
- `resolveContacts` runs after movement and before `updatePossession`. For each lunging player in ascending id: the nearest opponent within `reach` who is not down and was not hurt this tick is the victim. `damage = hitDamage(hit, state.rage[tackler.team], tackler.turboTicks > 0)`; `tier = tierFor(damage)`; `late = victim does not own the ball`; `variant = hurtPlayer(state, victim, tier, tackler.facing, damage)`; `rageAfterHit`; push the `hit` event; tackler → `recovering{landed: true}` for `HIT_LANDED_RECOVER_TICKS`, `hitCooldown = late ? LATE_HIT_COOLDOWN_TICKS : HIT_COOLDOWN_TICKS`.
- A lunge that ends with no contact → `whiff` event, `recovering{landed: false}` for `missTicks`, `hitCooldown = HIT_COOLDOWN_TICKS`.
- `hitCooldown` counts down every tick.
- Brain: a chaser within `CPU_HIT_RANGE` of an opposing carrier, with `hitCooldown === 0`, returns `hit: 'shoulder'` while moving at the carrier (instead of jockeying at that range).

- [x] **Step 1:** Tests first, each with exact tick counts and values from the tables: tap → shoulder lunge 8 ticks at 110; tap during a turbo burst → slide; hold 30 ticks with a full meter → big and meter drops by 1/3; hold 30 with an empty meter → shoulder; hold 90 → auto-launch; carrier cannot charge; contact within reach at rage 0 with a shoulder → `hit` event `{tier:'stumble', damage:10, late:false}`, ball loose, tackler rage 10, victim rage 6; big hit at rage 100 → `overTheTop`, tackler rage ends at 70 (100 + 22 clamps to 100, then − 30); late hit sets cooldown 90; whiff → `recovering` for `missTicks` then free; teammates are never hit; a victim already down is not hit; two tacklers same tick → only the lower id lands, the other whiffs when his lunge ends; no hits outside `play`; CPU chaser takes the ball off a stationary carrier within 600 ticks.
- [x] **Step 2:** Implement. Order inside `stepPlay`: tick cooldowns and statuses → intents → attacks (`updateAttack`) → kicks and control switching → movement and knock → `resolveContacts` → `updatePossession` → `moveFreeBall` → `decayRage`.
- [x] **Step 3:** Add to the determinism test's scripted pad a HIT tap and a 40-tick HIT hold; add a test that a CPU-v-CPU match of 2×120 s produces at least one `hit` event and still ends at `fulltime`.
- [x] **Step 4:** Full check; commit `feat(sim): shoulder, slide and big hits with contact resolution`.

### Task 5: Generalised poses and animation data

**Files:** Create `src/content/animations.ts`; rewrite `src/art/sprites.ts`; modify `src/game/BootScene.ts`, `MatchView.ts`, `playerAnim.ts`; tests `tests/art/sprites.test.ts`, `tests/content/animations.test.ts`.

**Interfaces — produces:**
```ts
// src/content/animations.ts
export type ColorRole = 'skin' | 'hair' | 'jersey' | 'trim' | 'shorts' | 'boot' | 'eye' | 'star';
export type Px = [dx: number, dy: number, w: number, h: number, role: ColorRole]; // relative to the feet centre, facing right
export interface AnimDef { frames: Px[][]; ticksPerFrame: number; loop: boolean; arcHeight?: number /* peak lift in px over the status length */ }
export const ANIMATIONS: Record<string, AnimDef>;
export function hurtAnimKey(tier: HurtTier, variant: number): string; // `hurt_<tier>_<variant>`
// src/art/sprites.ts
export function drawFrame(rect: RectFn, kit: Kit, key: string, frame: number): void;
export function frameIndex(key: string, tick: number): number;
export function frameKey(kitIndex: number, key: string, frame: number): string;
export function atlasLayout(): { key: string; x: number; y: number }[]; // wraps rows so the atlas is at most 1024 px wide
```

- [x] **Step 1:** Move `idle`, `run`, `kick` into `ANIMATIONS` as full rect lists (a small `standing(bob, legs, boots, arms)` builder produces today's exact pixels). Test: a pixel-for-pixel snapshot of every existing frame is unchanged from before the rewrite (generate the "before" snapshot first, commit it as a fixture).
- [x] **Step 2:** Add data for: `charge` (crouched, 2 frames), `lunge_shoulder`, `lunge_slide` (body low, leg out), `lunge_big` (horizontal dive), `recover_shoulder`, `recover_slide`, `recover_big` (face down), and the nine hurt animations: `hurt_stumble_0` hop on one leg, `hurt_stumble_1` windmill arms, `hurt_knockdown_0` faceplant, `hurt_knockdown_1` flat on back, `hurt_wipeout_0` clutches shin and rolls side to side (loop), `hurt_wipeout_1` sits up dizzy with orbiting `star` pixels (loop), `hurt_overTheTop_0` helicopter spin (`arcHeight 22`) then flat, `hurt_overTheTop_1` launched flat and long (`arcHeight 10`) then crumpled, `hurt_overTheTop_2` high launch (`arcHeight 30`) then face down. Every frame fits the 24x20 cell.
- [x] **Step 3:** Tests: every key `animFor` can return for every status, hit type, tier and variant (loop over `HURT` variants) exists in `ANIMATIONS`; every frame has at least one rect and all rects lie inside the cell; atlas keys are unique and inside 1024 px; `frameIndex` clamps non-looping and wraps looping animations. Remove the Task 2 fallback helper.
- [x] **Step 4:** `MatchView` lifts a sprite by `arcHeight × sin(π × statusTick / statusTicks)` (pure helper `arcLift` in `src/game/layout.ts`, unit-tested: 0 at both ends, peak at the midpoint) and leaves the shadow on the ground.
- [x] **Step 5:** Render a contact sheet of every animation at 4x to `artifacts/` with a throwaway script, look at it, fix anything unreadable. Full check; commit `feat(art): data-driven animations with attack and hurt poses`.

### Task 6: Callouts

**Files:** Create `src/content/callouts.ts`, `src/content/shuffleBag.ts`, `src/game/calloutPicker.ts`, `src/game/CalloutBanner.ts`; modify `src/game/MatchScene.ts`, `layout.ts`; tests `tests/content/shuffleBag.test.ts`, `tests/content/callouts.test.ts`, `tests/game/calloutPicker.test.ts`.

**Interfaces — produces:**
```ts
// src/content/callouts.ts
export interface Callout { id: string; text: string; tiers: HurtTier[]; hitTypes?: HitType[]; weight?: number; audio?: string }
export const CALLOUTS: Callout[];
// src/content/shuffleBag.ts  (generic, no game types)
export class ShuffleBag<T> { constructor(random: () => number); next(items: readonly T[], weightOf?: (t: T) => number, eligible?: (t: T) => boolean): T }
//   every item is returned once before any repeats; the first draw of a refilled bag is never the item just returned (when there are 2+ items); weight w puts w copies in the bag (w < 1 throws); `eligible` skips items for this draw only, they stay in the bag; never the same item twice running when another eligible item exists (refills early if needed)
// src/game/calloutPicker.ts
export class CalloutPicker { constructor(callouts: readonly Callout[], random: () => number); pick(tier: HurtTier, hit: HitType): Callout | null }
//   one bag per tier; null for a tier with no eligible line; a hitTypes-restricted line is skipped (stays in the bag) when the hit type does not match
export function calloutStyle(tier: HurtTier): { scale: number; color: string; flash: boolean; ticks: number };
export function calloutVisible(shownTick: number, nowTick: number, style: { flash: boolean; ticks: number }): boolean; // false after `ticks`; flashing blinks every 6 ticks
```

- [x] **Step 1:** Write `CALLOUTS`: the eight seed lines from the spec plus enough original, family-friendly, funny lines that knockdown, wipeout and overTheTop each have at least 10 eligible entries (30+ entries in total, some big-hit-only). Upper case, at most 26 characters so a line fits 320 px at scale 2 — check with `textWidth`. Test: ids unique; every tier except stumble has ≥ 10; every text fits; every text uses only characters the pixel font has (add missing glyphs such as `'`, `?`, `!`, `.`, `,` to `pixelFont.ts` if absent).
- [x] **Step 2:** `ShuffleBag` tests with a seeded generator: 3 full cycles of 10 items each contain all 10; no immediate repeat across 1000 draws; weight 3 appears three times per cycle; a single item repeats without hanging; an empty list throws a clear error.
- [x] **Step 3:** `CalloutPicker` and style tests: stumble → null; knockdown scale 1 white 60 ticks no flash; wipeout scale 2 `PAL` orange 80 ticks; overTheTop scale 2 yellow flashing 110 ticks; `calloutVisible` exact on/off ticks.
- [x] **Step 4:** `CalloutBanner`: its own canvas layer above the pitch and below the HUD bar, centred at y 62; a new callout replaces the current one. `MatchScene` owns one `CalloutPicker` seeded from the match seed (a small `seededRandom(seed)` in `src/content/shuffleBag.ts` or a neighbouring file — not the sim's state) and shows a callout for every `hit` event whose tier has one. If the entry has `audio`, call a no-op `playClip(name)` hook on `Sfx` that returns false when the clip is unavailable (always, in v1), so recorded lines can be added later without touching this code.
- [x] **Step 5:** Screenshot a knockdown, a wipeout and an over-the-top callout (force them through `window.__ff`), look at them. Full check; commit `feat(callouts): rotating callout pool with shuffle bags and a tiered banner`.

### Task 7: Hit feedback — sound, shake, hit-stop, rage meter

**Files:** Create `src/content/sounds.ts`, `src/game/hitFeedback.ts`; modify `src/audio/sfx.ts`, `src/game/MatchScene.ts`, `Hud.ts`, `MatchView.ts`, `loop.ts`, `src/input/TouchControls.ts`; tests `tests/audio/sfx.test.ts`, `tests/game/hitFeedback.test.ts`, `tests/game/layout.test.ts`.

**Interfaces — produces:**
```ts
// src/content/sounds.ts — the SOUNDS table moved out of sfx.ts, plus new entries and a per-sound minGapS
export type SfxName = 'pass' | 'shot' | 'bounce' | 'whistle' | 'goal' | 'thud' | 'grunt' | 'crunch' | 'ooh' | 'gasp' | 'whiff' | 'charge';
// src/game/hitFeedback.ts (no Phaser import)
export interface HitFeedback { sounds: SfxName[]; shakePx: number; shakeMs: number; freezeTicks: number; flash: boolean; stars: boolean }
export const HIT_FEEDBACK: Record<HurtTier, HitFeedback>;
//   stumble: [thud], 1 px 80 ms, 0, no flash;  knockdown: [thud, grunt], 2 px 150 ms, 0;
//   wipeout: [crunch, grunt, ooh], 4 px 250 ms, freeze 6;  overTheTop: [crunch, grunt, gasp], 6 px 400 ms, freeze 12, flash, stars
```

- [x] **Step 1:** Move the sound table to `src/content/sounds.ts`; add the seven new synthesised sounds (thud: low sine drop + short noise; grunt: sawtooth 140→90 Hz; crunch: noise burst + square drop; ooh / gasp: filtered-feeling noise swells of 0.6 s / 0.9 s with a falling / rising tone; whiff: quick high noise swish; charge: rising tone). `Sfx.play` ignores a sound requested again within its `minGapS` (test with an injected context clock: second call inside the gap creates no nodes, a call after the gap does). `sfxForEvent` maps `whiff`; hit sounds come from `HIT_FEEDBACK`.
- [x] **Step 2:** `FixedStepper.freeze(ticks)`: the next `ticks` sim steps are skipped (time does not accumulate into a burst afterwards). Unit-test: freeze 6 at 60 Hz delays the sim by exactly 6 steps and then runs at normal rate.
- [x] **Step 3:** `MatchScene.handleEvents` on `hit`: play the tier's sounds, camera shake, freeze, white flash overlay for overTheTop (fades in 200 ms), callout (Task 6). Shake must not move the HUD or the touch controls.
- [x] **Step 4:** Rage meters in the HUD under each team's score (pure `rageBarWidth(rage, maxPx)` tested at 0, 50, 100, and a flashing state at `rage >= 80`); a Dazed player shows two blinking yellow pixels above his head; the over-the-top crater decal (variant 2) is drawn on the pitch where the victim lands and stays until the next kickoff.
- [x] **Step 5:** `TouchControls.read()` no longer redraws; a separate `draw()` is called once per frame. The HIT button shows a fill that grows while charging and turns yellow at `BIG_HIT_CHARGE_TICKS`.
- [x] **Step 6:** Screenshots of: rage meter part full, a wipeout mid-freeze, the over-the-top flash, a Dazed marker. Full check; commit `feat(game): hit sounds, shake, hit-stop, flash and rage meters`.

### Task 8: End-to-end, Android build, docs

**Files:** Modify `e2e/demo.spec.ts`, `README.md`, `CLAUDE.md`, `docs/ROADMAP.md`.

- [x] **Step 1:** E2E: (a) the demo match still reaches full time; (b) a human test that walks the controlled player into the nearest opponent, taps L, and asserts a recorded `hit` event and a visible callout layer or, for a stumble, the victim's `hurt` status; (c) hold L 40 ticks and release: a `hit` or `whiff` event with `hit: 'big'`.
- [x] **Step 2:** `npm run android:apk` builds (JDK 21+); record the APK size. If no emulator is available say so in the report rather than claiming a device check.
- [x] **Step 3:** Update `README.md` (HIT controls: tap, tap with turbo, hold), `CLAUDE.md` (content tables, status model), `docs/ROADMAP.md` (M2 status, remove finished carry-overs, list what is left for M3).
- [x] **Step 4:** Full check plus `npm run e2e`; commit `test(e2e): hits and callouts; docs for M2`.
