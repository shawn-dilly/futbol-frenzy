# Futbol Frenzy roadmap

Status values: not started, in progress, done. Task-level progress is the checkboxes in each plan.

| # | Milestone | Plan | Status |
|---|---|---|---|
| M1 | Playable core: move, pass, shoot, score against a basic computer side; browser and Android | `superpowers/plans/2026-11-16-m1-playable-core.md` | done (merged to `main`); real-phone check outstanding |
| M2 | Hits, rage, tiered hurt animations, rotating callouts | `superpowers/plans/2026-11-17-m2-hits-rage-callouts.md` | built and reviewed on branch `m2-hits-rage-callouts` |
| M3 | Computer opponent with four difficulty levels | not written yet | not started |
| M4 | Game shell: title, setup, teams, stats, substitutions, Cup Run | not written yet | not started |
| M5 | Android release: signed build, icon, vibration, settings | not written yet | not started |
| V2 | Online two-player | not written yet | not started |

## Carried into M5

- Gate `window.__ff` (state and the `showCallout` hook) to dev builds.

## Carried into M3

- CPU-v-CPU matches currently run about 120 hits and 22 goals per 4 minutes. The M3 opponent must own hit frequency and defending per difficulty level; the placeholder shoulder-charge (`CPU_ENGAGE_RANGE`, `CPU_HIT_COOLDOWN_TICKS`) goes.
- Team `power` is 1 until M4 ratings.
- Substitutions at 0 health are M4 (a player at 0 stays on 1 health and Dazed).
- `ShuffleBag` weight proportions are diluted by the early refill; no callout uses `weight` yet.
- Hit-stop does not read input during the freeze.
- Sounds have never been listened to.
- Nothing is verified on a physical phone.

Known gameplay limits at the end of M1 (expected until later milestones):

- The computer shoulder-charges the carrier when in reach but has no real defending or attacking (opponent AI is M3).
- A chaser pinned on its own goal line, or caught by a turbo dribble, still intercepts a pass made right next to it.
- Shots score from an angle at the far post; central shots are saved.
- 16:9 picture: black side bars on wider phones; a possible notch strip in landscape needs a real-phone check.
- Not yet verified on a physical phone: SHOOT / HIT / turbo buttons, stick plus a button together, sound, frame rate.
