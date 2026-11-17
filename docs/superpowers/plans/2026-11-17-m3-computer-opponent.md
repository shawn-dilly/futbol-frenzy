# M3: Computer Opponent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A computer side that passes, shoots, defends and hits back, at four difficulty levels (Rookie, Pro, Bruiser, Psycho) that differ in reaction, accuracy, hitting and positioning, with all level settings in one table.

**Architecture:** The brain stays inside the deterministic sim. Each computer player keeps a small JSON-serialisable memory in match state and re-thinks every `reactionTicks`; between thoughts it carries out its stored plan. The brain presses the same buttons a human does (move, pass, shoot, turbo, HIT press/hold), so every rule and cost applies to it unchanged. One table, `src/sim/levels.ts`, holds everything that differs by level.

**Tech Stack:** TypeScript 7, Vitest 5, Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-16-futbol-frenzy-design.md` ("Computer opponent"). Carry-over list: `docs/ROADMAP.md` ("Carried into M3").

## Global Constraints

- `src/sim/` imports nothing from Phaser, the DOM, or another `src/` folder; no `Math.random`, `Date.now`, `performance.now`; randomness only via `nextRandom(state)`. Keep `src/sim/` flat (no subfolders).
- Same seed plus same inputs gives the same match. Brain memory lives in `MatchState` and survives `JSON.parse(JSON.stringify(state))`.
- 60 ticks per second; durations in ticks; speeds in units per second.
- Everything that differs by level is a field of `LEVELS` in `src/sim/levels.ts`. Brain code never tests the level's name. Other rule numbers stay in `constants.ts`.
- The brain acts only through `PlayerIntent` (the buttons). It may not set state directly, skip a cost, or see anything a player could not (it may read positions, velocities, statuses, the ball, meters).
- Human-team rules are unchanged: a human's teammates are driven by the brain at the level in `config.level[team]` but never start a hit on their own.

## Scope calls (owner can overrule)

- The level is chosen with the URL option `?level=rookie|pro|bruiser|psycho` (default `pro`) until the setup screen arrives in M4. In `?demo=1` both sides use it; `?level2=` sets team 0 separately for demos.
- The catch-up boost applies to whichever side trails by two or more goals, human or computer: 6% more run speed and a 50% faster turbo refill.
- Pass "accuracy" is modelled as choosing the wrong or a worse teammate, not as a bent ball path; shot accuracy is an angle error on the aim.
- Team `power` stays 1 for everyone (M4 brings ratings); `hitDamage` gains the parameter now so M4 only supplies values.

## Shared definitions (every task uses these names exactly)

```ts
// src/sim/types.ts
export type Level = 'rookie' | 'pro' | 'bruiser' | 'psycho';
// MatchConfig: add  level: [Level, Level]   (index = team; drives every brain-controlled player of that team)
export type BrainRole = 'keeper' | 'carrier' | 'presser' | 'cover' | 'marker' | 'support' | 'receiver' | 'chaser';
export interface BrainMemory {
  thinkAt: number;          // tick of the next re-think
  role: BrainRole;
  target: Vec;              // where the plan says to go
  action: 'none' | 'pass' | 'shot' | 'tap' | 'chargeBig';   // what to do with the buttons on the way
  aim: Vec;                 // kick aim (zero when unused)
  turbo: boolean;           // press turbo when available
  holdHitUntil: number;     // tick until which HIT stays held (big-hit charge); 0 = not holding
}
// MatchState: add  brain: BrainMemory[]   (index = player id)

