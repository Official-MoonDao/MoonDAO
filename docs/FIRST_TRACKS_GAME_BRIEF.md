# First Tracks — mini-game build brief

You're building **First Tracks**, the third MoonDAO DePrize mini-game, alongside **Touchdown** (`/touchdown`) and **Starship Catch** (`/starship`). It's a ~1–3 minute browser game: drive a commercial lunar rover off its lander and across a landing site, through real Earth–Moon signal delay.

A playable prototype exists and its design has been playtested and tuned with scripted drivers. Your job is to turn it into a production game at the quality of Touchdown and Catch: photorealistic, shareable, with a daily leaderboard. Where this brief gives numbers, treat them as tuned starting points, not specs. Where it says "your call", it is.

## Read first

- **Prototype (the source of truth for gameplay):** [`docs/FIRST_TRACKS_GAME_PROTOTYPE.html`](FIRST_TRACKS_GAME_PROTOTYPE.html). It's one self-contained three.js r128 file. Open it with any static server. `window.__ft` is a test hook (`__ft.run(seconds)`, `__ft.keys`, `__ft.state`, `__ft.targets`) for driving it headlessly; the scoring breakdown lands on `window.__ftScore`.
- **Prize rules:** [`docs/DEPRIZE_FIRST_TRACKS.md`](DEPRIZE_FIRST_TRACKS.md). The game's language and facts must match it (commercial rovers only, 10 m under own power after fully leaving the lander, independent verification such as an orbiter photo).
- **Touchdown**, the closest sibling and the main pattern to copy: `ui/components/touchdown/*`, `ui/lib/touchdown/*`, `ui/pages/touchdown.tsx`, `ui/pages/api/touchdown/leaderboard.ts`, `ui/pages/api/og/touchdown.tsx`, `ui/scripts/touchdown-bot.ts`.
- **Starship Catch**, the newest sibling, with better-documented scoring and the daily-conditions pattern: `ui/components/catch/*`, `ui/lib/catch/*` (it's on `main`).

## What to reuse from Touchdown and Catch

Follow their architecture and shared plumbing rather than inventing new versions:

- **Daily mission:** `lib/touchdown/mission.ts` (mission number from the shared epoch, `missionSeed`, `mulberry32`). Everyone gets the same site each UTC day, and `?m=` style challenge links replay an older day. The prototype uses the same epoch.
- **Easy / Pro modes:** a `modes.ts` config.
- **Deterministic physics and server-replayed leaderboard:** `lib/touchdown/detmath.ts`, `replay.ts`, `leaderboard.ts`, `leaderboardStore.ts`, `pages/api/touchdown/leaderboard.ts`. The browser sends recorded inputs, the server re-drives them and stores what the sim produces. First Tracks needs the same: the sim must be deterministic, and the score includes the par computation (below), so that runs server-side too.
- **Share card and challenge links:** `lib/touchdown/share.ts`, plus the OG image route `pages/api/og/touchdown.tsx`.
- **Verdicts:** `lib/touchdown/verdicts.ts` and its tone rules. Jokes are aimed at the player. Real outcomes are stated as fact. No digs at companies, agencies or people, and specifically none about the rovers lost on Peregrine, IM-2 or Hakuto-R 2. Never the words bet, gamble or wager.
- **"The real race" panel:** `components/touchdown/RealRacePanel.tsx` / `components/catch/CatchRaceView.tsx`, pointed at the shared goal `shared-first-tracks` (see `lib/lunar-atlas/seed/atlas.dataset.json`).
- **Headless bot:** `scripts/touchdown-bot.ts`. Build the equivalent so tuning changes can be checked automatically. At minimum it should confirm Easy is completable, and give rough score distributions for "careful", "average" and "sloppy" drivers.
- **Audio, analytics events (`lib/analytics/ga4.ts`), storage and the page shell:** copy the pattern.

## Look: as photorealistic as possible

The prototype is grey-box. The production game should look like the other two at their best.

- **The lander is the MoonDAO-branded Touchdown lander** (`buildLander` in `components/touchdown/models.ts`, with the MoonDAO mark from `public/touchdown/moondao-mark.png`), modified with:
  - a flat deck or platform the rover rides on, and
  - a deployable egress ramp, about 1.6 m wide, running from the deck to the ground.

  The proportions and layout are your call, as long as the rover visibly rides on the lander and has to drive down the ramp. Optionally, animate the ramp deploying before control starts.
- **The rover:** a commercial-looking, MoonDAO-branded small rover in the same build-from-primitives, PBR-material style as the lander: foil, white thermal panels, solar panel, mast camera, wheels with grousers, MoonDAO mark. Don't use `public/moonbase/models/perseverance-rover.glb`. It's a NASA Mars rover, and the game is about commercial lunar rovers.
- **Ground and lighting:** reuse Touchdown's regolith textures and environment approach (`regolithTextures`, `makeEnvMap`, and `lib/lunar-atlas/regolithShader.ts` if useful).
  - Low sun, a different angle each day, with long hard shadows. Reading rocks by their shadows is part of the skill.
  - Earth in the sky (`public/touchdown/earth-*.png/jpg`) and stars.
  - Real-looking craters with rims and scattered ejecta.
  - Soft regolith patches: subtly darker and smoother, readable to an attentive player but not obvious.
  - Proper rocks, not dodecahedrons.
- **Wheel tracks:** visible, crisp ruts in the regolith that persist and read clearly from orbit. They're the heart of the game's identity.
- **Performance:** must hold a good frame rate on mid-range phones. Adapt resolution the way Catch does.

## The game

### Fiction
You drive a commercial rover for the First Tracks prize. Commands take time to reach the Moon and pictures take time to come back, so you are always steering where the rover was. Leave the lander, lay your first 10 m of tracks, image as many science targets as you can before the comms window closes, then an orbiter passes overhead and photographs your tracks. That photo is the independent verification the real prize requires.

### Core mechanic: signal delay
Inputs are queued and applied after an **uplink delay**. The camera shows the rover's state from a **downlink delay** ago.
- **Easy:** 0.5 s each way, plus a translucent ghost rover showing where the rover will be when the current command lands.
- **Pro:** the real ~1.3 s each way, no ghost, a lower sun, and score ×1.25.

The HUD shows the age of the picture and the commands in flight between Earth and Moon (in the prototype, dots travelling along a wire). Make this visualisation good: it's how players understand the core mechanic.

### Getting off the lander
- The rover starts parked **sideways across the deck**, at a different angle each day, so the first job is turning to line up with the ramp through the delay.
- Driving off the side of the deck or the ramp tips the rover. The run ends.
- **The camera is a fixed overhead view** while on the lander, with the ramp pointing up the screen. Once the rover is fully off, it eases round to a chase camera over the rover's shoulder.
- **The clock does not start until the rover is fully off the lander.** There's no time pressure on the egress, only the risk of falling.
- "Fully off" means all four wheels on the regolith, matching the prize definition. The **10 m count starts there** too.

### Driving hazards
- **Rocks:** ones taller than the wheels' clearance (about 0.2 m) stop the rover dead; smaller ones you drive over.
- **Slopes:** cross-slope roll beyond about 25°, or pitch beyond about 33°, tips the rover. Crater walls taken sideways are the usual killer.
- **Soft ground:**
  - It slows the rover, and the wheels sink over time.
  - Sinking is faster when turning, and much faster when spinning against an obstacle.
  - Reversing digs you out.
  - Full sinkage means stuck, which ends the run.
- **Driving model:** skid steering, so the rover can turn on the spot (expensive on battery, see below), with a top speed of about 1 m/s.

### Targets and the clock
- **8 science targets** per day, placed as a web: each 9–15 m from another, so choosing the order is a puzzle.
- They show as beacons in the world and on a heading-up minimap. The minimap shows craters but **not** rocks; that's realistic, since orbital maps can't resolve them.
- **To image a target, stop inside its ring and hold still for 1 s.**
- **The clock:**
  - Each imaged target adds time.
  - Easy starts at 45 s with +12 s per target; Pro starts at 90 s with +15 s.
  - The run ends when the clock runs out or the battery is flat, or immediately once all 8 are imaged.
  - Starting points: tune with the bot. In testing, a perfect-information smooth driver clears all 8 on Easy. A cautious drive-wait-look driver gets about 4 of 8 on Easy and about 6 of 8 on Pro.

### Battery
The rover has a battery shown in the HUD. It drains from:
- avionics, every second, even standing still
- each metre driven, three times as much in soft ground
- height climbed
- turning, at about 1.6/s turning on the spot versus 0.3/s turning while rolling
- every start from a stop, in proportion to the speed gained
- spinning the wheels against a rock or in soft ground

An empty battery ends the run, but a reasonable run uses only about half of it. The battery is mostly a scoring measure: it rewards smooth, continuous driving, which the delay makes hard.

### Scoring: hard to max, sliding scales everywhere
Design intent from the product owner: **it should be hard to get a perfect score.** No category should pay full points for simply doing the thing. Every figure is a sliding scale that falls fastest close to perfect (no "good enough" band), like Catch's scoring.

| Figure | Points | How it's judged |
|---|---|---|
| Targets | 400 (50 each) | 15 for imaging + 35 for how close to the ring's centre the rover stopped |
| Route | 300 (split over all 8 legs) | Metres driven on each leg against that leg's **par route**; 30% over par scores nothing |
| Battery | 300 (split over all 8 legs) | Energy used on each leg against a perfect driver's energy on par; double scores nothing |
| Time left | 2 per second | Only if all 8 targets are imaged |

- **Curves:** the prototype uses `1 − (excess/limit)^p`, with p = 0.5 for route and battery and p = 0.75 for centring.
- **Legs never driven** earn no route or battery points.
- **Multipliers:** condition (still rolling ×1, battery flat ×0.8, stuck ×0.6, tipped ×0.25, fell off the lander ×0.1), then Pro ×1.25.
- **Milestones aren't points.** Leaving the lander and the first 10 m are gates and badges ("First tracks: 78 m", a 10 m marker on the orbiter photo).
- **Par route:** the shortest safe path for a leg, from where the leg started (the ramp foot or the previous target) to the target's centre. It avoids rocks taller than the wheels (inflated by the rover's radius), the lander, and slopes steep enough to tip on. The prototype computes it with grid A* plus string-pulling when the run ends.
- **Par energy:** that route driven perfectly: one start, rolling turns only, one stop to image.
- **Never show par to the player.** No par line on the orbiter image, no "% of par". The product owner wants players to know they *can* improve without being handed the answer. The result screen gives each figure a one-word grade (*Near perfect / Tidy / Room to improve / Wasteful*) next to its points.
- **Test drivers** scored about 620–630 out of ~1,030, with no figure maxed. Keep that kind of spread.

