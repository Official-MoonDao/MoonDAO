# Survive the Night — Risk Register

**Status:** Draft for discussion
**Prize:** P1 in [`DEPRIZE_FIRST_PRIZE_CANDIDATES.md`](./DEPRIZE_FIRST_PRIZE_CANDIDATES.md)
**Related:** [`DEPRIZE_GTM_SURVIVE_THE_NIGHT.md`](./DEPRIZE_GTM_SURVIVE_THE_NIGHT.md), [`deprize-survive-the-night-outreach.csv`](./deprize-survive-the-night-outreach.csv), [`DEPRIZE_LUNAR_NIGHT_CONTRACT_PERFORMERS.md`](./DEPRIZE_LUNAR_NIGHT_CONTRACT_PERFORMERS.md)
**Last updated:** 2026-08-19

This is the full list of things that can kill, embarrass, or quietly hollow out the prize, and the mitigation for each. The GTM's kill-criteria table is the subset that stops the campaign. Everything else is how the campaign survives contact with a 354-hour chamber run and a live market.

Likelihood and impact are relative to *this* prize, not to aerospace in general. A "high" likelihood here means "this will probably happen in generation 1 unless we design against it."

---

## How to read this

Each risk has:

- **What goes wrong** — the failure as a spectator or a bettor would see it
- **Why it is likely** — the specific reason this prize is exposed
- **Mitigation** — what we do *before* it happens
- **If it happens anyway** — the in-flight response
- **Kill / escalate** — when we stop, switch prizes, or supersede rather than pretend

The single sentence that should govern every decision below: **once the first bet is placed, any rules change is a wealth transfer between bettors.** Ambiguity has to be killed in the frozen spec, not at dawn.

---

## 1. Existential — the prize cannot be run

### 1.1 No host chamber

**What goes wrong.** We announce a lunar-night prize and cannot produce a chamber that holds ≤1×10⁻³ torr at ≤100 K for 354 hours. Recruitment collapses; the market never opens; we look like we did not do the homework.

**Why it is likely.** This is the bottleneck the entire document set keeps naming. University chambers are booked, commercial time is expensive, and a 15-day continuous cryo-shroud run is an unusual ask — most TVAC work is hours, not weeks. LN₂ logistics alone (a 354-hour shroud) is a facilities-manager problem, not an engineering-student problem.

**Mitigation**

- Treat a signed host as the Phase 0 gate, not a Phase 4 problem. Hard date: **30 September 2026**.
- Dual-track the top of the outreach list: Michigan Tech PSTDL, Cal Poly STELLA, Mines CSR, CU/LASP, and Resonate Testing are asked to *host* first and *enter* second.
- Relax the spec to what a two-stage rotary pump plus an LN₂ shroud can actually hold (10⁻³ torr / 100 K), so we are not dependent on a NASA-class chamber.
- Keep "The Rig" (P2) as the infrastructure hedge: if no institution will host, the community builds the chamber first.
- Write the host agreement for a *campaign* (qualifying soaks + one common run + one backup window), not a single booking.

**If it happens anyway.** Do not open a market on a hope. Switch to Six Seconds Late. Announce the switch as a sequencing decision, not a failure of the idea — Survive the Night becomes generation 2 once a chamber exists.

**Kill / escalate.** No signed host by 30 Sep 2026 → switch prizes. Non-negotiable.

### 1.2 Fewer than three named competitors

**What goes wrong.** The market opens on one or two teams. Bettors have nothing to price. The "competition" is theater. If only one team is eligible at sunset the Senate still has a winner, but the product is a donation page with extra steps.

**Why it is likely.** The teams that *can* do this are busy (Watts/Break-the-Ice alumni, CubeSat labs on flight programs). The teams that *want* to do this often have no chamber. Summer 2027 — the planned Long Night — is when student teams have gone home.

**Mitigation**

