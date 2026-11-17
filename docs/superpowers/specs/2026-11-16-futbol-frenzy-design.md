# Futbol Frenzy — Design

Date: 2026-11-16. Status: awaiting approval.

"Decided by Shawn" marks what the owner said. "Call" marks a choice made on his behalf that he can overrule.

## Intent

An arcade soccer game for Android phones with a retro 8-bit look, smoother-than-8-bit animation, and no-referee physical play: players tackle, hurt, and flatten each other, with funny rotating callouts and sound. The fun is in the hits, not in simulating soccer.

## Goals

- Decided by Shawn: the name is **Futbol Frenzy**.
- Decided by Shawn: the look in `mockups.html` (320x180 pixel art, chunky text, touch stick plus buttons) is the target style.
- Decided by Shawn: v1 is one player against the computer, with difficulty levels.
- Decided by Shawn: every tackle triggers a callout (text and sound) drawn at random from a rotating pool, so it stays funny.
- Decided by Shawn: how badly a tackled player is hurt scales with the tackler's rage at the moment of the hit, and worse hurt plays a bigger, sillier animation (stumble, down, rolling around, over the top).
- Decided by Shawn: the work is executed by Opus and Sonnet agents from written plans.

## Non-goals (v1)

- Online or same-phone two-player. Decided by Shawn: online 2P is V2.
- iOS, tablets-specific layouts, gamepads.
- Real teams, leagues, or player names. All teams are fictional.
- Monetisation, accounts, cloud saves.

## Anti-goals

- A realistic soccer sim. Fouls, offsides, and stoppages do not exist.
- Gore or realistic injury. Hurt is cartoon: stars, spins, craters.
- Hits that feel the same every time. If the tenth tackle looks and sounds like the first, the design has failed.
- A sim that cannot be replayed deterministically. That would block replays now and online play in V2.

## Constraints

- Android first, landscape only, playable with two thumbs.
- All art and sound in v1 must be producible by coding agents: sprites are drawn in code, sound effects are synthesised. Both sit behind named lookups so real sprite sheets and recorded audio can replace them later without touching game logic.
- Agents must be able to verify their own work: logic by unit tests, visuals by headless-browser screenshots.

## Approaches

1. **Web stack: TypeScript + Phaser 4 + Vite, wrapped for Android with Capacitor 8. (Chosen — call.)** The game runs in a browser, so agents can test logic with Vitest and check visuals with screenshots without an emulator. The mockup drawing code ports directly. The match simulation is plain TypeScript with no engine imports, which is what a V2 server needs. Cost: runs in a WebView, so audio latency and frame pacing are slightly worse than native. At 320x180 with 10 sprites this is not a practical risk.
2. **Godot 4.** Better native performance and audio, real Android export. Cost: scenes and animations are built around an editor, visual checks need a running engine, and agents are weaker in GDScript than TypeScript. Slower and less verifiable for agent-driven work.
3. **Unity.** Rejected: editor-bound, binary assets, heavy for a 2D pixel game, poor fit for agents.

## Architecture

Three layers, each depending only on the one before:

- **`src/sim/` — the match.** Pure TypeScript, no Phaser, no DOM, no `Math.random`, no clock. One function, `step(state, inputs)`, advances the match one tick at a fixed 60 ticks per second. All randomness comes from a seeded generator stored in the state. Same seed plus same inputs gives the same match. It emits events (`kick`, `goal`, later `hit`) that the other layers react to.
- **`src/game/`, `src/art/`, `src/input/`, `src/audio/` — the presentation.** Phaser scenes read the state and draw it, turn touches into inputs, and turn events into sound, shake, and callouts. Nothing here changes match state.
- **`android/` — the wrapper.** A Capacitor project that packages the built web app.

Content that should be easy to tune or extend lives in data files, not code: teams, callouts, animation definitions, difficulty settings.

## The match (v1 rules)

- 5 a side: one keeper, four outfield. Call: bigger sprites and more collisions than 11 a side.
- The pitch is 480 wide by 124 tall in game units; the screen shows 320 of the width and the camera follows the ball.
- Walls on all sides. The ball bounces back; play never stops except for goals and halftime.
- Two halves, 2 minutes each by default. Options: 2 or 4 minute halves, or first to 5.
- Controls: stick to move, PASS, SHOOT, HIT, and a TURBO button. Call: turbo is a tap-triggered burst (1.5 s of speed for a third of the meter) rather than a held button, because one thumb cannot hold turbo and press another button.
- Without the ball, PASS switches control to the teammate nearest the ball.

## The hit system

**Hit types.** Shoulder charge (HIT while running, short reach), slide tackle (HIT while running with turbo active, long reach, long recovery on a miss), big hit (hold HIT to charge, release to launch; costs a turbo segment; misses leave the tackler face down).

**Rage.** Each team has a rage meter, 0 to 100.

| Event | Rage |
|---|---|
| Land a stumble / knockdown / wipeout / over-the-top hit | +10 / +14 / +18 / +22 |
| Take a hit | +6 |
| Concede a goal | +20 |
| No hit landed for 6 s | decays 2 per second |
| Land a wipeout or over-the-top hit | then spends 30 |

