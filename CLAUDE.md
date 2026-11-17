# Futbol Frenzy

Arcade 5-a-side soccer for Android with a retro 8-bit look and no referee: players tackle and flatten each other. TypeScript + Phaser 4 + Vite, wrapped with Capacitor 8.

- Design (the authority on what the game is): `docs/superpowers/specs/2026-11-16-futbol-frenzy-design.md`
- Plans, one per milestone: `docs/superpowers/plans/`
- Visual reference: `mockups.html` (open in a browser)

## Commands

```
npm run dev          # Vite dev server on :5173  (?demo=1 CPU v CPU, ?seed=N, ?half=SECONDS, ?mute=1)
npm test             # Vitest unit tests
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + production build to dist/
npm run e2e          # Playwright smoke test, writes screenshots to artifacts/
npm run android:sync # build + copy web assets into android/ (run once after a fresh clone, before opening Android Studio)
npm run android:apk  # the above + debug APK at android/app/build/outputs/apk/debug/ (needs JDK 21+, ANDROID_HOME set)
```

## Architecture rules

Three layers. Each depends only on the ones above it in this list.

1. `src/sim/` — the match. Pure TypeScript. One entry point, `step(state, inputs)`, at a fixed 60 ticks per second. No Phaser, no DOM, no imports from other `src/` folders, no `Math.random`, no clock; randomness only through `nextRandom(state)`. Same seed and inputs must give the same match (`tests/sim/determinism.test.ts`, `tests/sim/purity.test.ts`).
2. `src/art/`, `src/input/`, `src/audio/`, `src/game/` — presentation. Reads sim state, turns touches into `PadInput`, turns sim events into sound and effects. Never mutates match state.
3. `android/` — generated Capacitor wrapper. Game logic never goes here.

## Code standards

- **Clean interfaces.** Each file has one responsibility and a small exported surface. Other files use only what is exported through the plan's Interfaces blocks; `src/sim/index.ts` is the sim's public face. Presentation code never reaches into sim internals.
- **Pure logic is separate from the engine.** Anything that can be a pure function (math, layout, selection, formatting) lives in a file that imports no Phaser, so it can be unit-tested in Node.
- **Tests first.** Write the failing test, watch it fail, then implement. Every sim rule and every pure helper has a unit test with exact expected values. Test output must be free of warnings.
- **Reuse before writing.** Check `src/sim/vec.ts`, `src/art/pixelFont.ts`, and neighbouring files for an existing helper. A helper needed in two places is written once, generically, in the lowest layer that both can import. Do not copy a logic block.
- **No magic numbers.** Tunable values live in `src/sim/constants.ts` (rules) or a data file (`src/content/`), named, with units in the name or a comment.
- **Content is data.** Teams, callouts, animation definitions, and difficulty settings are data tables. Adding one must not require a logic change.
- **Build only what the task asks.** No speculative options or abstractions.
- **Content tables:** callouts in `src/content/callouts.ts` (with `shuffleBag.ts`), sound recipes in `src/content/sounds.ts`, sprite and hurt animations in `src/content/animations.ts` (a test forbids detached sprite pieces). Rules constants live in `src/sim/constants.ts`.
- **Status model:** each sim player has one `status` (`free`, `kicking`, `charging`, `lunging`, `recovering`, `hurt` with tier and variant) plus `statusTick` and `statusTicks`. Presentation maps status to an animation key; it never stores animation state in the sim. Only free, kicking and charging players act and pick up the ball.
- **Check current docs** for Phaser 4 and Capacitor 8 before using an API you are not sure of: `npx ctx7@latest library "<name>" "<topic>"`, then `npx ctx7@latest docs <id> "<topic>"`.
- All art is drawn in code and all sound is synthesised until the design says otherwise.

## Workflow

- Work happens on a branch per milestone (`m1-playable-core`, ...), never directly on `main`.
- One plan task at a time: implement against the brief, report the changes and checks, then have an independent reviewer verify the brief, diff, and standards before starting the next task. For visual work, inspect screenshots against the mockups and report what was observed.
- In Claude Code, the roles are `ff-implementer` (Sonnet), `ff-reviewer` (Opus), and `ff-playtester` (Sonnet); their definitions live in `.claude/agents/`. In Codex / T3, follow the model and review mapping in `AGENTS.md`. Harness-specific agent definitions do not configure another harness.
- Inspect and preserve unfinished work already in the working tree. Stage only the files for the authorized task; report conflicts or blocked checks.
- **Progress lives in the plan file.** When a step is done, tick its checkbox (`- [x]`) in the same commit as the work. `docs/ROADMAP.md` shows milestone status; update it when a milestone starts or lands.
- Commit after every task with a conventional message (`feat(sim): ...`, `test(e2e): ...`).
- A task is not done until `npm test` passes and, for anything visual, a screenshot has been looked at.