- Spend the first 90 days on roster, not on branding. The outreach list is the workplan; ranks 1–10 are this week's calls.
- Offer the anchor competitor naming input on the rules, first pick of chamber slots, and a co-announcement. The first public name closes the next three.
- Cover consumables for the first three teams that commit publicly, so "we can't afford LN₂" is not a reason to decline.
- Broker chamber access as part of the offer packet, not as something teams have to solve alone.
- Time the build season so the common run is not the only moment a student team has to be on site. Qualifying soaks can happen during the semester; the Long Night can be run by a two-person remnant plus the host operator.
- 30-day public-naming window before open, same discipline as DePrize #0.

**If it happens anyway.** Extend recruitment 30 days once. If still under three, either (a) run it as a non-market prize and use the result to recruit generation 2, or (b) switch prizes. Do not open a two-outcome market to "see what happens."

**Kill / escalate.** <3 named teams on 30 Nov 2026 → 30-day extension. Still <3 on 31 Dec 2026 → no market.

### 1.3 A walk-in team wins, or an unlisted team is the only one that could have

**What goes wrong.** A garage team that never registered beats the named roster, or a serious lab shows up in June with a working payload. Under today's registry the Senate either ignores them (unfair, and we look captured) or declares no-winner (refundable terminal, pool dies).

**Why it is likely.** The prize is deliberately garage-scale. The outreach list will miss people. That is the point of an open prize.

**Mitigation**

- Ship the `OPEN_FIELD` roster slot ([`DEPRIZE_ROSTER_CHANGES.md`](./DEPRIZE_ROSTER_CHANGES.md) §O4) **before** this market opens, so an unlisted winner is an outcome bettors could already price.
- If `OPEN_FIELD` cannot ship in time, the frozen rules must say, in one sentence, that only the named roster can win, and that a walk-in result is published as an exhibition, not a settlement. Bettors deserve to know which world they are in.
- Keep an exhibition lane open through the build season so late teams still have a public run and a path onto the generation-2 roster.

**If it happens anyway.** Honor the frozen rule, whichever one we picked. Do not rewrite eligibility after the fact.

**Kill / escalate.** None — this is a design choice that has to be made before open, not a surprise.

---

## 2. Safety — someone gets hurt

This is the only class of risk that can end more than the prize.

### 2.1 Chamber implosion or viewport failure

**What goes wrong.** A glass or thin-wall vessel collapses under vacuum. Shrapnel, hearing damage, a very public video.

**Why it is likely.** Amateur TVAC builds use glass bell jars. Even institutional chambers have viewports. A 15-day run puts more hours on those seals than a typical campaign.

**Mitigation**

- Ban glass vessels above a stated volume in the rules. Require a documented implosion shield (polycarbonate shroud or steel chamber) as a registration gate, not a judging criterion.
- Only the host chamber is used for official soaks and the Long Night. DIY chambers are for development, not for scored runs, unless they pass a host-operator inspection against a written vessel spec.
- Host operator has absolute authority to abort. That authority is in the host agreement and in the rules, so an abort is not a judging dispute.

**If it happens anyway.** Abort, medical, preserve the logs, public incident report. Suspend the prize until an independent review signs off. Do not restart on the same vessel.

**Kill / escalate.** Any injury → pause the prize. Any implosion, even with no injury → pause until review.

### 2.2 Liquid nitrogen: asphyxiation, oxygen enrichment, cold burns

**What goes wrong.** LN₂ boil-off displaces oxygen in a closed lab, or oxygen condenses on cold surfaces and then enriches the room as it warms. Someone passes out. Someone loses skin. A 354-hour shroud means LN₂ is in the building for two weeks, including nights and weekends, which is when these accidents happen.

**Why it is likely.** These are the two hazards amateurs systematically underestimate. A long run makes them more likely, not less — the danger is the 3 a.m. refill, not the first fill.

**Mitigation**

- Official runs happen only at a host facility that already has LN₂ procedures, an oxygen monitor with an audible alarm, and forced ventilation. We do not invent a cryogenics program for this prize.
- Rules require a written LN₂ handling section in every team's safety case (even teams that will only ever use the host's system), so they have read the hazards before they show up.
- Long Night staffing: two people on site at all times, including nights, with a check-in cadence to a remote watch. No lone operator.
- Host agreement covers LN₂ delivery schedule, reserve volume (enough to finish the run if one delivery is missed), and who is allowed to refill.

