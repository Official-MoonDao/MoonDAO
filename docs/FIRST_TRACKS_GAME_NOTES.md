# Lunar Rover: First Tracks. Build notes and judgement calls

The game is called **Lunar Rover: First Tracks** and lives at `/rover` (`/first-tracks` redirects there). Code folders and API paths keep the working name `first-tracks`.

Companion to [`FIRST_TRACKS_GAME_BRIEF.md`](FIRST_TRACKS_GAME_BRIEF.md). What was built, what was changed from the brief or the prototype and why, and what has not been checked. The second half of the changes came from the owner's first play-through.

## Where things are

| Piece | Where |
|---|---|
| Page | `ui/pages/rover.tsx` (chromeless, like `/touchdown` and `/starship`); redirect in `ui/next.config.js` |
| Game shell | `ui/components/first-tracks/FirstTracksGame.tsx` |
| Engine, models, HUD canvases, sound | `ui/components/first-tracks/engine.ts`, `models.ts`, `hud2d.ts`, `audio.ts` |
| Raw daily site | `ui/lib/first-tracks/site.ts` |
| The day's site as played (fairness pass, par time) | `ui/lib/first-tracks/day.ts` |
| Sim (signal delay, hazards, battery) | `ui/lib/first-tracks/sim.ts` |
| Par route and par energy | `ui/lib/first-tracks/par.ts` |
| Scoring, verdicts, modes | `ui/lib/first-tracks/scoring.ts`, `verdicts.ts`, `modes.ts` |
| Tape and server replay | `ui/lib/first-tracks/replay.ts` |
| Leaderboard | `ui/lib/first-tracks/leaderboard.ts`, `leaderboardStore.ts`, `ui/pages/api/first-tracks/leaderboard.ts` (Redis prefix `firsttracks:lb`) |
| Share card, challenge links | `ui/lib/first-tracks/share.ts` |
| Link preview | `ui/pages/api/og/first-tracks.tsx`, `ui/public/first-tracks/og.jpg`, `og-base.jpg`, built by `ui/scripts/first-tracks-og.ts` |
| Real-race panel | `ui/components/first-tracks/FirstTracksRacePanel.tsx`, `FirstTracksRaceView.tsx` (goal `shared-first-tracks`) |
| Entry points | `FirstTracksTeaser.tsx`, shown on the First Tracks prize page and the Moon Base goal panel |
| Bot | `ui/lib/first-tracks/autopilot.ts`, `ui/scripts/first-tracks-bot.ts` (`yarn first-tracks:bot`) |
| Tests | `ui/cypress/integration/lib/deprize/first-tracks.mocha.ts` (runs under `yarn test:deprize`) |
| Analytics | `trackFirstTracks` in `ui/lib/analytics/ga4.ts` |

Shared with Touchdown and Catch unchanged, by import: the mission epoch and seed, the deterministic trig, tape base64, name cleaning, the Redis client and live-board rule, challenge-link parsing, clipboard and share plumbing, the environment map and the regolith textures. Nothing in Touchdown's or Catch's files was edited.

## What changes each day

The site itself: the craters, the rocks (boulders that stop the rover, smaller rocks it climbs over, belts of boulders across the routes), the soft-regolith patches, where the eight science jobs are and which kind each is. The sun's height and side, the rover's parked heading and the length of the clock also change. All of it derives from the mission number, so a challenge link replays the same site.

## The science jobs

Each target is a job, and the job is why the rover has to stop and hold still:

| Job | A day has | Where | Hold | Points | Clock back |
|---|---|---|---|---|---|
| Regolith image | 3 | open ground | 1 s | 25 | +10 s |
| Boulder spectrum | 2 | a ring right beside a big boulder | 1.5 s | 50 | +14 s |
| Ice core | 3 | the floor of a crater | 2.5 s | 75 | +20 s |

Points add to the brief's 400 for targets; 30% of each is for doing the job and 70% for how near the ring's centre the rover stopped. Ice craters are deep enough that the wall tips a rover crossing it sideways, so they have to be driven straight in and straight out, slowly. Beacons, the minimap and the tags over each beacon are coloured by job.

## Changed from the brief, with the evidence

1. **The clock is sized from the day's site.** `day.ts` works out how long the day's short tour takes along par at the speeds the ground allows (`site.parSeconds`). The whole comms window, bonuses included, is 1.25 times that on Easy and 1.35 times on Pro; the clock shown at the start is that less the bonuses. A fixed clock sized for the hardest site left 40 to 70 seconds spare on an ordinary one, which is what the owner hit on the first play-through. The factors were then tightened after a second play-through finished all 8 on Easy with 31 s spare.
2. **Targets are worth different amounts** (above), not 50 each, so which jobs to go for and in what order is a real choice. An ice core pays back twice the clock of an image, so taking the craters early buys time for the rest.
3. **Boulder belts.** A ragged line of boulders is laid across most legs of the day's short tour. Some gaps can be threaded; the ends can be driven round. The first build's sites could be driven in straight lines.
4. **A fairness pass.** Scattered rocks plus a belt sometimes walled a target in, so that the only route with room to spare was an 80 m loop where par was 24 m. `day.ts` checks each leg of the short tour with a wide-berth route and, where that is more than 1.45 times the straight line, clears the loose rocks from the straight line.
5. **Small rocks are felt.** Rocks between 7 cm and the 20 cm wheel clearance lift whichever wheel rides over them (so the rover pitches and rolls), slow it by up to 60%, cost battery, and knock the camera. There are about 900 a site.
6. **A cap on how far the targets sprawl.** A site whose shortest straight-line tour is over 96 m is redrawn.
7. **Battery is 450 units,** up from the prototype's 420, because detours, crater climbs and rocks cost more. The perfect driver finishes with about 43% left; the careful stop-start driver sometimes runs flat.
8. **The sun stays ahead of the lander, 30 to 90 degrees to either side of the ramp,** so the lander's shadow never falls on the tray or ramp and the ramp's surface is lit.
9. **A three-minute limit on the lander.** The clock still does not run during egress, but a recorded tape needs a maximum length for the server to replay it.
10. **Determinism.** The site, sim, par and scoring use only `+ - * /`, `Math.sqrt` and Touchdown's deterministic trig. Where the prototype used `exp` or fractional powers the shape was replaced with a polynomial or square-root equivalent. Tip limits are compared as tangents.
11. **Inputs are recorded as given on Earth,** as whole numbers -127..127 per 60 Hz step; the sim applies the uplink delay itself.
12. **Tracks are laid behind all four wheels,** so a pivot turn leaves the arcs a skid-steer rover really leaves.