// src/sim/levels.ts
export interface LevelSpec {
  label: string;               // shown on screen, upper case
  reactionTicks: number;       // ticks between re-thinks
  passMistakeChance: number;   // chance a pass goes to the second-best option
  shotErrorRad: number;        // max angle error on a shot, either side
  shootRange: number;          // units from goal at which the carrier shoots
  pressureDist: number;        // an opponent this close makes the carrier look for a pass
  teamHitCooldownTicks: number;// after any hit by the team, nobody on it starts another for this long
  hitTypes: HitType[];         // hits the level may choose
  hitAimErrorRad: number;      // max angle error on the lunge direction, either side
  hitRange: number;            // starts a hit when the target is this close
  lateHitChance: number;       // per think: chance to go for a nearby opponent who does not have the ball
  positioning: number;         // 0..1 blend from formation anchor (0) to the computed smart spot (1)
  keeperSpeedFactor: number;   // multiplies GK_SPEED
  usesTurbo: boolean;
}
export const LEVELS: Record<Level, LevelSpec>;
export const LEVEL_ORDER: Level[]; // ['rookie', 'pro', 'bruiser', 'psycho']
```

Starting values (Task 4 may tune them to meet its bands; brain code must not depend on specific values):

| field | rookie | pro | bruiser | psycho |
|---|---|---|---|---|
| reactionTicks | 24 | 14 | 10 | 6 |
| passMistakeChance | 0.35 | 0.15 | 0.12 | 0.05 |
| shotErrorRad | 0.30 | 0.16 | 0.12 | 0.06 |
| shootRange | 70 | 90 | 95 | 105 |
| pressureDist | 14 | 20 | 22 | 26 |
| teamHitCooldownTicks | 600 | 420 | 240 | 150 |
| hitTypes | shoulder | shoulder, slide | shoulder, slide, big | shoulder, slide, big |
| hitAimErrorRad | 0.5 | 0.3 | 0.2 | 0.1 |
| hitRange | 8 | 10 | 11 | 12 |
| lateHitChance | 0 | 0 | 0.15 | 0.4 |
| positioning | 0.3 | 0.6 | 0.7 | 0.9 |
| keeperSpeedFactor | 0.85 | 1 | 1 | 1.1 |
| usesTurbo | false | true | true | true |

## Review Focus

1. A computer player is flattened mid-plan (holding a big-hit charge, mid-pass decision): on getting up he must not fire a stale action; his memory is reset when he cannot act.
2. Both teams computer-controlled at different levels: each team reads only its own level.
3. Every teammate down or the ball stuck against a wall: the brain must not throw, divide by zero, or return a non-finite move vector (assert finite, length ≤ 1, in a fuzz test over many seeds and ticks).
4. Kickoff, goal pause, halftime: memory is cleared at every kickoff so nobody runs to a target from the previous play.
5. A human's brain-driven teammates must stay useful (support, receive passes, defend) but never hit and never take control away from the human.

---

### Task 1: Levels, brain memory, and one hit path for humans and the computer

**Files:** Create `src/sim/levels.ts`; modify `src/sim/types.ts`, `setup.ts`, `attack.ts`, `brain.ts`, `rage.ts`, `constants.ts`, `index.ts`, `src/game/params.ts`, `MatchScene.ts`; tests `tests/sim/levels.test.ts`, `tests/sim/attack.test.ts`, `tests/sim/brain.test.ts`, `tests/game/params.test.ts`, others as types force.

**Interfaces — produces:** the Shared definitions; plus
```ts
// src/sim/rage.ts
export function hitDamage(hit: HitType, rage: number, turboActive: boolean, power?: number): number; // power defaults to TEAM_POWER
// src/sim/setup.ts
export function blankMemory(): BrainMemory; // thinkAt 0, role 'support', target {0,0}, action 'none', aim {0,0}, turbo false, holdHitUntil 0
// src/game/params.ts — parsed URL options gain  level: Level, level2: Level | null  (invalid values fall back to 'pro' / null)
```

- [x] **Step 1:** Add the types, `LEVELS` with the starting values, `LEVEL_ORDER`. Tests: every level has every field; `reactionTicks` and `teamHitCooldownTicks` strictly decrease and `positioning` strictly increases along `LEVEL_ORDER`; every `hitTypes` list is non-empty and includes `shoulder`. `createMatch` requires `config.level` and fills `state.brain` with `blankMemory()` for all ten players; `placeForKickoff` resets every memory. Update every `createMatch` call (tests use a shared helper default of `['pro', 'pro']`).
- [x] **Step 2:** One hit path. Remove `BrainIntent.hit`. `updateAttack` no longer cancels a charge because the player is brain-driven: a charge is cancelled only when the player gains the ball, or when he belongs to a human team and is not (or stops being) the controlled player. Brain-driven players of a human team never start a charge (enforced in `updateAttack`, tested). The team-wide computer cooldown reads `LEVELS[config.level[team]].teamHitCooldownTicks`; delete `CPU_HIT_COOLDOWN_TICKS`. Tests: a computer player holding `hitHeld` for 30 ticks with a full meter launches `big` and the meter drops by `TURBO_COST`; with an empty meter it launches `shoulder`; a computer tap during a turbo burst is a `slide`; team cooldown equals the level's value for each of the four levels.
- [x] **Step 3:** Keep the existing brain behaviour working on the new path with the smallest change (the chaser taps HIT — press one tick, release the next — within `LEVELS[level].hitRange`; delete `CPU_HIT_RANGE`; keep `CPU_ENGAGE_RANGE` until Task 2 removes it). The existing "CPU chaser takes the ball off a stationary carrier" test still passes.
- [x] **Step 4:** `hitDamage` takes `power`; `land()` passes `TEAM_POWER`. `params.ts` parses `level` / `level2`; `MatchScene` builds `config.level` (`[level2 ?? level, level]`; team 0's value only matters for its brain-driven teammates and in demo mode). Unit-test the parsing.
- [x] **Step 5:** Determinism tests updated to pass `level`, plus a case with `level: ['rookie', 'psycho']`. `npm test && npm run typecheck && npm run build && npm run e2e`; commit `feat(sim): difficulty table, brain memory, one hit path for humans and the computer`.

### Task 2: Thinking, roles, defending and hitting

**Files:** Create `src/sim/brainRoles.ts`, `src/sim/brainDefend.ts`; rewrite `src/sim/brain.ts`; modify `constants.ts`; tests `tests/sim/brainRoles.test.ts`, `tests/sim/brainDefend.test.ts`, `tests/sim/brain.test.ts`.

**Interfaces — produces:**
```ts
// src/sim/brain.ts
export function brainIntent(state: MatchState, p: PlayerState): BrainIntent; // re-thinks when state.tick >= memory.thinkAt, else replays the stored plan
// src/sim/brainRoles.ts
export function assignRoles(state: MatchState, team: TeamId): BrainRole[]; // one per player id of that team, indexed by position in the team (0 = keeper)
// src/sim/brainDefend.ts
export function planDefence(state: MatchState, p: PlayerState, role: BrainRole, level: LevelSpec): Partial<BrainMemory>;
export function smartSpot(anchor: Vec, smart: Vec, positioning: number): Vec; // linear blend, clamped to the pitch
```

Rules:
- **Thinking.** On a think tick the player gets a role and a plan (`target`, `action`, `aim`, `turbo`), and `thinkAt = tick + level.reactionTicks`. Between thinks the stored plan is replayed: move toward `target` (stand still within `ARRIVE_DIST`), press the stored button once. Three things force an immediate re-think regardless of `thinkAt`: the player gains or loses the ball; the ball's owner changes team; the player becomes able to act again. A player who cannot act has his memory reset to `blankMemory()` (Review Focus 1).
- **Roles when the other team has the ball:** nearest standing outfielder to the carrier is `presser`; the next nearest to the point midway between the carrier and own goal is `cover`; the other outfielders are `marker`s, each taking the nearest unmarked opposing outfielder (ascending id, no double-marking). **Loose ball:** nearest standing outfielder is `chaser` (a pass target is `receiver`), the rest `support`. **Own ball:** owner is `carrier`, the rest `support` (Task 3 gives these their behaviour; until then `carrier` keeps the M2 run-and-shoot and `support` holds the shifted anchor). Human teams: the controlled player is never assigned by the brain; the others take the remaining roles in the same order.
- **Defending.** Presser: runs at the carrier (turbo if `usesTurbo` and farther than 40 units). Cover: stands on the line between the ball and own goal centre, `JOCKEY_DIST` × 2 from the ball. Marker: stands between his man and own goal, 8 units from the man, pulled toward the anchor by `1 − positioning` via `smartSpot`.
- **Hitting** (computer teams only). A presser whose team cooldown allows and whose target is within `hitRange` picks the hit: `big` if the level allows it, the meter has `TURBO_COST`, and the carrier is moving slower than `RUN_SPEED / 2` or is the keeper (then `action: 'chargeBig'`, holding HIT for `BIG_HIT_CHARGE_TICKS + 2` while closing in); else `slide` if allowed and a turbo burst is active or can be started (press turbo, then tap); else `shoulder` (tap). The lunge heading is the direction to the target rotated by `(nextRandom × 2 − 1) × hitAimErrorRad`. Late hits: on a think, a marker or cover with an opponent within `hitRange` who does not have the ball goes for him with probability `lateHitChance`.
- Delete `CPU_ENGAGE_RANGE` and the old jockey-then-engage branch.

- [ ] **Step 1:** `brainRoles.test.ts`: exact role lists for hand-placed positions in each of the three ball states; downed players get no pressing or chasing role (fall back to all players only if everyone is down); no opponent is double-marked; a human team's controlled player is skipped.
- [ ] **Step 2:** `brainDefend.test.ts`: exact targets for presser, cover and marker at `positioning` 0, 0.5 and 1; hit choice table (level allows big + meter + slow carrier → chargeBig; else slide with turbo; else tap); the heading error is within ±`hitAimErrorRad` and is exactly 0 when the value is 0; `lateHitChance` 0 never late-hits over 2000 thinks, 1 always does when in range.
- [ ] **Step 3:** `brain.test.ts`: a plan is replayed unchanged for `reactionTicks − 1` ticks and replaced on the think tick; each of the three forced re-thinks; a flattened charger does not launch on getting up; memory is blank after kickoff; a human's brain-driven teammates never produce `hitPress`/`hitHeld`. Fuzz: for seeds 1–20 and all four levels, 3000 ticks CPU v CPU, every intent is finite with length ≤ 1 + 1e-9 (Review Focus 3).
- [ ] **Step 4:** Full check; commit `feat(sim): thinking brain with defensive roles and level-driven hitting`.

### Task 3: Attacking and keepers

**Files:** Create `src/sim/brainAttack.ts`, `src/sim/brainKeeper.ts`; modify `brain.ts`, `movement.ts`, `constants.ts`; tests `tests/sim/brainAttack.test.ts`, `tests/sim/brainKeeper.test.ts`.

**Interfaces — produces:**
```ts
// src/sim/brainAttack.ts
export function planCarrier(state: MatchState, p: PlayerState, level: LevelSpec): Partial<BrainMemory>;
export function planSupport(state: MatchState, p: PlayerState, level: LevelSpec): Partial<BrainMemory>;
export function laneIsOpen(state: MatchState, from: Vec, to: Vec, team: TeamId): boolean; // no standing opponent within LANE_HALF_WIDTH of the segment
export function shotAim(state: MatchState, p: PlayerState, level: LevelSpec): Vec;
// src/sim/brainKeeper.ts
export function planKeeper(state: MatchState, p: PlayerState, level: LevelSpec): Partial<BrainMemory>;
```

Rules:
- **Carrier,** in order: (1) within `shootRange` of the goal and the lane to the aim point is open → shoot; `shotAim` targets the post farther from the keeper, `SHOT_Y_MARGIN` inside it, then rotates the aim by `(nextRandom × 2 − 1) × shotErrorRad`. (2) An opponent within `pressureDist` and at least one teammate with an open lane who is not farther from the opposing goal than the carrier by more than `PASS_BACK_LIMIT` (40) → pass to the best option (most advanced, ties to the lower id); with probability `passMistakeChance` take the second-best if one exists. (3) Otherwise dribble at the goal, steering `DRIBBLE_SWERVE_RAD` (0.6) away from the nearest opponent ahead within `pressureDist` × 1.5; press turbo if `usesTurbo` and no opponent is within 30 units ahead.
- **Support:** two outfielders push ahead of the ball into the channels (y = 28 and 96, x = ball x + `SUPPORT_AHEAD` (50) toward the opposing goal, clamped 30 units short of the goal line); the third stays `SUPPORT_BEHIND` (40) behind the ball centrally as the safe pass. Each target is blended with the formation anchor by `positioning` via `smartSpot`. A supporter whose lane from the carrier is blocked slides `LANE_SHIFT` (12) in y away from the blocker.
- **Receiver / chaser:** run at the ball (existing behaviour).
- **Keeper:** with the ball: after `GK_HOLD_TICKS`, pass to the teammate with an open lane who is farthest from any opponent (not simply the nearest). Without it: if the ball is free and moving toward his goal faster than `PICKUP_MAX_BALL_SPEED / 2`, move to the y where the ball's path crosses his line (clamped to the goal mouth, ± `PLAYER_RADIUS`); otherwise track the ball's y as now. `GK_SPEED × keeperSpeedFactor` applies in `movement.ts` (read from the level; no level names in code). A keeper leaves his line to collect a free ball inside `GK_CLAIM_DIST` (30) of his goal when he is the nearest player to it.

- [ ] **Step 1:** `brainAttack.test.ts`: exact decisions for hand-placed positions — shoots in range with an open lane; aims at the far post (keeper high → aim low and the reverse) with exact coordinates at `shotErrorRad` 0; passes under pressure to the most advanced open teammate; does not pass into a blocked lane; does not pass backwards beyond `PASS_BACK_LIMIT`; `passMistakeChance` 1 takes the second-best; swerves away from an opponent ahead (sign and magnitude of the heading); turbo only with space and `usesTurbo`. `laneIsOpen` boundary cases at exactly `LANE_HALF_WIDTH` (6). Support targets at `positioning` 0 and 1 with exact coordinates for both teams (mirroring).
- [ ] **Step 2:** `brainKeeper.test.ts`: intercept y for a shot from each side (exact), clamped at the posts; ignores a slow or outgoing ball; distribution picks the unmarked teammate over the nearer marked one; claims a loose ball inside `GK_CLAIM_DIST` only when nearest; `keeperSpeedFactor` scales his speed exactly.
- [ ] **Step 3:** Wire into `brain.ts`. The existing human scoring tests (far-post shot scores, central shot is saved) must still pass at level `pro`; if the smarter keeper breaks the far-post goal, report the numbers rather than weakening the test. Full check; commit `feat(sim): computer passing, shooting, support runs and smarter keepers`.

### Task 4: Catch-up boost, balance bands, level on screen, docs

**Files:** Modify `src/sim/movement.ts`, `constants.ts`, `levels.ts`; create `tests/sim/balance.test.ts`, `tests/sim/catchup.test.ts`; modify `src/game/Hud.ts`, `e2e/demo.spec.ts`, `README.md`, `CLAUDE.md`, `docs/ROADMAP.md`.

- [ ] **Step 1:** Catch-up: `CATCHUP_GOAL_GAP = 2`, `CATCHUP_SPEED_FACTOR = 1.06`, `CATCHUP_TURBO_REFILL_FACTOR = 1.5`, applied to every player and the turbo meter of a side trailing by `CATCHUP_GOAL_GAP` or more, human or computer. Exact-value tests at gaps 1, 2 and 3 for both teams.
- [ ] **Step 2:** `tests/sim/balance.test.ts` — a measurement harness (pure helper `playMatch(config)` returning hits by tier, goals, shots, ticks at rage ≥ 80, Dazed count) and these bands, all CPU v CPU, 2 × 120 s:
  - Mirror matches, seeds 1–10, per level, averages: goals per match rookie 1–5, pro 2–7, bruiser 2–8, psycho 3–10; at most 3 of 10 matches end 0–0. Hits per match rookie 8–25, pro 15–40, bruiser 30–70, psycho 45–110, strictly increasing along `LEVEL_ORDER`. Each team at rage ≥ 80 for under 60% of play on average.
  - Psycho v rookie, seeds 1–10 (alternate which team is which): psycho wins at least 7. Pro v rookie: pro loses at most 3.
  - A scripted naive human (takes the ball, runs at goal, never passes or hits) against each level, seeds 1–3: median possession at least 240 ticks against rookie and at most 150 against psycho.
  Tune `LEVELS` values (and, if the brain cannot reach a band by values alone, say exactly which rule is the obstacle) until the bands hold. Keep the suite's total run time under 60 s; if needed, mark the balance file to run in its own Vitest project or with fewer seeds and say so. Print one compact table of the measured numbers in the test output only when an env var asks for it; put the final table in the report and in `docs/ROADMAP.md`.
- [ ] **Step 3:** The HUD shows the computer's level label (from `LEVELS[...].label`) small, under the VIPERS name or beside the clock, without overlapping the rage meters; screenshot at two levels and look. E2E: `?demo=1&level=psycho&level2=rookie` reaches full time; `?level=rookie` human test still passes; any e2e waits that depended on the old brain are re-derived, not just lengthened.
- [ ] **Step 4:** Docs: README (levels and the URL options), CLAUDE.md (brain structure: memory, think cadence, one table, acts only through intents), `docs/ROADMAP.md` (M3 status; remove finished carry-overs; record the measured table; list what is left for M4). Full check plus `npm run e2e`; commit `feat(sim): catch-up boost and balance bands for four levels; docs for M3`.