**If it happens anyway.** Evacuate, medical, abort the run. The run is cheaper than a person.

**Kill / escalate.** Any O₂-deficiency alarm that is not a sensor fault, or any cold injury → pause and review.

### 2.3 Lithium batteries in vacuum and at cryogenic temperatures

**What goes wrong.** A cell vents, ruptures, or goes into thermal runaway on warmup. Less dramatically, a cell that froze and then charged below its safe temperature is wrecked and the payload is dead at dawn for a boring reason. NASA and ISRO have published exactly this failure mode; it is why the Glenn hibernation architecture *isolates* the battery before it freezes.

**Why it is likely.** Every competitive payload will have a lithium cell. Vacuum plus 100 K plus a later charge attempt is the abuse condition those papers tested. Amateur packs will not have a CID or a BMS that works at those temperatures.

**Mitigation**

- Safety case must name the cell chemistry, the freeze/charge policy, and the isolation method. Packs that cannot be isolated from the bus before freezing are rejected at registration.
- Publish a short reference note (pointing at the Glenn and ISRO papers) so teams do not discover pressure-reversal and CID trips at dawn.
- Host chamber gets a burst disk / vent path and a rule that a venting payload is pulled, not "ridden out."
- Ban exotic or damaged cells; require new, named commercial 18650/21700 cells or pouches with a datasheet.

**If it happens anyway.** Abort that payload's run. If the chamber is shared, abort the common run — see 3.3. Do not let a venting cell sit in a closed vacuum vessel with other people's hardware.

**Kill / escalate.** Fire or rupture → pause. A single cell that simply fails to recover is a competition result, not an incident.

### 2.4 Electrical and RF hazards inside the chamber

**What goes wrong.** A payload puts unsafe voltage on a feedthrough, or transmits at a power/frequency that the host did not agree to, and damages chamber instrumentation or the other payloads.

**Mitigation.** Host publishes a feedthrough and RF spec (allowed bands, max EIRP, connector map) as part of the frozen rules. Payloads are bench-checked against that spec before pump-down. Beacon reception is the host's problem; teams do not bring their own transmitters onto the chamber wall.

---

## 3. The test itself — the run is not a fair or readable result

### 3.1 The chamber cannot hold the spec for 354 hours

**What goes wrong.** A seal weeps, a pump oil-backs, the shroud warms as LN₂ delivery slips, facility power dies, or the chamber is simply not designed for a two-week continuous cryo soak. The run is aborted on day six. Every payload is an asterisk.

**Why it is likely.** Most campus TVACs are qualified for hours-to-days, not 15-day continuous shroud operation. Cal Poly's "longest cycle" was 24 hours. A 354-hour run is an order of magnitude past typical practice.

**Mitigation**

- Host qualification *before* open: a 72-hour unmanned demonstration at spec, with the same LN₂ logistics, the same pump, and the same data logger that will be used for the Long Night. If the host cannot do 72 hours, they cannot do 354.
- Backup window inside the sunset (the GTM already leaves a second dawn in the 12-month term).
- Written abort taxonomy in the frozen rules (see 3.6) so a facilities abort is not confused with a team failure.
- Redundant logging (chamber DAQ + independent logger + video timecode) so a partial run still produces a usable evidence bundle.
- LN₂ reserve and a second delivery slot booked before pump-down, not after the tank is low.

**If it happens anyway.** Classify the abort (3.6). If the chamber failed, no team is charged with a loss; rerun in the backup window or supersede. If a team's payload caused the abort, that team is DQ'd and the others rerun.

### 3.2 Shared chamber: one payload contaminates or thermally couples to the others

