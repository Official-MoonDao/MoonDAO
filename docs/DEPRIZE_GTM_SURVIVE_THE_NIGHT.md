# Go-to-Market — "Survive the Night" DePrize

**Status:** Draft for discussion
**Prize:** P1 in [`DEPRIZE_FIRST_PRIZE_CANDIDATES.md`](./DEPRIZE_FIRST_PRIZE_CANDIDATES.md)
**Shape:** 12-month arc, hardware competition, one climactic 354-hour event
**Companion plan:** [`DEPRIZE_GTM_SIX_SECONDS_LATE.md`](./DEPRIZE_GTM_SIX_SECONDS_LATE.md)
**Outreach list:** [`deprize-survive-the-night-outreach.csv`](./deprize-survive-the-night-outreach.csv) — 60 named groups, ranked
**National-contract performers:** [`DEPRIZE_LUNAR_NIGHT_CONTRACT_PERFORMERS.md`](./DEPRIZE_LUNAR_NIGHT_CONTRACT_PERFORMERS.md) — who NASA/DARPA/ESA/etc. are already paying
**Risk register:** [`DEPRIZE_SURVIVE_THE_NIGHT_RISKS.md`](./DEPRIZE_SURVIVE_THE_NIGHT_RISKS.md)
**Last updated:** 2026-08-19

---

## 1. Executive summary

We are selling two things to two different crowds at the same time, and one has to come first.

To **competitors** we are selling free thermal-vacuum chamber time, a public credential, and a purse that starts at $5,000 and grows while they build. To **bettors** we are selling a legible, dated, dramatic question — *will a payload built by a small team beacon at dawn?* — with real money on it. The roster must be locked before the market opens, so competitor recruitment is the critical path and everything else queues behind it.

The campaign's centerpiece is a scheduling decision that costs nothing and changes everything: **we run the 354-hour soak in lockstep with an actual lunar night at the Artemis south-pole site.** The chamber goes dark at the minute the sun sets at those coordinates and the payloads must wake within an hour of real lunar sunrise. For fifteen days the Lunar Atlas shows the terminator crawling across the Moon next to live chamber telemetry and live odds. That turns a slow endurance test into a fifteen-day ambient broadcast — the slowest sporting event ever staged, and one that no other prize program can copy without our globe.

**The one-liner:** *Landers die at sunset. We're paying $5,000 to the first small team whose hardware wakes up at dawn.*

---

## 2. Objectives and success metrics

Three tiers. Must-hit is the bar below which we should not have run the prize; stretch is what a hit looks like.

| Metric | Must-hit | Target | Stretch |
|---|---|---|---|
| Named competitors at market open | 3 | 4–5 | 6 + an `OPEN_FIELD` walk-in |
| Teams that complete the M1 qualifying soak | 2 | 3 | 5 |
| Teams that attempt the full run | 1 | 3 | 5 |
| **A winner is declared** | — | ✅ | ✅ in generation 1 |
| Unique bettors | 60 | 150 | 500 |
| Prize pool at settlement | $7,500 | $15,000 | $40,000 |
| Waitlist emails captured | 250 | 800 | 2,500 |
| Tier-1 press hits | 1 | 3 | 6 + a broadcast segment |
| Peak concurrent viewers, dawn stream | 100 | 500 | 2,000 |
| Open-sourced payload designs published | 1 | 3 | all entrants |

**On the pool target, honestly.** The pool grows by **$50 per $1,000 of primary betting** (the 5% slice) and **$10 per $1,000 of secondary trading** (the routed LMSR fee), plus direct contributions one-for-one. So "$15,000 at settlement" means roughly $150k of primary betting plus $250k of secondary volume, *or* a much smaller market plus a few thousand in direct funding. Direct contribution is the cheaper path and deserves its own call to action — see §9. Anyone quoting a pool target without the implied volume behind it is guessing.

**The metric that actually matters** is none of the above: it is whether a payload that did not exist before this prize survives a simulated lunar night and publishes how. If that happens and the market was small, the prize worked. If the market was huge and no hardware got built, it did not.

