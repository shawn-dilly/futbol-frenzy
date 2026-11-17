# Futbol Frenzy roadmap

Status values: not started, in progress, done. Task-level progress is the checkboxes in each plan.

| # | Milestone | Plan | Status |
|---|---|---|---|
| M1 | Playable core: move, pass, shoot, score against a basic computer side; browser and Android | `superpowers/plans/2026-11-16-m1-playable-core.md` | done (merged to `main`); real-phone check outstanding |
| M2 | Hits, rage, tiered hurt animations, rotating callouts | `superpowers/plans/2026-11-17-m2-hits-rage-callouts.md` | done (merged to `main`); real-phone check and a listen to the sounds outstanding |
| M3 | Computer opponent with four difficulty levels | `superpowers/plans/2026-11-17-m3-computer-opponent.md` | done on branch `m3-computer-opponent`; pending merge |
| M4 | Game shell: title, setup, teams, stats, substitutions, Cup Run | `superpowers/plans/2026-11-17-m4-game-shell.md` | done on branch `m4-game-shell`; pending merge |
| M5 | Android release: signed build, icon, vibration, settings | not written yet | not started |
| V2 | Online two-player | not written yet | not started |

## Deviations from the design awaiting the owner

- Players regenerate health slowly during play (0.5 per second, `HEALTH_REGEN_PER_TICK`); the design heals only at halftime. Added because every outfielder otherwise ended a match on 1 health.

## M4 verification

GPT-6.2 Sol approved M4 at `ad4a2dc` after independently passing 554 unit tests, 33 Chromium tests, typecheck and the production build. Coverage includes normal title/setup and friendly results, direct human play, CPU demo, isolated hit replay, six rated teams, substitutions and the five-opponent Cup ladder.

Sol verified a live Cup draw/retry and checked duplicate taps and advancement. Cup win/loss tests script the final scores. Result screens were inspected at 640×360 and use a textual hit card. Physical Android touch, audio and suspend/resume remain unverified, as does human balance across selectable teams.

## Carried into M5

- Gate `window.__ff` (state and the `showCallout` hook) to dev builds.

## M3 progress and remaining limits

The difficulty table, brain memory and cadence, attacking and defending behavior, and shared hit input path are implemented. Catch-up and balance tuning are complete. Verified mirror-match measurements (seeds 1–10):

| Level | Goals | Hits | 0–0 | Shots | Dazed transitions | Rage ≥80, team 0 / 1 |
|---|---:|---:|---:|---:|---:|---|
| Rookie | 4.4 | 20.9 | 0 | 14.8 | 0 | 0.5% / 2.2% |
| Pro | 6.9 | 37.2 | 0 | 26.8 | 4.8 | 0.5% / 0.4% |
| Bruiser | 2.3 | 64.1 | 0 | 13.1 | 8.6 | 10.7% / 11.9% |
| Psycho | 4.8 | 104.5 | 0 | 15.8 | 13 | 38.7% / 40.8% |

Psycho and pro each won 10/10 against rookie. Pooled completed possession episodes are measured in live ticks, excluding phase-censored episodes:

| Level | Seeds 1–3 median | Completed / censored | Seeds 4–6 median | Completed / censored |
|---|---:|---:|---:|---:|
| Rookie | 241 | 3 / 0 | 241 | 3 / 0 |
| Pro | 30 | 66 / 2 | 44 | 81 / 3 |
| Bruiser | 72 | 141 / 3 | 62.5 | 130 / 1 |
| Psycho | 14 | 183 / 1 | 14 | 203 / 1 |

Rookie's three completed episodes per group limit broader gameplay conclusions. Held-out pro seeds 11–20 average 7.8 goals, above the diagnostic ceiling of 7; this is an accepted diagnostic limitation. Rookie keeper speed factor 1.4 versus psycho 1.1 is a tuning tradeoff; player feel remains unverified. Shot and keeper sensitivity probes are optional future tuning.

M4 adds the team power modifier to hit damage. Shuffle-bag weights are diluted by early refill; hit-stop does not read input during the freeze. Sounds and controls still need a physical-phone check. Wider phones have black side bars and may need a notch strip.