**What goes wrong.** All qualified payloads go in together (the GTM's plan, and the only affordable plan). One team used a greasy lubricant, a wet PCB, or a leaking cell. Outgassing wrecks the vacuum. Or three payloads in a small shroud radiate into each other so nobody actually sees 100 K. The result is unreadable and the losing teams allege the winner was sitting next to a heater.

**Why it is likely.** This is the default geometry of a cheap common run. Outgassing is the classic dirty-TVAC failure. Thermal coupling is the one spectators will not notice and losing teams will.

**Mitigation**

- Bake-out and residual-gas check of every payload before the common run, against a published outgassing/RGA limit. Fail the check, you do not go in.
- Minimum spacing, radiation shields between payloads, and a requirement that each payload sees the shroud, not its neighbor. The host designs the fixture; teams do not.
- Chamber-owned witness sensors at each payload station, not one sensor for the whole shroud. Pass/fail is "your station was at spec," not "the chamber average was at spec."
- If the chamber cannot hold N payloads at spec in a dry run, we run sequential Long Nights, not a coupled one. Sequential is slower and more expensive; it is still cheaper than an unreadable result.
- Qualifying soaks are always sequential and solo, so M1 is never contaminated by a neighbor.

**If it happens anyway.** If vacuum is lost because of a payload, that team is DQ'd and the run is aborted and rerun. If thermal coupling is discovered after the fact (station sensors disagree by more than a published delta), the run is declared a facilities abort, not a competition result.

### 3.3 The "beacon" is not actually receivable, or is ambiguous

**What goes wrong.** The payload "transmits" inside a steel can. Nobody outside can hear it. Or three payloads beacon on the same frequency and we cannot tell who. Or a team claims a LED flashing inside the chamber *is* the beacon. Dawn becomes an argument.

**Why it is likely.** RF in a vacuum chamber is a real engineering problem and we have not specified it yet. This is the most likely *verification* failure, because the rest of the spec (pressure, temperature, time) is a chamber log.

**Mitigation — freeze all of this before the first bet**

- The beacon is **electrical, not RF, unless the host provides a feedthrough antenna**. Default: a host-provided opto-isolated digital line or a current loop the payload must drive with a published preamble plus a signed temperature log. RF is an optional extra, not the scoring path.
- One protocol, published: baud, framing, log format, checksum, clock source.
- The host owns the receiver. Team-owned receivers are exhibition only.
- The 60-minute window is defined to the second, on the host clock, starting at lamp-on (itself defined: irradiance at the payload station reaches X W/m²).
- A beacon that arrives at 60:00.01 is a fail. Write that down.
- The temperature log must cover the soak at a published cadence (e.g. ≥1 sample / 10 min) or the beacon is invalid even if it arrives on time. A payload that dies at hour 20 and beacons an empty log has not survived the night.

**If it happens anyway.** The frozen spec decides. If we failed to freeze a case, that is our bug: treat it as a facilities/spec abort and rerun, do not improvise a new rule in public.

### 3.4 The solar simulator is unfair or uncalibrated

**What goes wrong.** One payload sits in a hot spot, another in a shadow of the fixture. Or the lamp is a shop light that does not represent anything, and a critic says the prize was a flashlight test.

**Mitigation.** Publish irradiance, spectrum band, and incidence angle. Measure it at each station with a host-owned sensor before pump-down and at lamp-on. Lamp-on is a number, not a switch. If stations differ by more than a published tolerance, we do not start.

### 3.5 The spec is too hard, or too easy

**What goes wrong (too hard).** Nobody beacons. The stream ends on a dead chamber. Bettors who wanted a result feel cheated even if the market resolves cleanly. Press writes "MoonDAO froze some lunchboxes and nothing happened."

**What goes wrong (too easy).** Everyone beacons on cycle one. The prize was a participation trophy. Serious labs stay away from generation 2.

**Why it is likely.** We are guessing. Glenn's hibernation work is the existence proof that *something* can cold-start at ~50–100 K, but not that a 1 kg amateur payload can do three 354-hour cycles. Three cycles is the part that is probably too hard for generation 1.

**Mitigation**

- Split the difficulty across milestones, which the mechanism already does: M1 is a 72-hour soak and a cold start (30%). M2 is the full three-cycle run (70%). A world where three teams hit M1 and nobody hits M2 is a *successful* generation 1 — we paid for a demonstrated capability and we have a harder generation 2.
- Consider, in the frozen rules, making generation-1 M2 **one** 354-hour cycle plus a second cold start, and holding three cycles for generation 2. Three consecutive 354-hour cycles is ~45 days of chamber time and is how you lose the host. This is the one spec change worth making *now*, before anyone is recruited against the harder number.
- Do not lower the temperature/vacuum bar after open. If we need to ease something, ease *duration and repetition*, not the environment — those are the things that make it "lunar night."
- Publish a reference architecture (insulation + isolated cell + cryo-tolerant front-end) so teams are not inventing the Glenn paper from scratch. The prize is the demonstration, not the literature review.

**If it happens anyway.** Too hard: supersede into generation 2 with the same pool and a slightly eased M2, or with more chamber time and the same M2. Too easy: pay the winner(s) per the tiebreak, raise the bar next generation, do not claw back.

**Kill / escalate.** Nobody even attempts M1 → the prize was badly explained or badly supported, not too hard; that is a recruitment failure (1.2). Everybody clears M2 on the first try → we under-specified; pay and move on.

### 3.6 Abort taxonomy is missing, so every interruption becomes a fight

**What goes wrong.** Power fails at hour 200. A team says they were winning. Another team says restart from zero. Bettors say the result is void. The Senate has no rule.

**Mitigation — write this into the frozen spec as a table**

| Event | Classification | Result |
|---|---|---|
| Host power, pump, shroud, or LN₂ failure | Facilities abort | No team charged; rerun or backup window |
| Payload vents, outgasses, or electrically faults the chamber | Team-caused abort | That team DQ'd for this run; others rerun |
| External emergency (weather, medical, building) | Facilities abort | Same as row 1 |
| Planned hold (sensor swap) agreed before pump-down | Not an abort | Clock rules published in advance |
| Beacon outside the window, incomplete log, station out of spec | Competition fail | That payload fails the cycle |
| Host clock / logger / video loss with no backup | Facilities abort | Rerun; we do not reconstruct a result from memory |

Partial credit (e.g. "they lasted 200 hours") is narrative, not settlement. Settlement is pass/fail against the frozen spec.

### 3.7 Cheating, or the appearance of it

**What goes wrong.** A team sneaks a heater, a hidden thermal battery they did not declare, or a sneak path on a feedthrough. Or they don't, and the losing teams say they did, and we cannot prove otherwise.

**Why it is likely.** The prize is "no external power and no active heating." Proving a negative inside a metal can is hard. Phase-change material and a large thermal mass are *legal* and will look like cheating to a spectator.

**Mitigation**

- Legal / illegal list in the rules: RHUs and any radioisotope banned; external power banned; feedthroughs are host-controlled and documented; undeclared heaters banned. Declared PCM, insulation, and thermal mass are legal and must appear on the submitted BOM.
- Host-owned current monitors on every feedthrough, logged. A payload that draws sneak power is DQ'd by a number, not an accusation.
- Pre-run inspection: X-ray or teardown-on-request of a duplicate unit if a judge flags it. Teams submit a mass budget and a thermal narrative.
- Continuous video of the chamber exterior (feedthroughs, power panel) as well as the interior.
- Judges include the host operator, who is the person most able to see a sneak path.

**If it happens anyway.** DQ against the log. If we cannot prove it, we cannot DQ — which is why the current monitors have to exist.

---

## 4. The market and the mechanism

### 4.1 Everyone fails, and we settle `NO_WINNER`

**What goes wrong.** The registry hits a refundable terminal. The pool returns to contributors. The story dies. Bettors who wanted the capability to exist — the people we told "every bet grows the prize" — watch the prize evaporate because the hardware was hard. That is the worst possible lesson for a first DePrize.

**Why it is likely.** Three 354-hour cycles at 100 K is a real engineering problem. A generation-1 wipeout is a plausible base case, not a black swan.

**Mitigation**

- **Registry generations (`supersede`) are a launch dependency.** If they are not shipped, we do not open this market. The GTM already says this; it is repeated here because it is the difference between a failed test and a dead product.
- Frozen rules say: if no named team clears M2 by sunset, the Senate does not settle no-winner; it supersedes into generation 2 with the same pool, a published spec delta, and a refreshed roster. Bettors on generation 1 are resolved per the generations design (old-roster winner vs. 1/N) — that resolution path has to be explained in the UI *before* the first bet, not after.
- M1 exists so that "nobody won M2" is not "nothing happened." Teams that cleared M1 have already been paid 30% and have a public result.

**If it happens anyway.** Supersede. Do not get talked into a clean no-winner "because it's simpler."

**Kill / escalate.** If generations are not on main before market open → slip the open date. Do not slip the spec; slip the calendar.

### 4.2 A team withdraws after the market is open

**What goes wrong.** Odds on a dead team stay on the page. Bettors on that team are stuck. The remaining field looks thinner than advertised.

**Mitigation.** Use the withdrawn-provider path the roster doc already describes: mark withdrawn, their slot goes to ~0, the others reprice. Disclose this in the UI before any bet. Require teams, at naming, to name a backup lead so a single person disappearing does not force a withdrawal.

**If it happens anyway.** Mark withdrawn promptly. Do not leave a zombie team on the page for weeks.

### 4.3 The market is dead: no bets, no odds movement, five quiet months

**What goes wrong.** We have a roster and a chamber and a page nobody visits. The Long Night happens in silence. The mechanism is not exercised.

**Why it is likely.** Hardware prizes are slow. Prediction-market natives live on daily resolution. A 354-hour soak with no intermediate events is the opposite of what that audience trades.

**Mitigation**

- Staggered public M1 soaks, each a scheduled odds-moving event with a stream and a result post. This is the GTM's whole answer to the build season and it has to actually get calendared, not just written down.
- Direct "fund the prize" path for people who will never bet. Dead betting + live contributions is still a working prize.
- Annotate the odds chart with soak results, build-log drops, and withdrawals so the chart has a narrative even at low volume.
- Do not spend bettor-acquisition money before the roster exists (already in the GTM). Dead markets that were *launched too early* do not recover.

**If it happens anyway.** Pull a soak forward. Publish raw telemetry. Run a judge AMA. If volume is still near zero at the Long Night, the Long Night is still worth running — the capability is the product.

### 4.4 Rules change after the first bet, or the Senate improvises at dawn

**What goes wrong.** Someone beacons at 61 minutes, or a station was at 105 K, or the lamp was 10% dim. The Senate "uses judgment." Bettors on the other side correctly call it a rug.

**Mitigation.** IPFS-pin the spec before open. The Senate ratifies a *judge verdict against that spec*; it does not reinterpret the spec. Edge cases that we failed to write down are facilities aborts or reruns (3.6), not Senate discretion. A public 7-day notice window already exists for cancellation; there is no equivalent for "we changed the temperature." Do not create one.

### 4.5 Regulatory / communications failure: this looks like a casino, or bettors think they win the prize pool

**What goes wrong.** A headline reads "crypto casino bets on frozen lunchboxes." Or a bettor opens a support ticket because they thought their ETH was going to the winning team. Or a jurisdiction we did not geo-block decides this is sports betting.

**Mitigation**

- Same posture as DePrize #0: geo-blocking, terms, language discipline (*prize, purse, back a team, fund the prize* — never *invest, returns, guaranteed*).
- The two-pool distinction is on the bet slip, not in a FAQ: "you are paid by other bettors; the prize goes to the team."
- Direct-contribution button is visually distinct from betting, so the people who want to fund a capability are not forced into a market.
- Do not use student names or faces in betting creatives without a signed release; a 20-year-old on a losing ticket is a bad picture.

### 4.6 ETH price crash, thin liquidity, or a lopsided book

**What goes wrong.** The $5,000 seed is suddenly $2,800 and a team that budgeted around M1 cannot ship. Or all the money is on one team and the market is uninformative.

**Mitigation.** Prize seed in a stable unit or a TWAP, disclosed up front, so teams are not taking FX risk on top of engineering risk (even if the chain unit is ETH). Liquidity seed per the existing ~1 ETH/outcome default. A lopsided book is allowed — it is information. Do not "rebalance" for optics.

---

## 5. Operations and people

### 5.1 The academic calendar empties the roster in July

**What goes wrong.** The Long Night is scheduled for July 2027 because that is a clean south-pole night and students are free. Students are *gone*. Faculty are at conferences. The payloads exist; the operators do not.

**Why it is likely.** Almost every high-value name on the outreach list is a university lab or a student team. July is the worst month of the year to need two weeks of on-site students.

**Mitigation**

- Prefer a Long Night in May (end of spring semester, before URC/Lunabotics recovery) or September (students back). The "lock to a real lunar night" idea survives any month; it does not have to be July.
- Require each named team, at registration, to identify two people who will be physically present for the common run, and a faculty or staff backup with keys to the lab.
- Design payloads so the host operator can install them from a written procedure without the team. The team's job at dawn is to watch a stream, not to hold a wrench.
- Qualifying soaks happen during the semester on purpose, so M1 is not hostage to summer.

### 5.2 Shipping, customs, and damaged payloads

**What goes wrong.** An international team's only unit arrives cracked. Or it sits in customs through the pump-down slot. The roster shrinks by one the week of the run.

**Mitigation.** Two units required: the run article and a grounded spare, both at the host 14 days before pump-down. Published packing spec. For international teams, a US-side receiving volunteer or a host-held spare kit of commodity parts (cells, boards, connectors) so a cracked enclosure is not a DQ. Exhibition lane if they miss the slot.

### 5.3 Host cancels, or the operator gets sick, mid-campaign

**What goes wrong.** The one person who knows the chamber is on leave. Or the university reclaims the chamber for a paying customer.

**Mitigation.** Host agreement names a deputy operator and a cancellation notice period (e.g. 60 days) with a backup-host clause. Keep a second host in "warm standby" from the outreach list (this is why we dual-track hosts). Qualifying soaks can move; the Long Night cannot move without a public backup window.

### 5.4 The 15-day stream is boring, then the climax is at 3 a.m. local

**What goes wrong.** We promised a spectacle. What we have is a temperature plot. Dawn, locked to a real lunar sunrise, happens at an unwatchable hour in the US. Peak concurrent viewers is 12, half of them the teams.

**Why it is likely.** Endurance tests are not naturally television. Lunar sunrise at a south-pole-like site is a fact, not a programming decision.

**Mitigation**

- The stream's job is ambient presence (Night Watch, terminator, odds), not 354 hours of appointment viewing. Market the *dawn* as the show; everything else is a scoreboard.
- If the real sunrise is at a dead hour for the core audience, run a second, clearly labelled "dawn replay" at a civilised time the same day, using the recorded lamp-on and beacon. The *result* is live; the *show* can be delayed. Do not fake a live beacon.
- Manufactured sub-events (deep-cold crossing, halfway, T−24 h) exist so there are things to show up for besides dawn.
- If nobody watches, the prize still works. Viewership is a stretch metric, not a success condition.

### 5.5 Open-source requirement scares off the teams we want

**What goes wrong.** Starpath, Orbital Mining, a faculty lab with a pending patent, all decline because the rules say the winning design is published. We are left with teams that have nothing to protect and, often, nothing that works.

**Mitigation.** Require open-source of the *winning* payload, not of every entry. Allow teams to keep process details that are not needed to reproduce the result. Say this in the offer packet so it is not a surprise in month eight. Serious labs that still say no are the commercial names we already rated "ask them to amplify, not to enter."

---

## 6. Reputation and scientific honesty

### 6.1 "This is not actually the lunar night"

**What goes wrong.** A knowledgeable critic points out that 10⁻³ torr is a dirty vacuum, 100 K is the warm end of lunar night, there is no regolith conduction, no 1/6 g, no UV, no dust, and a shop lamp is not the sun. The prize is framed as cosplay. Glenn's LESTR (40 K, 10⁻⁷ torr) is used against us.

**Why it is likely.** Because the critic is not wrong. We chose a bar a small team can clear. That is a feature and it will be used as a bug.

**Mitigation**

- Say the honesty sentence on the first page of the rules and the landing page: *this is a relevant-environment demonstration of hibernation and cold-start, not a flight qualification.* Cite Glenn's architecture as the thing we are reproducing at amateur scale, not LESTR as the thing we claim to be.
- Do not use imagery that implies a payload is "on the Moon." The Atlas hook is a shared goal, not a location claim.
- Generation 2 can tighten vacuum, temperature, or add a conductive cold plate. Generation 1 earns the right to be more lunar by existing.

**If it happens anyway.** Do not argue that 10⁻³ torr is "good enough." Agree, point at the frozen spec, and point at generation 2. Defensiveness is what makes this story bad.

### 6.2 A safety incident, or a sloppy result, becomes the only headline

**What goes wrong.** The press we wanted for "community builds a night-survivor" becomes "crypto project frozen-battery fire." Or we declare a winner on a messy log and look like we wanted a winner more than a result.

**Mitigation.** The safety mitigations in §2 are the whole answer to the first half. The abort taxonomy and the "Senate ratifies, does not reinterpret" rule are the answer to the second. A clean no-winner-then-supersede is a *better* headline than a dirty winner.

### 6.3 The winning payload is a stunt

**What goes wrong.** The winner is a thermos full of wax and a $12 watch battery that technically beacons. We paid $5,000+ for a party trick. The open-sourced design teaches nothing. Serious people who gave us the benefit of the doubt do not come back.

**Mitigation.** The spec already requires a logged temperature history, an autonomous cold start on the payload's own array, and no external power. Add, in the frozen rules, a minimum logged-internal-duration (the soak must actually have been recorded, not inferred) and a mass/volume envelope that prevents "a very large passive rock." Judges publish a short technical note with the verdict: what the winner did, what was legal, what generation 2 should forbid. If the winner is a stunt that met the spec, we pay, we tighten generation 2, and we do not pretend it was more than it was.

---

## 7. What to do in the next 30 days, in risk order

These are the mitigations that have to happen before recruitment, not during it.

1. **Sign a host, or slip.** Dual-track PSTDL, STELLA, Mines, LASP, Resonate. 72-hour qualification run as a condition of the agreement. Kill date 30 Sep 2026.
2. **Decide the generation-1 M2 bar.** Strong recommendation: one 354-hour cycle + successful cold start for M2 in generation 1; three cycles in generation 2. 45 days of chamber time is how you lose the host and the student operators.
3. **Ship `supersede` and decide `OPEN_FIELD`.** Neither is optional if we want a market. Generations are how we survive a wipeout; open field is how we survive a walk-in.
4. **Write the frozen spec's unsexy pages:** beacon protocol (prefer a host digital line, not RF), lamp-on definition, station sensors, abort taxonomy, legal/illegal thermal-mass list, feedthrough current limits, battery isolation requirement, LN₂ and implosion rules.
5. **Name the judge panel**, with a Glenn hibernation author as the technical voice if they will take the call, and the host operator as a voting member.
6. **Move the Long Night off July** unless the host is a staffed facility that does not depend on students. May or September, locked to a real lunar night in that month.
7. **Call ranks 1–10 on the outreach list** with an offer packet that already includes chamber access, consumables, and the open-source-of-the-winner-only rule.

---

## 8. Residual risk we are choosing to accept

After all of the above, the prize still has a real chance of:

- nobody clearing M2 in generation 1
- a thin betting market
- a dawn that few people watch live
- a winner whose design is closer to a well-insulated logger than to a lander

Those are acceptable. They are why generations exist, why M1 exists, and why the metric that matters is a public, reproducible cold start, not a view count. The unacceptable residuals are a safety incident, a result we cannot defend, and a no-winner settlement that gives the pool back. Those three are the ones this document is trying to make rare.