The spend is a call: without it a team at full rage would land the top-tier hit every time and the tiers would stop meaning anything.

**Damage.** `damage = base × (1 + 1.5 × rage / 100) × power × speed`

- `base`: shoulder 10, slide 16, big hit 24.
- `rage`: the tackling team's meter at the moment of contact (Decided by Shawn: rage drives hurt).
- `power`: 0.8 to 1.3 from the tackler's team Power rating.
- `speed`: 1.2 if the tackler has turbo active, else 1.

**Severity tiers.** Damage picks the tier; the tier picks the animation, the callout pool, the feedback, and how long the victim is out.

| Tier | Damage | Victim | Feedback |
|---|---|---|---|
| Stumble | under 15 | staggers 0.4 s, drops the ball | small thud, tiny shake |
| Knockdown | 15 to 29 | down 1.2 s | thud plus grunt, shake, callout |
| Wipeout | 30 to 44 | down 2.2 s, rolls around | freeze frame, big shake, crowd "ooh", callout |
| Over the top | 45 and up | launched, out 3.5 s | long freeze, flash, crowd gasp, big callout, stars |

**Hurt animations.** Each tier has at least two variants, chosen at random per hit, so the same tier does not always look the same. Starting set: Stumble (hop on one leg; windmill arms). Knockdown (faceplant; flat on back). Wipeout (clutches shin and rolls side to side; sits up dizzy with orbiting stars). Over the top (helicopter spin through the air; launched into the ad boards; leaves a player-shaped crater). Animations are defined as data (frame list, timing, travel arc) keyed by tier and variant, so adding one does not touch game logic.

**Health.** Each player has 100 health. Damage subtracts from it. Below 35 the player is Dazed: 20% slower, drops the ball to any hit, fumbles 15% of received passes. At 0 the player is carried off and substituted if a sub remains (3 per match); with none left he plays on Dazed at 1 health. Everyone recovers 25 at halftime.

**Late hits.** Players without the ball can be hit. The tackler then has a 1.5 s cooldown before the next hit.

## Callouts

One data file, `src/content/callouts.ts`. Each entry:

```ts
{ id: 'mom', text: "SOMEBODY CALL HIS MOM!", tiers: ['wipeout', 'overTheTop'], hitTypes?: ['big'], weight?: 1, audio?: 'mom.ogg' }
```

- Adding a line means adding one entry. No code changes.
- Selection uses a shuffle bag per tier: every eligible line plays once before any repeats, and the same line never plays twice in a row.
- `audio` is optional. With a clip, the clip plays. Without one, the tier's synthesised sound stack plays and the text carries the joke. Call: v1 ships text plus synthesised sound, with the audio slot ready for recorded or generated voice lines later.
- Text style grows with tier: small white for Knockdown, large flashing yellow for Over the top.
- Ships with at least 10 lines per tier. Seed lines: "CRUNCH!", "THAT'S GONNA LEAVE A MARK!", "SOMEBODY CALL HIS MOM!", "REF? WHAT REF?", "TAXI FOR NO. 9!", "HE'LL FEEL THAT IN THE OFFSEASON!", "CLEAN UP ON AISLE FIVE!", "HE'S SEEING TWEETY BIRDS!"

## Computer opponent

Four levels: Rookie, Pro, Bruiser, Psycho. They differ in reaction delay, pass and shot accuracy, how often and how hard they hit, and how well teammates position. Not just speed. A small catch-up boost goes to whichever side trails by two or more goals. All level settings live in one data table.

## Around the match

- Title screen, match setup (team, difficulty, match length), halftime and full-time stats (shots, big hits, K.O.s, steals), "hit of the half" replay (re-simulated from the recorded seed and inputs), substitutions.
- 6 to 8 fictional teams with Speed, Power, Skill, and Dirty ratings.
- Cup Run: a single-player ladder through every team.
- Settings: control size and side, sound volume, vibration.

## Roadmap

Each milestone is playable on its own and gets its own plan, written when the one before it lands so it can use the real interfaces.

| # | Milestone | You can… |
|---|---|---|
| M1 | Playable core | move, pass, shoot, and score against a basic computer side, in a browser and on an Android phone |
| M2 | Hits, rage, hurt, callouts | tackle, build rage, see tiered hurt animations and rotating callouts |
| M3 | Computer opponent | play four difficulty levels against a side that passes, defends, and hits back |
| M4 | Game shell | go from title to setup to match to stats; pick teams; play Cup Run; substitute |
| M5 | Android release | install a signed build with icon, vibration, settings, and tuned performance |
| V2 | Online two-player | play a friend over the internet |

## Left to the builder

- Exact sprite pixels and animation frame counts, within the mockup style.
- Synthesised sound design.
- Tuning of every number above; they are starting values and live in constants or data files.
- Phaser 4 and Capacitor 8 API details: check current docs (`npx ctx7@latest`) rather than relying on memory of older versions.

## Open items for Shawn (none block M1)

- Voice lines: record, generate, or stay text-only.
- Android application id. Placeholder `com.futbolfrenzy.app`; it is permanent once published.