---

## 3. Sequencing: why competitors come first

`DePrizeRegistry.teamIds` is a fixed list of outcome slots written at registration and locked at open. There is no market until there is a roster, and there is no roster until real teams say yes in public. Bettor acquisition spent before the roster exists is wasted — people arrive at a page with nothing to bet on and do not come back.

```
Recruit  ──► Name publicly ──► Freeze rules ──► Open market ──► Build season ──► The Long Night ──► Settle
(90 days)     (30 days)         (before open)     (Jan '27)      (Feb–Jun '27)     (Jul '27)      (Sep '27)
   ▲                                                   │
   └────────── bettor demand generation starts here ───┘
```

One consequence worth stating plainly: **the first named competitor is worth more than the next three combined.** Everyone we approach asks who else is in. Spend disproportionate effort on the anchor — offer them naming input on the rules, first pick of chamber slots, and a co-announcement — and use them as the social proof that closes the rest.

---

## 4. Positioning

**Category:** not a hackathon, not a grant, not a gambling product. It is a *prize with a live scoreboard*, and the scoreboard happens to be a market.

**Message hierarchy**

1. **The gap is real and it is embarrassing.** Almost everything we land on the Moon dies at sunset. Every serious answer today is a nuclear one, which means it is expensive, licensed, and closed to everyone outside a handful of companies.
2. **The bar is set so a small team can clear it.** One kilogram, no radioisotopes, off-the-shelf parts, one chamber, three cycles.
3. **The prize grows while they build.** $5,000 is the floor. Betting and direct contributions raise it; the winner takes whatever it has become.
4. **Everything is published.** The winning design is open-sourced. The point is the capability existing in the world, not a trophy.