## The lander

The brief said to use Touchdown's `buildLander` with a deck and ramp added. The owner's steer after seeing that: the platform must come out of the lander itself, and be in proportion to it. Touchdown's hull is one closed shape and cannot be opened, so First Tracks builds its own lander in `models.ts` in the same design and materials (eight-sided foil descent stage, corner tanks and legs, white upper deck, dish, MoonDAO mark), about 1.4 times the size so a rover fits inside it. Its front face is a cargo bay: two doors swung back against the hull, a lined bay behind them, the rover's tray run out of the bay on telescoping rails, and the ramp unfolded from the tray's edge. The tray is 1.6 m by 1.7 m, the width of the bay and of the ramp. Touchdown's model is untouched.

## Other calls

- **Rover:** built from primitives in the lander's materials, MoonDAO mark on both flanks. No Perseverance model.
- **Moon Base Zero** stands on the horizon 600 m from the lander, a little to one side of Earth, with a floating label, as in Touchdown. It is Touchdown's own town model (`buildMoonBase`), imported unchanged.
- **Beyond the play area** the plain carries about 200 more craters and 1,300 boulders out to a few hundred metres, with long shadows, so it is not bare. None of it is in the sim.
- **Camera:** drag to look round, scroll or pinch to zoom, double-click to reset, as in the other games. On a phone the lower half of the screen is the drive stick and the upper half is the camera. On the lander the view stays overhead (zoom still works).
- **Result screen:** the camera pulls back over the whole drive with the horizon, Earth and the base beyond, and the traverse is drawn as a bright line over the tracks. **Take a photo** (button, or P) captures the scene as the player has framed it, copies it to the clipboard and makes it the share image, as in Touchdown and Catch. The breakdown shows points only: the one-word grades the brief asked for were removed at the owner's request.
- **Share card:** the picture, full bleed, with only the game's name, how the drive ended, the score and the URL (plus the player's name and rank once saved).
- **Start screen:** one sentence, the mode toggle and one button. The jobs explain themselves in play, through the tags over the beacons and the hint when the rover reaches one.
- **The orbiter's top-down photo** is kept as the "independent check" and opens from a small link on the result screen.
- **Shadows:** hard-edged shadow map round the rover with almost no bias (at this sun angle any bias leaves a lit gap between a rock and its shadow), plus stretched decals for rocks beyond it.
- **Signal link:** a canvas instrument. Commands travel Earth to Moon as arrows; the picture streams back along the lower lane.
- **Minimap:** heading-up, craters but no rocks, jobs coloured by kind and pinned to the rim when out of range.
- **Challenge links** (`?m=&s=&n=&p=`) load that day's site. Only today's site (or yesterday's, across midnight UTC) can be saved to the board.
- **Par is never shown.**
- **US English** in all player-facing copy.

## Bot results (60 sites)

| Driver | Easy mean | Easy jobs | Easy cleared | Pro mean | Pro jobs | Pro cleared |
|---|---|---|---|---|---|---|
| perfect | 701 | 7.7 | 50 | 908 | 7.8 | 56 |
| average | 446 | 5.3 | 4 | 551 | 5.4 | 3 |
| careful | 274 | 3.6 | 0 | 314 | 3.5 | 0 |
| sloppy | 172 | 2.1 | 0 | 121 | 1.8 | 0 |

No figure is maxed by any driver. Every recorded tape replayed to the same score. `--strict` passes when the perfect driver clears at least 7 sites in 10, every site has its full set of jobs and every replay matches. The perfect driver takes the jobs in shortest-distance order and does not plan round the clock, which is why it misses about one Easy site in six that a player who takes the craters first could clear.

## Open questions for the owner

- **A run that finishes no job scores 0,** even if it laid its first 10 m, because the brief says milestones are not points. The Touchdown playbook says every survivable outcome should earn something.
- **Difficulty is set by bots and two play-throughs by the owner.** The clock factors (1.25 and 1.35) mean a flawless driver clears most Easy sites and an ordinary one about five jobs of eight. Whether that feels right is a question for more people playing it.

## Not verified

Say so until someone has checked:

- Sound, by ear.
- A real phone: frame rate, the touch stick under a thumb, pinch zoom, the share sheet. Phone layout was only checked in an emulated 390x844 viewport, and the 60 fps reading is from a laptop's integrated GPU in headless Chromium.
- Saving a score to the board. The API was shown to re-drive a real tape and to reject a truncated one, but no score was written.
- Clipboard copy and the X composer.
- Replay agreement on Safari and Firefox.
- The link preview on Vercel and how X and Slack render it.
- How the rebalanced game feels to a person. Since the rebalance only bots and scripted input have driven it.
