# Futbol Frenzy roadmap

Status values: not started, in progress, done. Task-level progress is the checkboxes in each plan.

| # | Milestone | Plan | Status |
|---|---|---|---|
| M1 | Playable core: move, pass, shoot, score against a basic computer side; browser and Android | `superpowers/plans/2026-11-16-m1-playable-core.md` | done (merged to `main`); real-phone check outstanding |
| M2 | Hits, rage, tiered hurt animations, rotating callouts | not written yet | not started |
| M3 | Computer opponent with four difficulty levels | not written yet | not started |
| M4 | Game shell: title, setup, teams, stats, substitutions, Cup Run | not written yet | not started |
| M5 | Android release: signed build, icon, vibration, settings | not written yet | not started |
| V2 | Online two-player | not written yet | not started |

## Carried into M2 (from the M1 whole-branch review)

Do these first in M2, before adding hits:

- Replace the `AnimName` union with a player status in the sim (`free` / `kicking` / `hurt` with tier, variant, ticks); presentation maps status to an animation key from `src/content/animations.ts`. This also removes the `KICK_ANIM_TICKS` / `ANIMS.kick` double bookkeeping.
- Generalise `Pose` in `src/art/sprites.ts` so the whole body can change per frame (faceplant, lying down, spinning); today only legs, arms and bob vary.
- Add a "can act" gate in `step`: no intent while hurt, a separate knockback velocity, and downed players excluded from pickup, control switching, chaser selection and pass targets. Hit resolution goes after actions and before `updatePossession`.
- `PlayerIntent` needs `hit` with press, hold and release (the big hit charges).
- The HUD has one banner slot; callouts need their own layer or queue (and a unit-tested banner timer). Store the full-time tick in one place.
- Trim `src/sim/index.ts` to types, constants, vec, `nextRandom`, `createMatch`, `neutralPad`, `step`, `attackDir`, `goalCenter`.
- Strengthen `tests/sim/determinism.test.ts`: 120 s halves, a scripted human pad sequence, and a JSON copy-and-continue check.
- Scope Node types to tests and config so `src/sim` cannot use `process` / `Buffer`; make the purity test recursive.
- Sound: a minimum gap per sound name; move the sound table to `src/content/`.
- `TouchControls.read()` should not redraw; redraw once per frame.
- Gate `window.__ff` to dev builds (by M5).

Known gameplay limits at the end of M1 (expected until later milestones):

- The computer cannot take the ball from a carrier (no tackling until M2) and rarely scores (real opponent AI is M3).
- A chaser pinned on its own goal line, or caught by a turbo dribble, still intercepts a pass made right next to it.
- Shots score from an angle at the far post; central shots are saved.
- 16:9 picture: black side bars on wider phones; a possible notch strip in landscape needs a real-phone check.
- Not yet verified on a physical phone: SHOOT / HIT / turbo buttons, stick plus a button together, sound, frame rate.
