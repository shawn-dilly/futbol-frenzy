# Futbol Frenzy

Arcade 5-a-side soccer for Android with a retro 8-bit look and no referee. Built with TypeScript, Phaser 4 and Vite, wrapped for Android with Capacitor 8. All art is drawn in code and all sound is synthesised.

**Status:** milestone 1 (playable core) is done: move, pass, shoot and score against a basic computer side. Tackling, rage and callouts are milestone 2. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

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
| L | hit |
| Space | turbo |

On a phone or a touch screen the stick and buttons appear on screen. URL options: `?demo=1` (computer v computer), `?seed=N`, `?half=SECONDS`, `?mute=1`.

## Check it

```
npm test             # unit tests
npm run typecheck
npm run e2e          # headless-browser smoke test (first run: npx playwright install chromium)
```

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
- `CLAUDE.md` and `.claude/agents/` — the rules and agents used to build the game with Claude Code.
