# Choosing the First DePrize — 10 Earth-Side Lunar Capability Prizes

**Status:** Draft for discussion
**Last updated:** 2026-08-18
**Related:** [`DEPRIZE.md`](./DEPRIZE.md) (mechanism), [`DEPRIZE_ROSTER_CHANGES.md`](./DEPRIZE_ROSTER_CHANGES.md) (roster/generations), [`.cursor/plans/moondao_lunar_simulator_08e60e6b.plan.md`](../.cursor/plans/moondao_lunar_simulator_08e60e6b.plan.md) (Lunar Atlas / shared goals)
**Launch plans:** [`DEPRIZE_GTM_SURVIVE_THE_NIGHT.md`](./DEPRIZE_GTM_SURVIVE_THE_NIGHT.md) (P1), [`DEPRIZE_GTM_SIX_SECONDS_LATE.md`](./DEPRIZE_GTM_SIX_SECONDS_LATE.md) (P9)

---

## 0. The question

> What competitions can be run **on Earth** that demonstrate a capability needed **on the Moon** — funded at **$5,000**, completable in **under a year**, trivially verifiable, with **several real prospective competitors**, and buzzy enough that people want to bet on the outcome and grow the pool?

This document answers that with ten concrete prize specs, a redundancy check against the live prize landscape for each, a scoring matrix, and a single recommendation.

### 0.1 What "tied to the simulation" means here

Two readings, and every prize below satisfies both:

1. **The physical simulation** — the demonstration happens inside a simulated lunar environment on Earth: thermal-vacuum, regolith simulant, low-angle polar lighting, imposed comms latency, or a pressurized analog module. The *simulation is the referee*: pass/fail is a chamber log, a current measurement, a pressure-decay curve, not a judge's opinion.
2. **The MoonDAO simulation** — the Lunar Atlas (`ui/lib/lunar-atlas/`) models `SharedGoal` objects that link to a DePrize market. Each prize below is written so it can be registered as a shared goal with a location on the globe (south pole, PSR floor, base pad), giving the market a home in the product rather than a standalone page. Each entry lists its Atlas hook.

---

## 1. Constraints the DePrize mechanism imposes

These are not stylistic preferences; they fall out of the shipped contracts and the design doc. A prize idea that violates one of them cannot be run as DePrize #1 without contract work.