**Proof points to lead with:** NASA Glenn built a dedicated rig ([LESTR](https://www.nasa.gov/centers-and-facilities/glenn/lunar-environment-structural-test-rig/)) to test hardware down to 40 K because this problem is unsolved. Zeno Power's CEO calls night survival ["the imperative for any serious lunar mission"](https://spacenews.com/2026-will-be-the-year-of-space-nuclear-power-and-surviving-the-lunar-night/). NASA Glenn's own [hibernation architecture](https://ntrs.nasa.gov/citations/20240004406) — freeze the battery, cold-start on cryo-tolerant electronics at dawn — is the exact approach we are asking outsiders to attempt at 1/1000th the budget. And no open prize anywhere is offering a dollar for it.

**Objections, and the answers**

| "..." | Answer |
|---|---|
| "$5,000 is nothing for a year of work." | The purse grows, 30% releases at the qualifying soak, and the chamber time we broker is worth more than the prize. Teams enter for the credential and the hardware access. |
| "This is just a freezer test." | It is 10⁻³ torr and ≤100 K for 354 hours with a self-powered cold start — the same regime NASA built LESTR for. The spec is frozen and public; argue with the numbers. |
| "Betting on science is gross." | Nobody bets against a result being true. They bet on which team ships, the way sponsors have always bet on teams — except here every bet grows the winner's purse. |
| "How do I know it isn't rigged?" | Chamber instrumentation is the host facility's, not the team's. Continuous video. Judges are independent and sign a verdict; the Senate ratifies it; the evidence bundle is pinned to IPFS. |

**Language discipline.** Say *prize*, *purse*, *back a team*, *fund the prize*. Do not say *invest*, *returns*, *guaranteed*, *token appreciation*. Never imply that bettors are paid from the prize pool — they are paid from CTF collateral by other bettors, and the two-pool distinction has to survive contact with marketing copy. Geo-blocking and terms carry over unchanged from DePrize #0.

---

## 5. Audience map

### 5.1 Competitors (supply — the critical path)

| Segment | Why they say yes | Where to reach them | The specific ask |
|---|---|---|---|
| **University CubeSat / smallsat labs** | They already own or share TVAC time; this is a publishable result and a recruiting story | Space Grant consortium mailing lists, AIAA student branches, faculty advisors, CubeSat Developers Workshop, SmallSat | "You have the chamber. Spend one weekend a month and a $500 BOM on it." |
| **Lunabotics / URC / ERC veteran teams** | Off-season project between competition cycles; different skill set from mobility | Team Discords, alumni networks, the Sept–Oct rules-drop window when teams re-form | "Your rover season ends in June. This runs through the summer." |
| **Hardware makers and engineering YouTubers** | A $5,000 purse is enormous against the $150 that maker contests typically pay; the footage is extraordinary | Hackaday tips line + a Hackaday.io project page, Hackster, r/AskEngineers, EEVblog, Hacker News | "Cold-soak a payload for two weeks on camera. We'll cover consumables." |
| **Thermal / power / battery micro-startups** | Cheap public validation of a claim they already make in pitch decks | LSIC working groups, Space Resources Roundtable, LinkedIn, cold email | "Prove the claim in public against a frozen spec." |
| **MoonDAO citizens and teams** | Already aligned; may form a team specifically | Discord, town halls, the citizen directory | "Form the house team. We'll help you find a chamber." |

**The offer packet** (one page, sent to every prospect): frozen rules, the purse and how it grows, brokered chamber access, consumables covered for the first three teams to commit publicly, 30% of the purse released at M1, judge panel named, open-source requirement stated up front, and a named MoonDAO contact who answers within a day.

### 5.2 Bettors and funders (demand)

| Segment | Hook | Channel |
|---|---|---|
| MoonDAO community | "Our first DePrize is live" | Discord, ConvertKit newsletter, town halls, `@OfficialMoonDAO` |
| Prediction-market natives | A market with no correlation to politics or sports, and a mechanism they have not seen | r/PredictionMarkets, Polymarket/Kalshi community spaces, crypto X |
| Space enthusiasts | The Long Night stream and the terminator visualization | Space YouTube and podcast collaborations, r/space, r/spaceflight, Orbital Index / Payload newsletters |
| Engineers who will never bet | "Fund the prize directly" — a donate path with no market involvement | Hacker News, LinkedIn, the prize page |
| Press | "The prize NASA never offered" | Ars Technica, SpaceNews, IEEE Spectrum, Hackaday, Universe Today |

---

## 6. Phase plan

Dates assume a start of 2026-08-19. Each phase has a gate; if the gate fails, the next phase does not start.

### Phase 0 — Foundations (Aug 19 – Sep 30, 2026)

Close the host chamber facility. Freeze the rules and pin them to IPFS. Name the judge panel (two independent engineers plus the chamber operator). Recruit the anchor competitor under embargo. Build the prize landing page and the waitlist.

**Gate:** a signed host facility and one anchor competitor privately committed. *If there is no chamber by Sep 30, stop and switch to "Six Seconds Late."* This is the single point of failure and it deserves a hard date.

### Phase 1 — Roster recruitment (Oct 1 – Nov 30, 2026)

Public launch of the *challenge* (not the market). Open the intent-to-compete window. Run direct outreach against the segments in §5.1 — target 40 qualified conversations to land 4 teams. Weekly office hours in Discord. Publish the reference design brief so nobody is blocked on "where would I even start."

**Gate:** ≥3 teams committed to being named publicly. Below 3 the market is not worth opening; extend the window by 30 days rather than opening a thin roster.

### Phase 2 — Naming and pre-launch (Dec 1 – Dec 31, 2026)

Publicly name the full roster — the 30-day rule from DePrize #0 applies, and for the same reason: bettors cannot price a competitor they cannot see. One team profile published per week. Rules frozen, no further edits. Register the DePrize in `DRAFT`, provision the CTF condition and LMSR market, seed liquidity.

**Gate:** roster public for 30 days, rules immutable, contracts deployed and rehearsed on testnet.

### Phase 3 — Market open (Jan 2027)

Open betting. Launch week: a live kickoff stream with all teams, an AMA, and the odds page. This is the moment to spend the bettor-acquisition effort that has been accumulating.

### Phase 4 — Build season and qualifying soaks (Feb – Jun 2027)

The risk here is five quiet months. The fix is a **72-hour qualifying soak per team, scheduled publicly and staggered across the season**, each one an odds-moving event with its own stream and result post. Every team's M1 attempt releases 30% of their share only if they pass, so there is real money on each of these. Monthly build-log roundups; a public build-log requirement in the rules guarantees content exists.

### Phase 5 — The Long Night (July 2027)

Pick a lunar sunset at the south-pole reference coordinates. All qualified payloads go into the chamber together. Pump down and shroud cool-down begin at real lunar sunset; the run ends at real lunar sunrise 354 hours later.

- **Continuous stream:** chamber interior, a live temperature/pressure chart, the Atlas globe with the terminator advancing across the site, and current odds in the corner.
- **Nightly "Night Watch"** — a 20-minute check-in, guest engineer, Q&A, odds recap.
- **Manufactured sub-events:** deep-cold crossing (each payload's coldest reading), the halfway mark, and dawn minus 24 hours.
- **Dawn:** the single scheduled climax. Lamp on, 60-minute window, either a beacon arrives or it doesn't, live.

### Phase 6 — Settlement and afterparty (Aug – Sep 2027)

Judges publish signed verdicts and the evidence bundle to IPFS; Senate ratifies; `releaseM1` / `completeM2` fire; winner is paid. Every entrant open-sources their design. Publish a post-mortem with all telemetry as a public dataset, and announce generation 2.

**Sunset:** 12 months from open (Jan 2028), which leaves a second dawn window inside the term if July fails.

---

## 7. Content and channels

**Anchor assets** (build once, reuse everywhere): a 90-second challenge film; the one-page competitor brief; the frozen rules PDF; a "why sunset kills landers" explainer with real numbers; team profile cards; the live telemetry dashboard.

**Cadence**

| Phase | Cadence | Formats |
|---|---|---|
| Recruitment | 2 posts/week + 1 outreach batch/week | Explainer threads, "who should enter" callouts, office-hours clips |
| Pre-launch | 1 team profile/week | Profiles, rules walkthrough, judge introductions |
| Market open | Daily for launch week | Kickoff stream, odds explainer, first-bet walkthrough |
| Build season | 1 build-log roundup/month + 1 event per soak | Team build logs, soak streams, results posts |
| The Long Night | Daily for 15 days | Continuous stream, Night Watch, telemetry milestones |
| Settlement | Burst | Verdict, winner film, open-source release, dataset |

**Earned media plan.** Hackaday is the highest-probability first hit and it converts directly into competitor signups, so pitch it during recruitment, not at launch. Pitch SpaceNews and Ars at roster-naming (a named field is a story; an idea is not). Save IEEE Spectrum and broadcast pitches for The Long Night, which is the only phase with unmissable visuals.

---

## 8. Product dependencies

What has to exist in `ui/` for the campaign to work. Most of it does.

| Need | Status | Work |
|---|---|---|
| Prize landing + market page | `pages/deprize/[id].tsx`, `DePrizeIndexContent`, `DePrizeTeamCard` exist | Content and copy |
| Pre-launch waitlist | `DePrizeComingSoon.tsx` + `lib/convert-kit/useSubscribe` exist | Wire the waitlist into the coming-soon state |
| Odds narrative | `OddsHistoryChart.tsx` exists | Annotate the chart with event markers (soak passes, dawn) |
| Atlas shared goal | `lib/lunar-atlas/seed/atlas.dataset.json` already carries 8 goals with frozen `criteria` and `market` stubs | Add a `survive-the-night` goal, `category: 'power'`, competitors as roster entries, `market.status: 'planned' → 'live'`, `payoutSplit { capability: 0.3, flight: 0.7 }` |
| **Terminator sync on the globe** | `MoonGlobe`, `TimelineScrubber`, sun lighting exist | New: compute real sunrise/sunset at the reference coordinates and drive the globe's sun from live time during the run |
| **Live telemetry widget** | — | New: chamber temperature/pressure feed rendered next to odds. The single highest-leverage build for this campaign |
| Event notifications | `lib/discord/sendDiscordMessage`, `lib/notifications` exist | Post soak start, deep-cold crossings, dawn window, and verdict to Discord |
| Direct "fund the prize" path | Juicebox launchpad path exists | Surface a contribute button that is visibly distinct from betting |

---

## 9. Growing the pool

Three inflows, and they need different pitches.

1. **Betting** — $50 to the pool per $1,000 of primary betting. Pitched to people who want a position.
2. **Direct contribution** — one-for-one. Pitched to people who want the capability to exist and find betting distasteful. Cheapest dollars we will raise; give it a prominent, separate button and thank contributors publicly.
3. **Sponsorship in kind** — chamber time, simulant, LN₂, instrumentation, a matching purse from a supplier who wants their name on it. Worth more than cash and does not touch the market at all.

**What moves odds** (and therefore volume): each qualifying soak result, each team's public build log, a team going quiet, hardware failures on camera, and the dawn window itself. Schedule these deliberately — an odds chart that never moves is a market nobody trades.

**The compounding pitch:** "Every bet raises the purse. The winner gets more because you showed up." That is the honest, legal, and genuinely unusual thing about this mechanism, and it should be in every piece of copy.

---

## 10. Budget

| Line | Lean | Full |
|---|---|---|
| Prize seed | $5,000 | $5,000 |
| Consumables for first three teams (LN₂, simulant, shipping) | $600 | $1,500 |
| Chamber time | in kind | $2,000 |
| Judge honoraria (3) | $300 | $900 |
| Streaming (camera, capture, feed into a telemetry page) | $250 | $1,200 |
| Design and video production | in house | $1,500 |
| Market liquidity seed | ~1 ETH/outcome per config default, recoverable | same |
| **Cash outlay beyond the prize** | **~$1,150** | **~$7,100** |

The lean column is the plan of record. Everything above it should be sponsored rather than bought.

---

## 11. Risks and kill criteria

| Risk | Trigger | Response |
|---|---|---|
| **No chamber** | Sep 30, 2026 with nothing signed | Kill. Switch to "Six Seconds Late." Non-negotiable. |
| Fewer than 3 competitors | Nov 30, 2026 | Extend recruitment 30 days once; then downgrade to a non-market prize or switch prizes |
| Dead air during the build season | No odds movement for 30 days | Pull a qualifying soak forward; publish a team's telemetry; run a judge AMA |
| Everyone fails the full run | Dawn, July 2027 | **Supersede into generation 2 — do not settle no-winner.** `NO_WINNER` is a refundable terminal that returns the pool and kills momentum; generations keep the pool and the story. This makes the registry generations work ([`DEPRIZE_ROSTER_CHANGES.md`](./DEPRIZE_ROSTER_CHANGES.md) §O5, Phase 2) a **launch dependency**, not a nice-to-have |
| Safety incident | Any | Rules require an implosion shield, a documented safety case, and ventilated LN₂ handling; entries without a safety case are rejected at registration, not at judging |
| A walk-in team wins | Any | Ship the `OPEN_FIELD` slot (§O4) before open, or state explicitly in the rules that only the named roster can win |
| Ambiguous result (beacon at minute 61) | Dawn | The frozen rules define the window to the second and name a tiebreak order. Freeze it before the first bet, not after |

---

## 12. After the race

The winning payload gets open-sourced and becomes the reference design for generation 2, whose bar is raised — five cycles, or a lower shroud temperature, or a mass ceiling. The pool carries forward. The chambers built or brokered for generation 1 become the standing test infrastructure for every subsequent DePrize, which is exactly the argument for running "The Rig" alongside this one.

The strategic prize is not the payload. It is that MoonDAO ends the year owning a verification apparatus, a judge bench, a roster of teams who have already competed once, and a proven claim that a community-funded market can grow and pay out a prize on a hardware result. Everything after that is cheaper.
