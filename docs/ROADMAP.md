# Futbol Frenzy roadmap

Status values: not started, in progress, done. Task-level progress is the checkboxes in each plan.

| # | Milestone | Plan | Status |
|---|---|---|---|
| M1 | Playable core: move, pass, shoot, score against a basic computer side; browser and Android | `superpowers/plans/2026-11-16-m1-playable-core.md` | done (merged to `main`); real-phone check outstanding |
| M2 | Hits, rage, tiered hurt animations, rotating callouts | `superpowers/plans/2026-11-17-m2-hits-rage-callouts.md` | done (merged to `main`); real-phone check and a listen to the sounds outstanding |
| M3 | Computer opponent with four difficulty levels | `superpowers/plans/2026-11-17-m3-computer-opponent.md` | in progress on branch `m3-computer-opponent` |
| M4 | Game shell: title, setup, teams, stats, substitutions, Cup Run | not written yet | not started |
| M5 | Android release: signed build, icon, vibration, settings | not written yet | not started |
| V2 | Online two-player | not written yet | not started |

## Deviations from the design awaiting the owner

- Players regenerate health slowly during play (0.5 per second, `HEALTH_REGEN_PER_TICK`); the design heals only at halftime. Added because every outfielder otherwise ended a match on 1 health.

## Carried into M4

- Team power and substitutions (a player at 0 health stays on 1 health and Dazed until then).

## Carried into M5

- Gate `window.__ff` (state and the `showCallout` hook) to dev builds.

## Carried into M3

- Before the final fix wave, CPU-v-CPU matches ran about 120 hits and 22 goals per 4 minutes (numbers after it are below). The M3 opponent must own hit frequency and defending per difficulty level; the placeholder shoulder-charge (`CPU_ENGAGE_RANGE`, `CPU_HIT_COOLDOWN_TICKS`) goes.
- The computer cannot charge a big hit: `attack.ts` cancels a charge for any player a human is not controlling.
- `BrainIntent.hit` bypasses the turbo cost and eligibility checks; route brain hits through the same checks as human hits.
- The computer's cooldown, engage range and hit range (`CPU_HIT_COOLDOWN_TICKS`, `CPU_ENGAGE_RANGE`, `CPU_HIT_RANGE`) belong in the difficulty table.
- `MatchConfig` has no difficulty field, and the brain has no memory slot in state for a reaction delay.
- `hitDamage` has no per-team modifier for power or catch-up.
- Re-run the balance measurements after M3 tuning (script idea: CPU v CPU seeds 1-5 for hits by tier, goals, rage at 80 or more, Dazed at full time; a scripted dribbler's possession length).
- Balance after the M2 final fix wave (team-wide computer hit cooldown of 8 s, health regeneration, rage decay on play ticks only). CPU v CPU, seeds 1-5, 2 x 120 s:

  | seed | stumble | knockdown | wipeout | over the top | goals | rage at 80+ (team 0 / 1) | Dazed at full time |
  |---|---|---|---|---|---|---|---|
  | 1 | 36 | 1 | 0 | 0 | 1 | 0% / 0% | 0 |
  | 2 | 16 | 42 | 0 | 0 | 10 | 51.9% / 55.6% | 3 |
  | 3 | 34 | 0 | 0 | 0 | 0 | 0% / 0% | 0 |
  | 4 | 32 | 9 | 0 | 0 | 3 | 5.3% / 10.8% | 0 |
  | 5 | 34 | 0 | 0 | 0 | 0 | 0% / 0% | 0 |

  A scripted human who picks up the ball and runs at goal without hitting loses it after a median of 211 ticks (116 possessions over seeds 1-3, range 10 to 536; every loss leaves the ball loose, none ended in a goal). Seed 2 is an outlier: its rage runs away once a few hits land. Four of five matches end 0-0 to 2-1 or 0-1, so M3 must also give the computer an attack.
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