| Constraint | Source | Consequence for prize design |
|---|---|---|
| Outcomes = **named teams**, fixed count | `prediction/deprize.config.js` (`numOutcomes`), `DePrizeRegistry.teamIds` | You need **3–5 identified competitors before the market opens**. A prize with a great premise and no roster is unbettable. |
| Roster **locked at open**; new entrants wait for the next generation | [`DEPRIZE_ROSTER_CHANGES.md`](./DEPRIZE_ROSTER_CHANGES.md) §O1 | Recruit and publicly name the roster ≥30 days before open (the same rule DePrize #0 applies to providers). Consider the proposed `OPEN_FIELD` slot (§O4) so a walk-in winner does not force a no-winner settlement. |
| Winner declared by **Senate vote over an IPFS evidence bundle** | [`DEPRIZE.md`](./DEPRIZE.md) §Resolution | The evidence must be reviewable by non-specialists in ten minutes. Chamber logs + video + a signed judge verdict, not a 40-page report. |
| Prize disburses **30% at capability demo / 70% at delivery** | [`DEPRIZE.md`](./DEPRIZE.md) §Milestones (`releaseM1` / `completeM2`) | Every prize below is written with a natural two-stage split, so the mechanism is exercised end-to-end even at $5k. |
| Prize pool **grows from betting** (5% primary slice + routed LMSR fee) | [`DEPRIZE.md`](./DEPRIZE.md) §Two pools | $5,000 is the *seed*, not the cap. Say so publicly — "the prize is $5,000 and rising" is the hook that makes betting feel constructive. |
| Sunset, then a new generation over the same pool | [`DEPRIZE_ROSTER_CHANGES.md`](./DEPRIZE_ROSTER_CHANGES.md) §Phase 3 | A 9–12 month sunset is right for these. If unwon, the pool rolls into generation 2 with a bigger purse and a refreshed roster — a good story, not a failure. |
| Bettors are paid from CTF collateral, the winner from the JB pool | [`DEPRIZE.md`](./DEPRIZE.md) §Two pools | The competitor's incentive is prestige + a growing purse; the bettor's is parimutuel P&L. Both need the outcome to be **unambiguous and dated**. |

### 1.1 Scoring rubric

Each idea is scored 1–5 on eight axes (max 40):

**C**ommunicable · **T**angible step toward a lunar base · **S**peed (≤12 months) · **V**erifiable · **R**oster depth (≥3 nameable competitors today) · **A**ffordable to enter (a team can compete for well under the purse) · **B**uzz/bettability · **N**on-redundant vs existing prizes.

---

## 2. The prize landscape as of August 2026

Every idea below was checked against this. The headline finding: **the field is emptier than it looks.** The two big Centennial Challenges that covered this ground both closed in 2024, the student-facing BIG Idea Challenge was discontinued, and the surviving competitions are either (a) enormous and slow, (b) closed to non-US or non-ESA entrants, or (c) K-12/undergraduate coursework programs.

| Program | Scope | Status | Purse | Overlap risk |
|---|---|---|---|---|
| [Break the Ice Lunar Challenge](https://www.nasa.gov/centers-and-facilities/marshall/california-teams-win-1-5-million-in-nasas-break-the-ice-lunar-challenge/) | Icy regolith excavation + transport | **Closed** (final June 2024) | $1.5M | Excavation ideas only |
| [Watts on the Moon](https://www.nasa.gov/prizes-challenges-and-crowdsourcing/centennial-challenges/watts-on-the-moon-challenge/) | Power transmission + storage through lunar night | **Closed** (2020–2024) | $5M | Energy storage ideas only |
| [MoonROx](https://spacenews.com/nasa-offers-250000-award-lunar-oxygen-system-design/) | 5 kg O₂ from JSC-1 in 8 hours | **Expired 2008, never won** | $250k | Oxygen ideas — precedent, not competitor |
| [LunaRecycle](https://www.nasa.gov/prizes-challenges-and-crowdsourcing/centennial-challenges/lunarecycle/) | Recycling mission waste | Finals **August 2026** | $3M | Recycling — avoid |
| [Rock and Roll with NASA](https://www.nasa.gov/directorates/stmd/prizes-challenges-crowdsourcing-program/center-of-excellence-for-collaborative-innovation-coeci/rock-and-roll-with-nasa-challenge/) | Compliant rover wheels | Phase 3 demo **July 2026** | $155k | Wheels/abrasion — avoid |
| [3rd ESA-ESRIC Space Resources Challenge](https://src.esa.int/) | Building with lunar regolith | **Open**, OSIP deadline 2 Oct 2026, field test at LUNA summer 2027 | €500k | Construction/sintering — partial |
| [NASA Lunabotics](https://www.nasa.gov/learning-resources/lunabotics-challenge/) | Student excavation/berm robots | Annual, 2027 cycle open | Non-cash | Excavation — avoid |
| [RASC-AL](https://www.nasa.gov/directorates/stmd/prizes-challenges-crowdsourcing-program/nasa-selects-university-finalists-for-technology-concepts-competition/) / [X-Hab](https://ceng.calpoly.edu/news/moon-to-mars-exploration-systems-and-habitation-m2m-x-hab-academic-innovation-challenge-fy27) | Paper concepts + university studies | Annual | $15k–50k awards | Concepts, not hardware demos |
| [Human Lander Challenge](https://www.nasa.gov/directorates/esdmd/artemis-campaign-development-division/human-landing-system-program/nasa-announces-winners-of-inaugural-human-lander-challenge/) | Plume-surface interaction (2024 theme) | Annual, theme rotates | $18k + stipends | Landing pads — partial |
| [Plant the Moon](https://plantthemoon.com/home/) / [Build the Moon](https://btmc.competitionsciences.org/challenge-overview/) | Crops in simulant / regolith concrete | Annual, K-12 & undergrad, $449 entry | Non-cash | Plants + student regolith concrete — avoid |
| [NASA TechLeap](https://www.nasa.gov/stmd-flight-opportunities/access-flight-tests/nasa-techleap-prize-information/) | Flight-test payloads (current theme: robotically manipulated payloads) | Rolling themes | $500k | Funds specific companies; not an open lunar-night prize |
| [BIG Idea Challenge](https://www.nasa.gov/nasas-big-idea-challenge/) | Themed student hardware (2021 = lunar dust) | **Discontinued** | — | Leaves a real gap |
| [Lunar XPRIZE](https://www.xprize.org/competitions/google-lunar) | Landing + roving | **Expired 2018**, no successor announced | — | — |
| [Hackaday contests](https://hackaday.io/contests) | Maker hardware, rotating themes | Continuous | **$150 gift cards ×3** | None — and it calibrates the market: $5,000 is enormous to this audience |

Two structural gaps stand out:

- **Nobody is running an open prize on surviving the lunar night**, despite it being the single most-cited near-term capability gap. Zeno Power's CEO calls it "the imperative for any serious lunar mission" ([SpaceNews](https://spacenews.com/2026-will-be-the-year-of-space-nuclear-power-and-surviving-the-lunar-night/)); NASA Glenn built [LESTR](https://www.nasa.gov/centers-and-facilities/glenn/lunar-environment-structural-test-rig/) to test down to 40 K and has a [cryogenic hibernation architecture](https://ntrs.nasa.gov/citations/20240004406) in development. All of it is internal R&D or contracts. No prize.
- **Nobody is running prizes at the amateur/small-team scale.** The gap between a $150 Hackaday gift card and a €500k ESA cooperative agreement is where a $5,000 DePrize lives alone.

---

## 3. The ten prizes

Each entry: what wins, why it matters, how it's verified, who might enter, redundancy check, and what makes it bettable.

---

### P1 — "Survive the Night" · lunar-night cold soak and dawn cold start

**One line:** Build something the size of a shoebox that goes dark and frozen for 354 hours in vacuum, then wakes itself up when a lamp comes on — with no radioisotopes and no external power.

**Win condition.** A ≤1 kg, self-contained payload is placed in a thermal-vacuum chamber held at ≤1×10⁻³ torr with the shroud at ≤100 K. It cold-soaks for **354 continuous hours** (one lunar night) with no external power and no active heating. At "dawn" a calibrated solar simulator illuminates its own array. Within 60 minutes the payload must autonomously cold-start on array power alone, warm and reconnect its own energy storage, and transmit a telemetry beacon containing the full internal temperature log recorded during the night. It must survive **three consecutive cycles** without degradation. Radioisotope heaters and power sources are banned (cost, licensing, and it would make the prize a procurement exercise).

- **M1 (30%):** a 72-hour qualifying soak with a successful cold start.
- **M2 (70%):** the full three-cycle run.

**Why it matters.** This is the gate on every low-cost lunar surface asset. Landers today die at dusk. NASA Glenn's hibernation approach — isolate the battery, let it freeze at 50–100 K, and cold-start on cryo-tolerant electronics at dawn — is exactly the architecture being validated, and a working sub-kilogram demonstrator built by an outsider is a real data point, not a stunt.

**Verification.** Chamber pressure and shroud temperature traces (chamber-owned instrumentation, not the team's), continuous witness video, and the payload's own signed telemetry log. The pass/fail is a single frame: does it beacon or not. Judges are two independent engineers plus the host chamber operator; the Senate ratifies their signed verdict.

**Prospective roster.** University smallsat and CubeSat labs (which already own or share TVAC time), Lunabotics/URC veteran teams looking for an off-season project, hardware YouTubers with vacuum and LN₂ capability, and small thermal/power startups wanting a cheap public credential. Recruit 4, name them publicly 30 days before open.

**Cost to compete.** Payload BOM $200–800. The real cost is chamber access — mitigated by MoonDAO brokering a single host facility for all entrants (a university lab or a commercial vendor; [Resonate Testing](https://www.resonatetesting.com/tvac-competition-resonate-testing/) has given away TVAC time for free as a marketing exercise) and by the relaxed 10⁻³ torr / 100 K bar, which is reachable with a two-stage rotary pump plus an LN₂ shroud.

**Redundancy check.** Searched NASA Centennial Challenges, HeroX, XPRIZE, TechLeap, ESA/ESRIC. **No open prize exists.** The adjacent work is internal (NASA Glenn LESTR and hibernation electronics) or commercial (Zeno Power × ispace, entX, City Labs, Perpetual Atomics) — all radioisotope-based, all far above this scale. Break the Ice offered TVAC access as a *prize perk*, but the challenge itself was excavation and closed in 2024.

**Bettability.** Excellent. The failure mode is dramatic and public — a team either beacons at dawn or is a brick. Odds should move visibly on each qualifying soak. The betting argument ("insulation-first vs. cryo-electronics-first vs. phase-change-mass") is legible to a non-engineer.

**Atlas hook.** Shared goal *"First community-built asset to survive a lunar night"*, sited at the south pole alongside the commercial night-survival programs already on the map.

**Score:** C5 T5 S4 V5 R4 A3 B5 N5 = **36**

---

### P2 — "The Rig" · a $2,000 open-source lunar-night chamber

**One line:** Publish an open-hardware design for a thermal-vacuum chamber that hits ≤1×10⁻⁴ torr with a ≤120 K shroud for under $2,000 in parts — and prove it by having two strangers build it.

**Win condition.** Complete open-source release (BOM with live supplier links, CAD, wiring, firmware, safety analysis, build guide) plus a demonstrated run holding ≤1×10⁻⁴ torr and ≤120 K shroud for ≥24 hours with a 1 kg thermal load. Documented parts cost ≤$2,000 excluding consumables. **Two independent third parties must build it from the docs alone and reproduce the numbers** — that replication requirement is the entire prize, and it is why the winner is unarguable.

- **M1 (30%):** first working chamber + published docs.
- **M2 (70%):** two verified independent replications.

**Why it matters.** Every other prize on this list is bottlenecked on chamber access. This one manufactures the verification infrastructure for the whole DePrize program and hands the community a permanent capability. The literature shows the gap: an academic Peltier-based chamber costs [$31,000](https://unisec.jp/history/takumi/published_papers/79.pdf) and only reaches −29 °C; the well-known [$200 hobby chamber](https://arkorobotics.com/blog/?p=113) reaches −40 °C by taping dry ice to the sample. Nothing public sits between those and a real cryo-shrouded rig.

**Verification.** Replication is the proof. Each replicator posts pressure and temperature traces from their own build. Cheap to judge, impossible to fake quietly.

**Prospective roster.** The Hackaday/maker hardware community (which today competes for $150 gift certificates), university lab technicians, amateur vacuum and cryogenics hobbyists, makerspaces, and analog habitat groups that want in-house test capability.

**Cost to compete.** ≤$2,000 by construction — the constraint is the spec.

**Redundancy check.** No prize exists. Resonate Testing's TVAC competition awards *access to their chamber*, not a build. Academic low-cost TVAC papers exist but none are open-hardware at this price/temperature point.

**Bettability.** Good, and unusually legible: bettors are effectively betting on which builder ships documentation good enough for a stranger to follow. Replication attempts are public, streamable events.

**Atlas hook.** Not a lunar asset — frame it as infrastructure for the prize program itself, the "picks and shovels" DePrize.

**Score:** C4 T4 S5 V4 R5 A5 B4 N5 = **36**

---

### P3 — "Dust Off" · self-cleaning surfaces under vacuum

**One line:** Recover 90% of a solar panel's output after it's been buried in charged moondust — ten times in a row, with no wipers, no consumables, and no human touch.

**Win condition.** A 100 cm² photovoltaic coupon is fouled under vacuum with tribocharged LHS-1 fine fraction to a standardised areal density (2 mg/cm², weighed). The team's mitigation system — passive coating, electrodynamic dust shield, electron beam, anything without consumables or mechanical contact — must restore **≥90% of clean short-circuit current** under a fixed solar simulator, using ≤50 J per clean, repeated for **10 cycles** with no measured degradation on the final cycle. Highest final-cycle recovery wins; energy per clean is the tiebreak.

- **M1 (30%):** 3 cycles at ≥80% recovery. **M2 (70%):** full 10-cycle run.

**Why it matters.** Unmitigated dust accumulation is modelled at 2–5% panel efficiency loss per day, i.e. up to 28–70% over a lunar day. Every surface power plan on the Moon depends on solving it, and the current best-in-class published efficacy is around 92% under lab conditions.

**Verification.** Isc under a fixed lamp before fouling, after fouling, and after cleaning. Three numbers per cycle, a gram scale, and video. Among the cleanest verification stories on this list.

**Prospective roster.** Electrostatics groups spun out of university labs (the LASP/Space Dust Research & Technologies and Orbital Mining Corp lineage shows the field has multiple small players), materials-science groups working on anti-dust coatings, and makers — an electrodynamic dust shield is fundamentally a printed electrode pattern and a high-voltage driver, which is squarely garage-buildable.

**Cost to compete.** $300–1,500 (simulant at [$45/kg](https://exolithsimulants.com/products/lhs-1-lunar-highlands-simulant), a small bell jar, a HV driver, a panel).

**Redundancy check.** The 2021 BIG Idea Challenge was lunar dust — **that program is discontinued**. NASA currently funds specific companies via TechLeap and SBIR, which is procurement, not an open prize. No open competition exists.

**Bettability.** Strong: a visibly filthy panel becoming visibly clean is the best B-roll on this list, and "coating vs. field vs. beam" is a real technical argument with camps.

**Atlas hook.** Shared goal *"Keep the lights on"*, attached to surface power projects.

**Score:** C5 T4 S5 V5 R4 A4 B4 N4 = **35**

---

### P4 — "First Breath" · oxygen from regolith at garage scale

**One line:** Make breathable oxygen out of moondust with equipment you could fit on a workbench — and post the energy bill.

**Win condition.** Starting from ≥1 kg of unmodified LHS-1 or LMS-1 simulant, produce **≥10 grams of O₂ at ≥95% purity** within an 8-hour run, using no Earth-supplied consumable reagent that is itself consumed net (catalysts and recycled reductants allowed; a tank of feedstock is not). Metered energy input recorded throughout. Ranking is by **kWh per kg O₂**, so the prize produces a public efficiency scoreboard rather than a single pass/fail.

- **M1 (30%):** first verified gram. **M2 (70%):** the full 10 g run with the energy figure.

**Why it matters.** Oxygen is ~45% of regolith by mass and the highest-leverage ISRU product (life support and, eventually, propellant oxidiser). NASA set this target twenty years ago at 5 kg in 8 hours and [nobody claimed the $250k](https://spacenews.com/nasa-offers-250000-award-lunar-oxygen-system-design/) before MoonROx expired in 2008. Ten grams is 500× easier and still nobody has a public, reproducible, cheap demonstration. "The prize NASA couldn't give away, at 1/500th scale" is a genuinely good story.

**Verification.** Gas chromatography or a calibrated O₂ sensor on the output stream, mass balance on the crucible before/after, energy from a metered supply, continuous video. Hot and hazardous, so a host lab is required.

**Prospective roster.** University space-resources and metallurgy groups (Colorado School of Mines runs a dedicated Space Resources program; Michigan Tech, Missouri S&T, UCF and others have surface-technology labs), international teams excluded from US-only and ESA-only competitions, and serious amateur chemists/metallurgists.

**Cost to compete.** $1,000–3,000. Molten regolith electrolysis at 1,600 °C is the hard path; hydrogen reduction at 900–1,000 °C or carbothermal routes are within reach of a well-equipped shop.

**Redundancy check.** MoonROx expired unclaimed in 2008. The 2nd ESA-ESRIC challenge (won by Team BREMEN, €500k) was about *beneficiation* — sizing feedstock *for* oxygen extraction — not extraction itself, and was ESA-states-only. The 3rd is construction. No open oxygen-extraction prize exists anywhere today.

**Bettability.** Very high. "Air from dirt" needs no explanation, and the kWh/kg leaderboard gives bettors a continuously updating signal instead of one binary event.

**Atlas hook.** Shared goal *"First commercial ISRU oxygen"* — already an explicit example in the Lunar Atlas plan.

**Score:** C5 T5 S4 V4 R3 A3 B5 N4 = **33**

---

### P5 — "Ice Grab" · water out of frozen regolith, measured in grams per kilowatt-hour

**One line:** Beat the European lab benchmark for pulling water out of icy moondust — from a garage.

**Win condition.** From ≥2 kg of icy simulant at 5 wt% ice (recipe published by MoonDAO so all entrants use identical feedstock), operating at ≤1×10⁻³ torr with the sample starting at ≤150 K, recover **≥50 g of liquid water at ≥99% purity** via sublimation and cold-trap capture. Ranking by **grams recovered per kWh**, with recovery fraction as tiebreak. The public bar to beat: the EU LUWEX project reported **22.88 g/kWh** with icy regolith simulant and 66.33 g/kWh with icy glass beads, recovering up to ~73% of sample water.

- **M1 (30%):** any water in the trap. **M2 (70%):** the 50 g run with the efficiency figure.

**Why it matters.** Polar water is the reason the south pole is the destination. Extraction efficiency, not resource presence, is the open question, and dust fouling of seals and cold traps is the known failure mode LUWEX flagged.

**Verification.** Mass of recovered water on a calibrated scale, purity by conductivity plus a lab assay, metered energy, chamber logs.

**Prospective roster.** ISRU and cryogenics university groups, LUWEX-adjacent European labs (they can enter this even while ESA challenges are running, since it is neither construction nor beneficiation), and well-equipped amateurs.

**Cost to compete.** $1,500–4,000 — the most expensive on this list. Making 5 wt% icy simulant with micron-scale ice requires LN₂ handling and cryogenic mixing.

**Redundancy check.** No prize exists. LUWEX is a funded EU research project, not a competition. Break the Ice covered *excavating* icy regolith and closed in 2024.

**Bettability.** Good, with an unusually strong narrative hook — an explicit published benchmark from a national-lab consortium that a garage team can try to beat.

**Atlas hook.** Shared goal *"First water from a PSR"*, sited at a permanently shadowed crater floor.

**Score:** C5 T4 S3 V4 R3 A2 B4 N4 = **29**

---

### P6 — "Moonbrick" · a sunlight-only block that survives thermal cycling

**One line:** Make a brick out of moondust using nothing but focused sunlight, then prove it doesn't crack after ten lunar day-night cycles in vacuum.

**Win condition.** Using **only concentrated natural sunlight** as the process energy (no grid power to the sintering step, no binders, no Earth additives), produce a block ≥10×10×3 cm from LHS-1. The block then undergoes **10 thermal cycles between +120 °C and −180 °C at ≤1×10⁻³ torr** and must retain **≥10 MPa compressive strength** afterwards, tested by an independent lab. Equipment BOM ≤$500. Ranking by post-cycling strength.

- **M1 (30%):** a block that passes strength testing uncycled. **M2 (70%):** the cycled block passes.

**Why it matters.** Solar sintering works — ESA and DLR printed gypsum-strength bricks in a solar furnace, and lab sintering has reached [45 MPa](https://arxiv.org/pdf/2308.14331) with electric furnaces. What is thinly published is whether cheap, sunlight-only blocks survive repeated thermal-vacuum cycling, which is the actual service condition for a berm, road, or shield wall.

**Verification.** Standard compressive test at an independent lab, chamber logs for the cycling, video of the sintering. Fully objective.

**Prospective roster.** Makers with Fresnel/heliostat setups (a large and visible niche), ceramics and civil-engineering university labs, ISRU construction startups too small for ESA's process, and non-European teams shut out of the ESA challenge.

**Cost to compete.** $400–1,200.

**Redundancy check.** ⚠️ **Highest overlap on this list.** The [3rd ESA-ESRIC Space Resources Challenge](https://src.esa.int/) — "Building with Lunar Resources," €500k, OSIP deadline 2 Oct 2026, field test at LUNA in summer 2027 — explicitly asks for an ISRU construction unit (a brick) produced in a live demonstration. Differentiators: ESA is restricted to entities in 25 European Exploration Programme states, requires a commercialisation pathway, and runs into 2027; ours is global, ≤$500 of equipment, sunlight-only, and scores on **thermal-vacuum cycling survival**, which ESA does not require. The student-facing [Build the Moon Challenge](https://btmc.competitionsciences.org/challenge-overview/) also covers regolith concrete, but with binders, no vacuum, and a $449 entry fee. Runnable, but it is the least differentiated idea here.

**Bettability.** Good — the artifact is photogenic and the failure (a cracked brick) is instantly readable.

**Atlas hook.** Shared goal *"First structure built from lunar material"*.

**Score:** C5 T4 S4 V5 R4 A4 B4 N2 = **32**

---

### P7 — "Regolith Battery" · store the day, power the night

**One line:** Heat a bucket of moondust with the sun for six hours, then see how long it can keep a light on in vacuum.

**Win condition.** Using ≤10 kg of LHS-1 as the *only* thermal storage medium (no phase-change salts, no water, no batteries in the storage path), charge for 6 hours from a capped solar-simulator input, then deliver electrical energy to a fixed resistive load through an **18-hour dark period** at ≤1×10⁻³ torr with the surroundings at ≤200 K. Ranking by **watt-hours delivered per kg of storage mass**, with a minimum threshold of 5 Wh/kg to qualify.

- **M1 (30%):** any measured power at hour 12. **M2 (70%):** the full 18-hour run above threshold.

**Why it matters.** Regolith thermal storage is one of the few night-power options that does not require shipping mass from Earth. Published system studies claim tens of watts to kilowatts from regolith-plus-thermoelectric architectures; almost none of it has a cheap, independently reproduced physical demonstration.

**Verification.** A datalogger on the load. One number: watt-hours. Plus chamber logs.

**Prospective roster.** Thermoelectric and energy-storage hobbyists (a large maker community), mechanical engineering senior design teams, and RASC-AL/Watts-on-the-Moon alumni teams with no current competition to enter.

**Cost to compete.** $800–2,500 (TEG modules, insulation, 10 kg of simulant at $45/kg, DAQ).

**Redundancy check.** Watts on the Moon closed in 2024 and was about transmission and storage generally, not in-situ regolith storage. No open prize exists.

**Bettability.** Moderate. The physics argument (thermoelectric vs. Stirling vs. thermophotovoltaic) is great for insiders but harder to make a general audience care mid-run. Best run as a companion market to P1.

**Atlas hook.** Shared goal *"Power through the night"*.

**Score:** C4 T4 S4 V5 R3 A3 B3 N4 = **30**

---

### P8 — "Dust Tight" · a joint that still turns after a hundred thousand revolutions in moondust

**One line:** Build a bearing or seal that survives 100,000 revolutions buried in abrasive moondust under vacuum without seizing.

**Win condition.** A rotary joint, submerged in LHS-1 fines under vacuum at ≤1×10⁻³ torr, completes **100,000 revolutions** at ≥10 RPM with continuous torque logging. Pass requires **≤20% torque increase** from baseline and no dust ingress past the seal on post-test teardown. Ranking by torque rise, then by mass.

- **M1 (30%):** 10,000 revolutions. **M2 (70%):** the full 100,000.

**Why it matters.** Lunar dust abrades an order of magnitude faster than terrestrial basaltic sand and it is what actually kills mechanisms. Apollo's hardware degraded from it. It is the most under-glamorised failure mode on the Moon.

**Verification.** Torque trace and teardown photos. Fully objective, and the test rig itself is cheap.

**Prospective roster.** Tribology labs, seal and bearing manufacturers wanting cheap publicity, mechanical engineering student teams, and makers.

**Cost to compete.** $500–2,000.

**Redundancy check.** The 2021 BIG Idea Challenge covered dust-tolerant mechanisms and the program is discontinued. NASA funds this through SBIR (e.g. ATSP Innovations' dust-resistant bearing work), which is procurement. Rock and Roll with NASA covers *wheels*, ends July 2026, and does not test sealed joints. No open prize exists.

**Bettability.** Weakest on this list — a 100,000-revolution endurance run is not a spectator sport, and the outcome is a torque number. Real engineering value, poor market.

**Atlas hook.** Shared goal *"Mechanisms that last"*, attached to rover and ISRU projects.

**Score:** C3 T4 S4 V5 R3 A4 B2 N4 = **29**

---

### P9 — "Six Seconds Late" · teleoperated repair under lunar comms

**One line:** Fix a broken machine by remote control with a six-second delay, a five-frames-per-second video feed, and a comms blackout in the middle.

**Win condition.** Operators, physically isolated from the hardware, complete a standardised servicing task (mate a dusty connector, swap a module, deploy a panel) on a robot in a regolith-simulant arena through a MoonDAO-run relay that imposes **6 s round-trip latency, 5 fps 320p video, 10% packet loss, and one unannounced 10-minute blackout**. Fastest verified completion wins; every team runs the identical task on identical hardware supplied by MoonDAO, so the competition is purely on control software and operator technique.

- **M1 (30%):** complete the task at 0.3 s latency. **M2 (70%):** complete it under full lunar conditions.

**Why it matters.** Round-trip delay to the lunar farside via an L2 relay is ~2.6 s at best; realistic operational delay with processing is worse. Published experiments show a **150% increase in task time** going from 0.3 s to 2.6 s — teleoperation is a genuine bottleneck on how much work gets done per day on the surface, and it is a software problem that an outsider can beat a space agency at.

**Verification.** A stopwatch and the relay's own logs. Unambiguous, and it can be **streamed live** — which is exactly what a prediction market wants.

**Prospective roster.** The deepest roster of the ten: URC and ERC rover teams (124 registered teams from 29 countries at ERC 2026; 116 teams from 18 countries at URC 2026), Lunabotics teams, robotics labs, and competitive gaming/robotics crossover talent. Hardware is supplied, so entry is nearly free and remote teams can compete from anywhere.

**Cost to compete.** Near zero — MoonDAO supplies the robot and arena. This is the only prize where the $5,000 purse might exceed every competitor's combined spend.

**Redundancy check.** URC and ERC impose limited-visibility operation but are Mars-analog and do not run a lunar-latency prize; latency effects are studied in NASA-adjacent research papers, not competitions. No prize exists.

**Bettability.** The best on this list. Head-to-head, live, repeatable heats with a clock — the natural shape of a betting market. Odds can move within a single broadcast.

**Atlas hook.** Shared goal *"Operate through the delay"*, attached to comms/PNT relay projects.

**Score:** C5 T3 S5 V5 R5 A5 B5 N5 = **38**

---

### P10 — "Patch the Hab" · find and seal a leak in gloves

**One line:** A pressurised module is losing air and nobody knows where. Find the hole and stop it — wearing pressure gloves, on a clock.

**Win condition.** In a pressurised analog module seeded with an unknown puncture (1–5 mm, hidden location, possibly behind a panel), a two-person crew wearing pressurised or equivalently restrictive gloves must **locate and seal the leak such that the pressure decay rate drops below 0.5% per hour**, within 30 minutes, using only their own kit. Multiple randomised runs; ranking by mean time-to-seal across runs.

- **M1 (30%):** a seal in a bench-top test article. **M2 (70%):** the timed module runs.

**Why it matters.** Loss of pressure is the fastest-acting habitat failure. Self-healing materials for this are an active research area with no fielded, low-cost answer, and gloved dexterity is the constraint everyone underestimates — Apollo and ISS crews consistently report it. A cheap, tested leak-find-and-seal kit and procedure is directly useful to every analog habitat on Earth today.

**Verification.** A pressure transducer. The decay curve is the verdict. No vacuum chamber, no cryogenics, no simulant required — **the cheapest and safest prize here to run**.

**Prospective roster.** The analog habitat community is real, organised, and currently has nothing to compete for: LunAres (Poland, running 18-day missions), Analog Astronaut Training Center (30–50 person analog colonies in 2026–27), SAM at Biosphere 2, Mars Society chapters, plus university human-spaceflight groups and materials teams entering on the sealant side.

**Cost to compete.** $200–1,000 (sealant development plus travel to a host module).

**Redundancy check.** NASA's 3D-Printed Habitat Challenge included hydrostatic seal testing but concluded in 2019. Self-healing habitat materials are pursued via SBIR and Langley research. Analog missions (LunAres, AATC, HERA) are paid or volunteer experiences, not prizes. No competition exists.

**Bettability.** Strong. It is a timed human drama with a countdown, which is the easiest thing in the world to broadcast and bet on.

**Atlas hook.** Shared goal *"Keep the air in"*, attached to habitat projects.

**Score:** C5 T4 S5 V5 R4 A5 B4 N4 = **36**

---

## 4. Scoring matrix

| # | Prize | C | T | S | V | R | A | B | N | **Total** |
|---|---|---|---|---|---|---|---|---|---|---|
| P9 | Six Seconds Late | 5 | 3 | 5 | 5 | 5 | 5 | 5 | 5 | **38** |
| P1 | Survive the Night | 5 | 5 | 4 | 5 | 4 | 3 | 5 | 5 | **36** |
| P2 | The Rig | 4 | 4 | 5 | 4 | 5 | 5 | 4 | 5 | **36** |
| P10 | Patch the Hab | 5 | 4 | 5 | 5 | 4 | 5 | 4 | 4 | **36** |
| P3 | Dust Off | 5 | 4 | 5 | 5 | 4 | 4 | 4 | 4 | **35** |
| P4 | First Breath | 5 | 5 | 4 | 4 | 3 | 3 | 5 | 4 | **33** |
| P6 | Moonbrick | 5 | 4 | 4 | 5 | 4 | 4 | 4 | 2 | **32** |
| P7 | Regolith Battery | 4 | 4 | 4 | 5 | 3 | 3 | 3 | 4 | **30** |
| P5 | Ice Grab | 5 | 4 | 3 | 4 | 3 | 2 | 4 | 4 | **29** |
| P8 | Dust Tight | 3 | 4 | 4 | 5 | 3 | 4 | 2 | 4 | **29** |

C = communicable · T = tangible step · S = speed · V = verifiable · R = roster depth · A = affordable to enter · B = buzz/bettability · N = non-redundant

---

## 5. Recommendation

**Run "Survive the Night" (P1) as the first DePrize, with "The Rig" (P2) as a companion qualifying track over the same prize pool.**

The reasoning:

- **It is the right story.** Surviving the lunar night is the most legible capability gap in lunar exploration and the industry says so out loud. A community that funds the first amateur-built payload to make it through a simulated lunar night has done something specific, dated, and quotable — and it is the example the question started from, which is a signal that it is the intuitive answer.
- **It is genuinely unoccupied.** Two Centennial Challenges that touched this ground closed in 2024, the student challenge that covered dust was discontinued, and every current night-survival effort is a radioisotope program run by a funded company. Banning radioisotopes puts the prize in territory nobody else is competing in and keeps it winnable by a small team.
- **The verification is a single frame of video.** It beacons at dawn or it doesn't. The Senate reviews a chamber log, a video, and a signed judge verdict.
- **It exercises the whole mechanism.** The 30/70 milestone split maps cleanly onto a 72-hour qualifying soak and the full three-cycle run, so `releaseM1` and `completeM2` both fire in a low-stakes setting before a large prize depends on them.

**The one real risk is chamber access**, and P2 is the hedge: run "The Rig" as a first-generation track so that by the time P1's full run comes due, the community owns several qualifying chambers and a published spec for what counts as one. If the community would rather not stack two prizes, the sequencing is: **P2 (3–4 months) → P1 (9–12 months) → P3 or P9**.

**If chamber access cannot be brokered at all**, switch to **P9 "Six Seconds Late"**. It scores highest overall, has by far the deepest ready-made roster (240+ registered rover teams across URC and ERC this year alone), costs competitors nothing to enter, needs no vacuum hardware, and is the most natural live-betting product of the ten. Its only weakness is that it advances operations rather than hardware — which matters less for a first outing whose real job is to prove the mechanism works and draw a crowd.

**Do not run first:** P6 (ESA is actively running a construction challenge), P5 (most expensive to enter, thinnest roster), P8 (real engineering value, no spectacle).

Launch plans for both P1 and P9 are worked out in [`DEPRIZE_GTM_SURVIVE_THE_NIGHT.md`](./DEPRIZE_GTM_SURVIVE_THE_NIGHT.md) and [`DEPRIZE_GTM_SIX_SECONDS_LATE.md`](./DEPRIZE_GTM_SIX_SECONDS_LATE.md).

### 5.1 Ideas considered and cut

| Idea | Why cut |
|---|---|
| Waste recycling | [LunaRecycle](https://www.nasa.gov/prizes-challenges-and-crowdsourcing/centennial-challenges/lunarecycle/) — $3M, finals August 2026 |
| Rover wheels / abrasion | [Rock and Roll with NASA](https://www.herox.com/NASARockandRoll) — live through July 2026 |
| Regolith excavation | [Lunabotics](https://www.nasa.gov/learning-resources/lunabotics-challenge/) annually, 40–50 teams; Break the Ice closed 2024 |
| Growing crops in simulant | [Plant the Moon](https://plantthemoon.com/home/) — established, global, annual |
| Regolith concrete for students | [Build the Moon](https://btmc.competitionsciences.org/challenge-overview/) — annual, kits provided |
| Landing pads / plume-surface interaction | [Human Lander Challenge](https://www.nasa.gov/directorates/esdmd/artemis-campaign-development-division/human-landing-system-program/nasa-announces-winners-of-inaugural-human-lander-challenge/) 2024 theme; also needs a rocket to verify properly |
| Earth-Moon-Earth radio bounce | Real lunar-comms demo, but amateur radio has run EME contests for decades — fully redundant |
| Anything requiring an actual launch | Breaks the $5,000 and one-year constraints on its own |

---

## 6. Operational notes for whichever prize is chosen

**Roster recruitment (the critical path).** The mechanism needs 3–5 named teams before open. Budget the first 60 days entirely to recruitment: publish the draft rules, open an intent-to-compete window, and require public naming 30 days before the market opens — the same discipline DePrize #0 applies to providers, and for the same reason: bettors cannot price an unidentified competitor. Strongly consider shipping the proposed `OPEN_FIELD` roster slot ([`DEPRIZE_ROSTER_CHANGES.md`](./DEPRIZE_ROSTER_CHANGES.md) §O4) before open so that a walk-in winner does not force a no-winner settlement.

**Freeze the rules before the first bet.** Once betting starts, any rules change is a wealth transfer between bettors. The pass/fail thresholds, the simulant grade, the chamber spec, and the tie-break order all go into an IPFS-pinned rules document referenced by the registry entry, exactly as the tier criteria are handled in DePrize #0.

**Budget.** The $5,000 is the prize seed. MoonDAO's own operating cost should stay near zero: competitors self-fund, the host facility is a partner, and judges are volunteers with a token honorarium. The only line items worth reserving for are simulant for a common feedstock lot (LHS-1 is $45/kg retail, ~$25–35/kg for the engineering grade) and an independent materials test where the spec calls for one.

**Safety.** P1, P2, P4, P5, P6, P7 and P8 involve vacuum vessels, cryogens, or 1,000 °C+ processes. Require an implosion shield and a documented safety case with each entry, ban glass vessels above a stated volume, and require LN₂ handling in ventilated space (oxygen-enrichment and asphyxiation hazards are the ones amateurs underestimate). Entries without a safety case are disqualified at registration, not at judging.

**Compliance.** Same posture as DePrize #0 — geo-blocking, terms, and the disclosure that the prize pool is not the bettor payout pool. Nothing about an Earth-analog prize changes the market's regulatory profile.

## 7. Open questions

- Which single host facility can commit chamber time for all entrants in P1, and on what terms?
- Does the Senate want a standing three-person technical judge panel across all DePrizes, or a fresh panel per prize?
- Should generation 1 run two markets in parallel (P1 + P2 over one accumulating pool), or strictly sequentially?
- Is a 9-month sunset short enough to keep bettors engaged, given the 18-month default in DePrize #0?
- Who commits to being the first named competitor? The first name is worth more than the next three combined.
