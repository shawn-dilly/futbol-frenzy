# Futbol Frenzy

Arcade 5-a-side soccer for Android with a retro 8-bit look and no referee. Built with TypeScript, Phaser 4 and Vite, wrapped for Android with Capacitor 8. All art is drawn in code and all sound is synthesised.

**Status:** milestones 1 and 2 are built: move, pass, shoot and score, plus hits, rage, hurt animations and announcer callouts, against a basic computer side. Milestone 3 is complete on its branch pending merge, with four computer difficulty levels. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Run it

Needs Node 22.

```
npm install
npm run dev      # http://localhost:5173
```

| Key | Action |
|---|---|
| Arrows / WASD | move |
| J | pass (switch player without the ball) |
| K | shoot |
| L | hit (see below) |
| Space | turbo |

**Hits.** A hit launches when you release HIT. A quick tap is a shoulder charge. A tap while a turbo burst is active is a slide tackle. Hold for about half a second (30 ticks) and release for a big hit; it costs a turbo segment, and on screen the HIT button fills and turns yellow when a big hit is ready. The ball carrier cannot hit. Players who are lunging, recovering or hurt cannot pick up the ball, and a flattened player is thrown in the direction of the hit. Hits fill the rage meters under the scores, and low health leaves a player Dazed.

On a phone or a touch screen the stick and buttons appear on screen. URL options: `?demo=1` (computer v computer), `?seed=N`, `?half=SECONDS`, `?mute=1`, `?level=rookie|pro|bruiser|psycho` (VIPERS computer level, default pro), and `?level2=rookie|pro|bruiser|psycho` (RHINOS level in demo mode; defaults to `level`).

## Check it

```
npm test             # unit tests
npm run typecheck
npm run e2e          # headless-browser smoke test (first run: npx playwright install chromium)
```

## How to add a callout

Callouts are the announcer lines shown after a hard hit. Each is one entry in `CALLOUTS` in `src/content/callouts.ts`; nothing else changes.

```ts
{ id: 'timber', text: 'TIMBER!', tiers: ['knockdown'] },
{ id: 'pow', text: 'POW!', tiers: ['wipeout', 'overTheTop'], hitTypes: ['big'], weight: 2 },
```

- `id`: the text in lower-case kebab-case (`'timber'`). Must be unique.
- `text`: upper case, only glyphs the pixel font has, at most two lines at its tier's size.
- `tiers`: which hits may trigger it: `knockdown`, `wipeout`, `overTheTop`. A stumble has no callout. Each tier needs at least 10 lines.
- `hitTypes` (optional): narrow it to `shoulder`, `slide` or `big` hits.
- `weight` (optional, default 1, at least 1): a higher weight makes it turn up more often.
- `audio` (optional): the name of a recorded clip to play with it.

Lines are drawn from a shuffle bag, so they rotate without back-to-back repeats. Run `npm test` after adding one: the callout tests check ids, glyphs, line wrapping and the minimum per tier.

## Android

Needs JDK 21+ and the Android SDK (`ANDROID_HOME` set).

```
npm run android:apk  # debug APK in android/app/build/outputs/apk/debug/
```

## How it is organised

- `src/sim/` — the match itself: pure, deterministic TypeScript with one entry point, `step(state, inputs)`, at 60 ticks per second. No engine or browser code.
- `src/art/`, `src/input/`, `src/audio/`, `src/game/` — drawing, controls, sound and the Phaser scenes. They read match state and never change it.
- `android/` — the Capacitor wrapper.
- `docs/superpowers/specs/` — the game design. `docs/superpowers/plans/` — one build plan per milestone, with progress ticked off.
- `CLAUDE.md` — shared project standards and workflow. `AGENTS.md` is the Codex / T3 entry point; `.claude/agents/` contains the Claude Code role definitions.