### End of run: the orbiter pass
When the run ends, show a top-down "orbiter photo" of the site:
- greyscale, high contrast, slight grain, in the style of an LRO image
- the lander, your tracks, the 10 m point and the targets you imaged labelled
- a scale bar

It's both the result screen's hero image and the basis of the share card. The prototype renders it to a render target and post-processes it on a 2D canvas. Make it look like a real orbital image.

### Result screen, share card, leaderboard
Match Touchdown and Catch:
- **Result screen:** score, verdict, the per-figure breakdown with grades, best today, Drive again, and switch mode.
- **Share card (1200×675):** the orbiter photo, score, verdict, mission number, mode, and the URL printed on it.
- **Challenge links** that replay the same mission.
- **OG image route.**
- **Daily leaderboard per mode** with server replay.
- **The real-race panel** for `shared-first-tracks`, with live odds when the market is live and the atlas forecast otherwise.
- **Verdicts:** a set per outcome (fell off the lander, tipped, stuck, battery flat, short of 10 m, finished, great run). Safe real facts are fine, for example Spirit getting stuck in sand on Mars.

### Controls
- **Keyboard:** W/S or ↑/↓ for forward and reverse, A/D or ←/→ to steer.
- **Phone:** on-screen buttons in the prototype. Something better (a stick or drag control) is your call.
- **Input recording:** whatever input scheme you choose must record cleanly for server replay.

## Your call (judgement areas)

- Route name and page structure. `/first-tracks` seems natural, plus wherever it surfaces from the DePrize and Moon Base pages.
- Exact visual design of the lander deck and ramp and the rover, within "MoonDAO-branded, photoreal, commercial".
- Camera details, HUD layout and the in-flight command visualisation.
- Whether to animate ramp deployment, add sound, add a short tutorial beat, or show a mid-run hint system.
- Fine-tuning every number above, using the bot.
- How to make par computation cheap and deterministic enough to run in the leaderboard replay.
- Code organisation, and anything that can be shared with Touchdown and Catch (for example extracting common mission, share or leaderboard pieces) rather than copied.
- Anything in the prototype that turns out to be wrong in practice: fix it, and say what you changed and why.

## Done looks like

- A production First Tracks page at the quality of Touchdown and Catch, on desktop and phone.
- Daily seeded sites, Easy and Pro, the full scoring above, a server-verified daily leaderboard, share card, OG image, challenge links, real-race panel and analytics events.
- A headless bot script with a `package.json` entry, used to check tuning.
- Tests in the style the repo already uses for the pure logic (scoring, par, determinism).
- A short note of the judgement calls you made.
