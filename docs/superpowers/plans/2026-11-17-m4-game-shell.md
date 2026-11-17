# M4 — Game shell

Base: `m4-game-shell` from verified M3 `2ded47f`; M3 remains pending merge. Design authority: `docs/superpowers/specs/2026-11-16-futbol-frenzy-design.md`; visual reference: title, setup and halftime canvases in `mockups.html`. Follow CLAUDE.md and AGENTS.md: tests first, one task at a time, Terra implements and reports checks, independent Sol reviews brief, diff and evidence before the next task. Visual tasks require the reviewer to run the game and inspect screenshots against those canvases. Tick each completed task in its implementation commit. No user approval gate is required between tasks.

## Scope decisions

- Six fictional teams; choose either side in setup, default distinct opponents. Ratings are visible and have named, tested effects on both human and CPU play. Power maps linearly to 0.8–1.3. Keep tuning modest and data-driven, not a new balance gate.
- Lengths: two 120s or 240s halves, or first to five. First to five has no clock expiry and ends immediately on the fifth goal; provide a halftime at the first team reaching three, once, unless that goal already ends the match. Draws in timed Cup matches eliminate the player; wins advance through each other team once in stable table order, loss or draw ends the run. No persistence across reloads is required.
- Automatic substitution at lethal damage uses one of three team reserves, replacing the same player slot with fresh health and reset transient state after the hit; keeper included. Without reserves, health clamps to 1 and remains Dazed under existing rules. Count each lethal hit as a KO. Preserve existing live health regeneration and halftime healing deviation.
- Stats count shots when a shot kick occurs, big hits when a big hit lands, KOs on lethal hits, and steals when a hit causes an opposing carrier to drop the ball; report per-team cumulative match totals. Hit of the half is highest damage landed in that half, earliest tick then event order breaks ties; show an explicit no-hit state. Replay a short window around that hit from seed and recorded per-tick inputs, with deterministic reconstruction including CPU decisions; presentation effects are cosmetic.
- Pause and halftime stats stop sim ticks until explicit resume. Replay uses separate reconstructed state and never changes the live match, RNG, recorded inputs, stats or cup session. New match, quit, restart, visibility changes, and scene shutdown must clear stepper backlog, input/listeners and transient effects; Cup progression is owned outside the match scene. Query demo and test parameters remain usable, with demo bypassing shell.

## Tasks

### 1. Team data and simulation ratings
- [ ] Add six fictional team records with names, kit choices and four ratings; inspect existing `KITS`/atlas constraints before mapping kits. Extend `MatchConfig` with backwards-compatible defaults so existing demos/tests work. Pass plain rating values into sim without importing presentation/content from `src/sim`.
- [ ] Apply Speed to movement, Power to `attack.ts` damage in place of `TEAM_POWER`, Skill to a documented kick/pass mechanic, and Dirty to a documented hit mechanic for both human and CPU. Put tuning in named data/constants. Test boundaries, neutral defaults, both teams, observable effects, deterministic seed and sim purity. Run `npm test`, typecheck; Sol review.

### 2. Substitutions and statistics
- [ ] Extend state and events at the actual `hurtPlayer`/`resolveContacts`, `kick` and possession boundaries. Preserve hit presentation and stable player IDs/brain indexing; ensure lethal hit drops ball and control changes safely before replacement. Reset reserve transient fields and brain memory, decrement exactly once; 1 HP fallback after depletion. Account for concurrent hits and halftime.
- [ ] Add deterministic per-team stats and half hit selection using explicit events/state; avoid counting passes, misses or duplicate events. Test all counters, both sides, KO edge cases, three reserves, exhausted reserve, keeper, halftime and regen. Run `npm test`, typecheck and determinism/purity suites; Sol review.

### 3. Match rules and session ownership
- [ ] Extend `createMatch`/`advanceFlow` for the three length choices and first-to-five decision above, including goal and halftime boundary ordering. Keep existing numeric `halfSeconds` query semantics for demos. Implement pure Cup ladder/session transitions with explicit start, win, draw, loss, completion and quit; match configs carry selected teams and difficulty. No simulation imports from other source layers.
- [ ] Test exact goal/clock boundaries, halftime once, final whistle, ladder excludes selected team, all opponents, draw/loss, fresh session and deterministic resets. Run `npm test`, typecheck; Sol review.

### 4. Replay and lifecycle
- [ ] Record copied input pairs exactly once for each actual `step` (including non-play ticks), plus immutable initial config. Reconstruct from `createMatch` and inputs to a bounded pre/post-hit window; index events consistently with current `step` tick increment. Pause live stepping on stats/replay and resume from unchanged state. Define lifecycle owner and cleanup for FixedStepper, input handlers, visibility, scene restarts and `window.__ff`; keep mute/seed/half/level/demo hooks functional.
- [ ] Test replay state/event equality at selected hit, ties, no hit, CPU/human input, no mutation of live state, pause/resume, restart and repeated scene cleanup. Run `npm test`, typecheck and relevant e2e; Sol review, including replay/pause visual inspection.

### 5. Title and setup
- [ ] Build touch and keyboard accessible title and setup screens in 320×180 pixel style using existing font/palette/art. Offer 1P vs CPU and Cup Run, teams, all four difficulties and lengths, back/start; do not expose nonfunctional 2P/options as playable features. Adapt `BootScene`, `main.ts` and `MatchScene.init` to route selected configuration; preserve direct demo queries. Show ratings and distinguish kits.
- [ ] Test pure selection/config mapping and navigation; e2e title → setup → match, changes and back, demo bypass. Run `npm test`, build and e2e. Sol runs game and compares title/setup screenshots to mockups, reporting layout, legibility and touch targets.

### 6. Halftime, fulltime and Cup screens
- [ ] Replace automatic halftime countdown/restart interaction for shell sessions with explicit stats, hit replay and continue controls; show score, all four stats for both teams, reserves and hit/no-hit. Fulltime offers appropriate next Cup match, result, retry/new match and title flows. Keep demo behavior testable and replay isolated. Use mockup halftime as visual target.
- [ ] Unit-test screen models and transitions; e2e scripted short matches across halftime, replay, fulltime, Cup advance/loss and return to title. Confirm no stale state or duplicate listeners after repeated matches. Run `npm test`, build, e2e. Sol runs and compares halftime/fulltime screenshots against mockups and reports observations.

### 7. Milestone verification and delivery
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, `npm run e2e`; inspect screenshots and exercise normal, demo, replay and Cup flows. Record results and any real-phone limitations in this plan and roadmap. Independent Sol reviews full milestone diff, standards, test evidence and visual screenshots. Resolve findings and obtain passing review.
- [ ] Update roadmap and progress, commit all milestone code/docs/progress conventionally, push `m4-game-shell` to origin, verify remote hash and branch and report them. Do not call delivered on push failure; no force push or automatic main merge.
