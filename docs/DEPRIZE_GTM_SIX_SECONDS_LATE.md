# Go-to-Market — "Six Seconds Late" DePrize

**Status:** Draft for discussion
**Prize:** P9 in [`DEPRIZE_FIRST_PRIZE_CANDIDATES.md`](./DEPRIZE_FIRST_PRIZE_CANDIDATES.md)
**Shape:** 8-month arc, operator competition, weekly heats and a live final
**Companion plan:** [`DEPRIZE_GTM_SURVIVE_THE_NIGHT.md`](./DEPRIZE_GTM_SURVIVE_THE_NIGHT.md)
**Last updated:** 2026-08-18

---

## 1. Executive summary

This prize is shaped like a sport, so market it like one: a public ladder, weekly heats with a clock, a season that ends in one broadcast final, and a way for a spectator to feel the difficulty in sixty seconds without owning any hardware.

The core asset is **Moon Mode** — a free, open, always-on relay that imposes lunar comms conditions (6 s round-trip latency, 5 fps 320p video, 10% packet loss) on anything you point at it. Anyone with a robot can plug into it today. Anyone with a browser can try a sixty-second version of the same task and get a time. That relay is simultaneously the competition's referee, its top-of-funnel, and a permanent public good the community keeps afterwards.

Because MoonDAO supplies identical hardware and the arena, entry costs a team essentially nothing. The competition is purely control software and operator technique, which means the roster can be deep, remote, and international — and the odds are about skill rather than budget, which makes for a better market.

**There is a timing forcing function.** The [European Rover Challenge](https://roverchallenge.eu/) runs **4–6 September 2026 in Kraków** with 124 registered teams from 29 countries, and the [URC](https://urc.marssociety.org/home/team-info) rules drop in September with registration closing in late October — the annual window in which rover teams form and choose what they are doing this year. That window is **seventeen days away**. Recruitment should start inside it or slip a full year.

**The one-liner:** *Everything on the Moon happens six seconds after you decide to do it. Come find out how hard that is.*

---

## 2. Objectives and success metrics

| Metric | Must-hit | Target | Stretch |
|---|---|---|---|
| Named competitors at market open | 3 | 5 | 8 + `OPEN_FIELD` |
| Browser demo completions | 750 | 3,000 | 15,000 |
| Robots connected to the public relay | 10 | 40 | 150 |
| Qualifier heats run | 12 | 30 | 60 |
| Unique bettors | 100 | 400 | 1,200 |
| Prize pool at settlement | $7,500 | $15,000 | $40,000 |
| Finals peak concurrent viewers | 250 | 1,000 | 5,000 |
| Finals VOD views | 5,000 | 25,000 | 100,000 |
| Control stacks open-sourced at settlement | 3 | all entrants | all + a reusable baseline |

Pool math is the same as the companion plan: **$50 to the pool per $1,000 of primary betting, $10 per $1,000 of secondary trading**, plus direct contributions one-for-one. A $15,000 settlement means roughly $150k primary and $250k secondary, or a smaller market plus direct funding. State the implied volume whenever quoting a pool target.

**The metric that actually matters:** whether the winning team's control stack — the interface, the predictive display, the move-and-wait discipline — is good enough that a lunar surface operator would want it. Published research puts the penalty for going from 0.3 s to 2.6 s of delay at a **150% increase in task time**. If a team publishes a stack that measurably beats naive teleoperation at 6 s, the prize did its job regardless of viewership.

---

## 3. Sequencing: a funnel, not a launch

Unlike a hardware prize, this one has a genuine top-of-funnel, because trying it is nearly free. Design the whole campaign as a funnel and instrument each step.

```
Browser demo  ──►  Relay signup  ──►  Intent to compete  ──►  Named roster  ──►  Market
 (anyone,          (anyone with       (serious teams)         (3–8 teams)       opens
  60 seconds)       a robot)
      │                                                                            ▲
      └──────────────── spectators who never build anything ──── bet ──────────────┘
```

The browser demo does double duty: it recruits builders and it converts spectators. Someone who has personally flailed through a six-second delay understands in a visceral way why a team that does it in ninety seconds is impressive — and that understanding is what makes them want a position. **Feeling the delay is the pitch.** No explainer video will do the same work.

The roster still locks at market open (`DePrizeRegistry.teamIds`), so naming precedes betting exactly as in the companion plan. The difference is that here the recruitment funnel is public and measurable from week one, which means we will know by October whether this is working.

---

## 4. Positioning

**Category:** the space industry's first spectator sport with a real engineering payload — closer to a robotics league than to a hackathon.

**Message hierarchy**

1. **The delay is the whole job.** Round-trip to the lunar farside via an L2 relay is ~2.6 seconds at the speed of light, worse with processing and relay hops. Every hour of surface work is spent waiting for the world to catch up.
2. **It is a software problem, so an outsider can win.** Same robot, same arena, same task for everyone. What differs is the interface, the prediction, and the operator's nerve.
3. **You can try it right now.** Sixty seconds, in a browser, no signup.
4. **Everything gets published.** Winning control stacks are open-sourced at settlement.

**Objections, and the answers**

| "..." | Answer |
|---|---|
| "It's a video game." | It is the identical constraint that governs how much work gets done on the lunar surface per day, and the measured penalty is a 150% increase in task time. The task is servicing hardware in regolith, not shooting anything. |
| "We're busy with URC/Lunabotics." | Finals are in March, before the May competition crunch. Entry costs nothing, we supply the robot, and you can compete from your own lab. |
| "The team with the best robot wins." | Nobody brings a robot. We supply identical hardware and you get equal practice time on the public relay. |
| "How do you stop someone controlling it locally?" | Every command passes through our relay and is logged; the arena is camera-monitored and operators are verifiably remote. The logs are part of the evidence bundle. |

**Language discipline** is unchanged: *prize, purse, back a team, fund the prize* — never *invest* or *returns*, never imply bettors are paid out of the prize pool.

---

## 5. Audience map

### 5.1 Competitors

| Segment | Why they say yes | Where and when |
|---|---|---|
| **ERC teams** (124 registered, 29 countries) | Already in Kraków in September, already have operators trained on limited-visibility ops | ERC 2026, 4–6 Sept, in person or via team Discords and the teams directory |
| **URC teams** (116 teams, 18 countries in 2026) | Rules drop in September, registration closes late October — the annual moment teams pick side projects | URC-Announce list, team Discords, the Mars Society channels |
| **Lunabotics teams** (40–50 per year) | Autonomy and teleop are already scored in their competition | Team advisors, the 2027 cycle kickoff |
| **Robotics labs and telerobotics researchers** | A public benchmark with real data they can publish against | IEEE robotics communities, lab mailing lists, conference hallway tracks |
| **Sim racing / esports / drone FPV crossover** | Latency compensation is literally their craft | FPV and sim-racing communities, Twitch, Discord servers |
| **MoonDAO citizens** | House team | Discord, town halls |

The last segment is the sleeper. Competitive FPV pilots and sim racers have spent years building intuition for control under lag, and a mixed team of one roboticist and one FPV pilot is a genuinely plausible winner. That story — *gamers beat the rover engineers* — is also excellent for the market, because it creates two camps to bet between.

### 5.2 Spectators and bettors

| Segment | Hook | Channel |
|---|---|---|
| Anyone who tried the demo | "You took four minutes. They do it in ninety seconds. Back one." | On-page conversion after the demo result |
| MoonDAO community | First DePrize, live heats | Discord, ConvertKit newsletter, `@OfficialMoonDAO` |
| Prediction-market natives | Weekly resolving events with real skill signal — closer to sports betting than to politics | r/PredictionMarkets, crypto X, Polymarket/Kalshi communities |
| Robotics and space YouTube | Heat footage is inherently funny and tense | Creator collaborations, clip licensing, r/robotics, r/space |
| Press | "The space industry's first esport" | Hackaday, IEEE Spectrum, Ars Technica, The Verge, SpaceNews |

---

## 6. Phase plan

Dates assume a start of 2026-08-19. This plan is deliberately front-loaded because of the September recruiting window.

### Sprint 0 — Catch the window (Aug 19 – Sep 3, 2026) · 16 days

Minimum viable launch: rules v0.9 published as a draft explicitly open to feedback, a landing page, an intent-to-compete form, and an announcement thread. Do **not** wait for the relay to be finished — announce it as coming and recruit on the promise. Secure a MoonDAO presence at ERC (an attendee, a sponsored student, or at minimum coordinated outreach into team Discords during the event).

**Gate:** page live and outreach sent before September 4.

### Phase 1 — Recruit at ERC and through the URC window (Sep 4 – Oct 31, 2026)

ERC in Kraków, then the URC rules-drop window, then Lunabotics team formation. Run a Discord AMA in the week after ERC while the community is still talking to itself. Target 25 intents to land 5 named teams.

Ship **Moon Mode v1** in this phase — the relay plus the browser demo. Once it exists, the recruiting pitch stops being a description and becomes a link.

**Gate:** ≥3 teams committed to public naming; relay live with ≥10 robots connected.

### Phase 2 — Naming and pre-launch (Nov 2026)

Name the roster publicly, 30 days before open. One team profile per week. Freeze the rules — including the rerun policy for hardware faults, which is the most likely source of a post-hoc dispute and must be settled before any money is on it. Register the DePrize, provision CTF + LMSR, seed liquidity.

**Gate:** roster public 30 days, rules immutable, contracts rehearsed on testnet.

### Phase 3 — Market open (Dec 2026)

Betting opens with an exhibition heat: MoonDAO staff and a guest attempt the task badly and publicly. Establishing the baseline of "this is hard" is what makes the qualifier times legible.

### Phase 4 — Qualifier ladder (Jan – Feb 2027)

Weekly heats on a fixed night. Each team runs the standard task; times post to a public leaderboard; odds move every week. Randomise the fault injected each week (dusty connector, seized panel, misaligned module) from a published pool so teams cannot pre-script.

This is the structural advantage over the companion plan: instead of five quiet months, there is a resolving event **every week**, each one a reason to check the odds page.

### Phase 5 — Finals (Mar 2027)

One broadcast. Best-of-three heats under full lunar conditions including the unannounced 10-minute blackout. Two commentators — one roboticist, one who has never touched a robot — because the second one asks the questions the audience has. Live odds on screen.

Deliberately scheduled **before** the May URC/Lunabotics crunch so it competes with nothing.

### Phase 6 — Settlement and release (Apr 2027)

Judges sign the verdict from relay logs and stopwatch times; the Senate ratifies; `releaseM1` / `completeM2` fire. All teams publish their control stacks. Release the full telemetry corpus — every command, every frame timestamp, every task time across every heat — as an open dataset. That corpus is a genuinely useful research artifact and it is the thing that gets this cited rather than merely watched.

**Sunset:** 12 months from open (Dec 2027), leaving room for a second season inside the term.

---

## 7. The two growth mechanics

Everything else in this plan is conventional. These two are not, and they are where the effort should go.

### 7.1 Moon Mode — the public relay

A small containerised service (deployed the way `dispatcher/` is) that accepts a control stream and a video stream and degrades both to lunar conditions: 6 s round-trip, 5 fps, 320p, 10% loss, with a scheduled-blackout mode. Open source, free, no account required, permanently available.

Why it carries the campaign:

- **It is the referee.** Competition runs and casual runs use the same code path, so the official conditions are self-evidently fair and independently auditable.
- **It is the lead magnet.** "Point your robot at this and see what happens" is a far better ask than "enter our competition." Robotics people cannot resist trying it.
- **It is a public good that outlasts the prize.** Any lab can benchmark against it afterwards, and every one of them is a citation.
- **It costs almost nothing.** A few hundred lines of proxy code and a container.

### 7.2 The sixty-second browser demo

A single page. Drive a simple simulated servicing task under the same 6 s delay, 5 fps feed. Get a time. See the current leaderboard. Share the result. Then, immediately: *"The teams do this on real hardware. Back one."*

This is the conversion engine for everyone who will never build a robot, and it is the reason this prize can reach an audience an order of magnitude larger than a hardware prize can. Instrument it end to end — demo completion → share → market page → first bet — and optimise that funnel weekly, because it is the only part of either plan that behaves like a normal growth problem.

---

## 8. Product dependencies

| Need | Status | Work |
|---|---|---|
| Prize + market page | `pages/deprize/[id].tsx`, `DePrizeIndexContent`, `DePrizeTeamCard` exist | Content |
| Waitlist before open | `DePrizeComingSoon.tsx` + `lib/convert-kit/useSubscribe` exist | Wire up |
| **Moon Mode relay** | — | New service; container deploy, same pattern as `dispatcher/` |
| **Browser demo** | — | New page in `ui/pages/`; the highest-leverage build in this plan |
| **Public leaderboard** | — | New page; heat times, team standings, next heat countdown |
| Odds narrative | `OddsHistoryChart.tsx` exists | Annotate with heat markers so the chart tells the season's story |
| Atlas shared goal | `lib/lunar-atlas/seed/atlas.dataset.json` carries goals with frozen `criteria` + `market` stubs | Add a `teleop-latency` goal, `category: 'comms_pnt'`, anchored at the farside/relay context, `market.status: 'planned' → 'live'` |
| Heat notifications | `lib/discord/sendDiscordMessage`, `lib/notifications` exist | Post heat start, results, standings changes |
| Direct "fund the prize" | Juicebox path exists | Contribute button, visually distinct from betting |

---

## 9. Budget

The tension in this prize is that MoonDAO supplies the hardware, so there is real capex against a $5,000 purse. The lean column keeps total outlay near the prize itself.

| Line | Lean | Full |
|---|---|---|
| Prize seed | $5,000 | $5,000 |
| Robot (one shared unit, or borrowed from a partner lab) | $900 | $2,400 (two units + spares) |
| Arena | $250 (bulk basalt/quarry sand at a partner's existing bin) | $1,200 (dedicated build) |
| Regolith simulant where fidelity matters | $250 (~5 kg LHS-1 at $45/kg, for the dusty-connector element only) | $600 |
| Relay + demo development | in house | $3,000 |
| Streaming and production | $400 | $2,500 |
| Judge honoraria | $300 | $900 |
| ERC recruitment presence | $0 (remote outreach) | $1,500 (travel) |
| **Cash outlay beyond the prize** | **~$2,100** | **~$12,100** |

One cost note worth flagging: **do not fill an arena with real simulant.** LHS-1 runs $45/kg retail and about $29,250 per tonne in bulk. Use terrestrial basalt or quarry sand for the bulk terrain and reserve genuine simulant for the specific interfaces where its abrasiveness and clinginess actually change the task.

---

## 10. Risks and kill criteria

| Risk | Trigger | Response |
|---|---|---|
| **Missing the September window** | Landing page not live by Sep 3, 2026 | Recruitment gets an order of magnitude harder; either accept a smaller roster from labs and the FPV community or slip the season by a year |
| Fewer than 3 named teams | Oct 31, 2026 | Extend 30 days once; then run it as an exhibition season with no market and use it to build the roster for season 2 |
| One team dominates, odds go flat | Two consecutive heats with the same winner by a wide margin | Rotate the fault pool, add a second scored task, and lean the narrative into the underdog — a dominant favourite is a market problem, not a competition problem |
| Hardware failure mid-heat | Any | Spare robot, published reset procedure, and a **rerun policy frozen before the first bet**. This is the likeliest dispute in the whole plan |
| Cheating (local control, pre-recorded runs) | Any | All commands traverse the relay and are logged; arena is camera-monitored; operator isolation is verified; logs go into the evidence bundle |
| "It's just a game" framing takes hold | Press cycle | Lead every piece with the 150% task-time finding and the servicing task, never with the leaderboard |
| Nobody wins outright (all fail the blackout) | Finals | **Supersede into season 2 rather than settling no-winner** — `NO_WINNER` is a refundable terminal that returns the pool. Registry generations ([`DEPRIZE_ROSTER_CHANGES.md`](./DEPRIZE_ROSTER_CHANGES.md) §O5) are a launch dependency |
| A walk-in wins | Any | Ship the `OPEN_FIELD` slot before open, or state in the rules that only the named roster can win |

---

## 11. Why this is the safer first outing

Set against the companion plan, this one trades depth of capability for reliability of execution, and for a first DePrize that trade is probably correct:

- **No single point of failure.** "Survive the Night" dies without a chamber. This needs a robot, a sandbox, and a proxy server.
- **The roster already exists and is assembling right now.** 240+ rover teams registered across URC and ERC this year, in the exact weeks they choose their projects.
- **Entry costs a competitor nothing**, so the conversion from interest to commitment is far higher.
- **Something resolves every week**, so the market has a pulse for the whole season instead of one climax.
- **It has a top-of-funnel a hardware prize cannot have.** Anybody can try it in a browser in sixty seconds.

What it gives up is substance: it advances operations and software rather than putting new hardware into the world. That is a real cost, and it is the argument for running "Survive the Night" as the flagship the moment a chamber is secured — ideally with this season as the warm-up that proves the mechanism, builds the audience, and gets the Senate its first clean resolution before a harder prize depends on it.
