# NIGHT SHIFT

### A DePrize for the first machine that works through a lunar night

> **CONFIDENTIAL — INTERNAL / NDA**
> Draft for advisor and expert review. Not for publication, quotation, or distribution
> outside the review list.
> **Version** 0.5-draft · **Date** 26 Aug 2026 · **Owner** MoonDAO · **Status** pre-registration,
> nothing on-chain.
> Competitor listings are editorial and based solely on public sources. No listed organization
> has been contacted, has consented, or is affiliated with this prize.

**Changes from v0.3**, all in response to advisor review:

| | v0.3 | v0.4 |
|---|---|---|
| Milestones | M1 120 h + M2 354 h, 30/70 | **One**: 354 h |
| Judging | 3-person expert referee panel | **A validator script anyone can run** |
| "Permanent asset" test | Decade Rule (referee audits energy inventory) | **Sustained Output Rule** (98% retention, read off the same CSV) |
| Procurement Rule | Referee judges "commercially procurable" | **Documentary** — produce an invoice or a published price |
| Who runs the test | MoonDAO-organised, free kits shipped | **Any chamber, any country** |
| Verification | Referee panel attends | **Independent custody of the instruments** — you may own the chamber, never the meter |
| Purse | $5,000 seed | **$25,000** |
| Deadline | 18-month sunset | **Rolling** — open until solved |

---

## 0. What we are asking you for

Destructive criticism, not approval. Questions are in [Part VII](#part-vii--open-questions).

The design now rests on three claims, and all three should be attacked:

1. **A script can judge this.** Everything that decides the outcome is a number in a data file. If you can find a way to win this prize with a file that passes the validator and hardware that shouldn't count, we have a problem.
2. **Independent custody of the instruments is enough to make that file trustworthy** — without dragging an expert back in to decide what counts. Nobody grades their own homework, but nobody exercises judgment either.
3. **The Sustained Output Rule is technology-agnostic but still grounded in what a lunar outpost actually needs.** If you think it either bans something unfairly or fails to exclude something it should, say so.

This document supersedes `DEPRIZE_SURVIVE_THE_NIGHT_SPEC.md`.

---

# PART I — ONE PAGER

## 1. Problem statement

A lunar night is **354 hours** of darkness at roughly **100 K**. Almost every spacecraft ever
landed on the Moon dies in it, or sleeps through it.

The result is that lunar surface assets are **disposable**. A CLPS lander is a two-week instrument
that becomes a monument at sunset. A rover is a machine that spends half its life unconscious.
Nothing accumulates. Every mission starts from zero, and the Moon acquires no installed base.

A sustained human presence is not possible on hardware that has to be replaced every fortnight.
Before anything else can be built there, something has to be able to **keep working**.

The technical problem is not warmth. It is **useful electrical work, continuously, without
degrading, from a source you can actually buy.**

## 2. Why it matters

### 2.1 The distinction that defines this prize: survive ≠ operate

Survival is solved. Apollo solved it in 1969. China re-solved it in 2019. A 42 g radioisotope
heater unit puts out 1.1 W of heat and will keep a small box alive indefinitely.

Operation is not solved at any useful scale, and the reason is **supply**, not physics.

Both existing proofs run on plutonium-238:

| | |
|---|---|
| US production | DOE targets 1.5 kg/yr; **actual output below 0.5 kg/yr** |
| Cost | **> $8M per kg** |
| Availability | State reserve, allocated to flagship science missions |
| A single MMRTG | ~$54M, ~$83M including launch approval |
| Can a company buy some? | **No.** Not at any price |

So the honest framing of this prize is not *"can it be done."* It is:

> **Apollo did it in 1969 with fuel you can't buy. Chang'e-4 does it today with fuel you can't
> buy, while the spacecraft sleeps. Do it awake, at ten watts, with fuel you can order.**

This is an **industrialization** milestone, not a physics breakthrough. Hold us to that framing.

## 3. Historical context

| Year | System | Output | What it proves |
|---|---|---|---|
| 1961 | SNAP-3, Transit 4A | ~2.7 We | First RTG in space |
| 1969–77 | **SNAP-27**, Apollo 12/14/15/16/17 ALSEP | **~70 We**, ~20 kg fueled | Ran for **years** through real lunar nights. The bar, set 57 years ago |
| 1970 | Lunokhod 1 | Po-210 RHU | Soviet night survival; heat only |
| 1970s– | LWRHU | 1.1 W thermal, 42 g | The workhorse. **Heat, not electricity** |
| 2013 | Chang'e-3 lander | RTG + RHUs | Instruments still alive past 60 lunar nights |
| 2019 | **Chang'e-4 lander** | **2.5 We** + 120 W thermal | See below — the closest prior art |
| 2019–26 | CLPS era | 0 We | Nearly every commercial lander dies at sunset |
| 2022– | ESA ENDURE | Am-241 | Europe builds an independent, non-Pu supply |
| 2023 | Zeno "Harmonia" SAA | $15M NASA | First funded commercial lunar night power product |
| 2025–26 | Orano offtakes; first Am-RHU core | — | Commercially procurable isotope supply becomes real |

**Chang'e-4 in detail**, because it is the strongest argument against this prize and every reviewer
will raise it:

- Lander carries three RHUs (one 120 W thermal, two 5 W) **plus a Pu-238 RTG producing 2.5 We** and
  120 W of heat. Heat source developed as a China–Russia collaboration.
- At night the spacecraft enters **sleep mode**. The bus cannot run on 2.5 We.
- The RTG powers **thermometry only** — it measured lunar soil to −196 °C. The data is **stored and
  downlinked after dawn**.
- Its own chief designer, Sun Zezhou, described the generator as *"a prototype for future deep-space
  explorations."*

So Chang'e-4 clears a 1 We bar 2.5× over. It does **not** operate, and it runs on fuel nobody can
purchase. That is the gap this prize targets.

## 4. What this unlocks

**Directly, within a few years**

- **CLPS duration**: two-week missions become month-class and beyond. The single biggest multiplier
  on the dollar-per-mission already being spent.
- **PSR operations**: inside a permanently shadowed region there is no dawn to wait for. Ice
  prospecting is night operation by definition.
- **Continuous geophysics**: a seismometer that sleeps half its life is half a seismometer. Same for
  heat flow, magnetometry, and dust monitoring.
- **Sellable days of data**: turns a lander from a delivery service into an operating asset with
  recurring output.
- **Surface mobility**: LTV and CLV-class rovers currently plan around chasing the sun.
- **An installed base.** The first piece of hardware that is still working when the next one lands
  is the beginning of infrastructure rather than a sequence of expeditions.

**What it does not unlock — say this plainly**

Nothing here scales to a habitat, a crew, or an ISRU plant. Those need kilowatts to megawatts and
remain a fission problem. Ten watts is the difference between *a dead lander* and *a working
instrument station*. It is not the difference between a lander and a base.

## 5. The prize in one table

| | |
|---|---|
| **Name** | Night Shift |
| **Question** | Who will first run 10 watts through a full lunar night? |
| **The bar** | ≥ 10 We delivered continuously for **354 hours**, at ≤ 100 K and ≤ 1×10⁻⁵ torr, on stored onboard energy only, with output undiminished at the end |
| **Milestones** | **One** |
| **Purse** | **$25,000**, growing with 5% of betting volume |
| **Judged by** | A published validator script, run on data captured by an independent verifier |
| **Where** | Any thermal-vacuum chamber, anywhere in the world |
| **Deadline** | None — rolling sunset, open until solved |
| **Roster** | 7 named systems + Open Field |

---

# PART II — PRIZE RULES v0.4

## 1. The prize in one sentence

> **Deliver at least 10 watts of electricity, continuously, for 354 hours, in a vacuum chamber
> colder than 100 kelvin, with nothing plugged in — and still be delivering the same 10 watts at
> the end. Publish the data.**

Everything below is the precise version of that sentence. There is **one milestone**. You either
cleared it or you didn't.

## 2. Definitions

**Article** — the complete system under test: every energy source, converter, storage element,
structure, insulation, and control electronic inside the chamber. Its mass is the mass of
everything you put in.

**Qualifying Run** — a continuous test satisfying §3 through §6.

**T0** — the instant the chamber first satisfies §4 with the article in its final configuration and
all external connections in their run state.

**Window** — T0 to T0 + 354 hours.

## 3. The Unplug Rule

> During the Window, **nothing crosses the chamber boundary into the article except data.**

No electrical power, heat, propellant, coolant, gas, or mass. Every joule the article spends must
have been aboard at T0 and included in its declared mass.

**Consequences, stated explicitly to prevent argument later:**

- A wall-powered electric heater standing in for a radioisotope source is **not permitted**. The
  chamber wall would be the power source.
- An electric heater **powered by an onboard battery is permitted**. It is a genuine closed-loop
  demonstration; it simply spends your own energy inventory.
- There is **no technology ban and no carve-out for nuclear.** One rule, applied identically to
  every chemistry.
- **Telemetry is signal only.** If a telemetry link draws power, that power comes from the article
  and counts against the article, not as delivered output.

## 4. Environment

| Parameter | Requirement |
|---|---|
| Pressure | ≤ 1×10⁻⁵ torr throughout. Excursions to 1×10⁻⁴ permitted, ≤ 60 min cumulative |
| Radiative sink | **≤ 100 K** on all shroud sensors. LN₂ at 77 K qualifies |
| Conduction | No surface in contact with the article above 100 K |
| Illumination | None |
| Instrumentation | ≥ 4 shroud thermocouples and chamber pressure logged at ≥ 0.1 Hz for the full Window |

**Note on accessibility.** LN₂ satisfying the shroud spec is deliberate. A qualifying chamber can be
a dewar-jacketed bell jar. Boil-off for a small article runs roughly 20–60 L/day — on the order of
$300–1,800 of nitrogen for the full 354 hours. **We want this winnable outside a national
laboratory.** The binding constraint is not money, it is holding a chamber for fifteen days.

## 5. Output

| Requirement | Value |
|---|---|
| Delivered power | **≥ 10.0 We** averaged over every rolling 60-minute window |
| Instantaneous floor | **≥ 5.0 We** at all times |
| Maximum gap | No interval > 60 s below the floor |
| Load | A real electrical load, with V and I both measured **at the load**, logged at ≥ 1 Hz |

The rolling average and the instantaneous floor exist together so that a large burst cannot
substitute for continuous operation.

**Why 10 We.** Four times Chang'e-4's entire nighttime electrical budget. It is the line between *a
thermometer running while the spacecraft sleeps* and *a lander doing work* — a real radio, a real
computer, a heated instrument.

## 6. The Sustained Output Rule

> Mean delivered power over the **final hour** of the Window must be **≥ 98%** of mean delivered
> power over the **first hour**.

This is the rule that grounds the prize in what a sustained presence actually requires, without
naming a single technology.

An asset whose output decays across one night is not infrastructure — it is a consumable with a
fortnight of runway, which is the problem we are trying to retire. An asset that ends the night
exactly as strong as it started can do it again next month, and the month after.

The rule is deliberately blind to how you achieve it:

| Source | Decay over 354 h | Result |
|---|---|---|
| Am-241 (432 yr half-life) | ~0.007% | Passes without trying |
| Sr-90 (29 yr half-life) | ~0.1% | Passes without trying |
| Pu-238 (88 yr half-life) | ~0.03% | Passes without trying |
| Fuel cell sized to the Window | Cliff at the end | Fails unless oversized |
| Primary battery sized to the Window | Sags then collapses | Fails unless oversized |

Any chemistry can pass it. Consumables simply have to be oversized enough that 354 hours is a small
bite out of their inventory — which is precisely the property we want, and it costs them mass,
which the scoreboard then reports.

**This replaces the Decade Rule from v0.3.** That rule required an expert to audit a proprietary
energy inventory. This one is two numbers from the same file the validator already reads.

## 7. The Procurement Rule

> The article's energy source must be **commercially procurable**, evidenced by **a purchase order,
> an invoice, or a supplier's published price**. The document, or its price and lead time, is
> published with the results.

**This is not a technology ban.** It says nothing about which physics you use. It says the answer
must be one that someone else could buy.

| Source | Status |
|---|---|
| DOE Pu-238 | **Fails** — a government furnishing, not a purchase. No invoice exists |
| Chinese or Russian state Pu-238 | **Fails** — same reason, applied identically |
| Am-241 (Orano, NNL, QSA Global) | **Passes** — ~$1,500/g, offtakes exist today |
| Sr-90 | **Passes** — reprocessing byproduct |
| Batteries, chemical, fuel cells | **Passes** — off the shelf |

**v0.3 asked a referee whether a supplier "could deliver a second unit within 24 months."** That was
an opinion. v0.4 asks whether a document with a price on it exists. Yes or no.

A useful side effect: nationality never enters the rules. A Chinese entry does not fail for being
Chinese. It fails on the merits if its fuel came out of a state reserve, exactly as a US entry using
DOE plutonium would.

**Cost reality, for calibration.** At Stirling-class conversion Am-241 runs roughly **$136,000 of
fuel per watt electric**, so a 10 We isotope source is ~0.9 kg of americium and ~$1.4M in fuel
alone. Expect the first clearance to come from a battery or chemical system, and the first *good*
one to come from an isotope.

## 8. Qualifying Evidence, and who judges

**Nobody judges. A script does.**

MoonDAO publishes an open-source validator. It takes the data files and returns pass or fail.
Anyone — a bettor, a rival, a journalist — can download it and run it on the same files and get the
same answer.

That only works if the files are trustworthy, which is what §9 is for. **The script decides the
answer; an independent verifier vouches for the inputs.**

### 8.1 What must be published

| # | Item | Produced by |
|---|---|---|
| 1 | Load voltage and current, ≥ 1 Hz, covering the full Window | **Verifier** (§9) |
| 2 | Chamber pressure and ≥ 4 shroud temperatures, ≥ 0.1 Hz, same Window | **Verifier** (§9) |
| 3 | Article mass, with a photograph of the sealed weigh-in | **Verifier** (§9) |
| 4 | Feedthrough inventory: every conductor through the panel and what it carries; how the article is mounted | **Verifier** (§9) |
| 5 | The signed verification statement | **Verifier** (§9) |
| 6 | The procurement document (§7) | Entrant |
| 7 | All of the above under an open licence | Entrant |

### 8.2 What the validator checks

Entirely from items 1 and 2:

```
min(rolling_60min_mean(P))      >= 10.0 W
min(P)                          >= 5.0 W
max_contiguous_seconds(P < 5.0) <= 60
mean(P[-1h]) / mean(P[0:1h])    >= 0.98
duration                        >= 354 h, contiguous
max(shroud_T, all sensors)      <= 100 K
max(pressure)                   <= 1e-5 torr, except <= 60 min cumulative up to 1e-4
```

If the script passes and the checklist in §8.1 is complete, the claim is good. The Senate's role is
to confirm the checklist is complete and the script was run — clerical, not technical.

### 8.3 Any chamber, any country

A Qualifying Run does **not** have to be organised by MoonDAO or held at a MoonDAO venue. Use your
own chamber, a university's, or a commercial lab's, in any jurisdiction — provided §9 is satisfied.

Pre-registration is welcome and will be publicised, but it is not required.

## 9. Independent verification

> **You may own the chamber and you may own the article. You may never own the instruments or the
> data.**

The party that calibrates, installs, seals, and reads the measurement chain must be independent of
the entrant.

### 9.1 Why this does not reintroduce expert judgment

The verifier does **not** decide whether an entry counts. The validator does that, and it is a
script. The verifier attests only to facts a competent person can observe:

- the article weighed this much, and was sealed
- the feedthrough panel contained exactly these conductors, carrying exactly these signals
- these sensors were the verifier's own, calibrated to these certificates
- these files came off those sensors, unaltered
- the seals were intact at the end

**Observation is not judgment.** A verifier needs no opinion about lunar power systems, no view on
whether a design is clever, and no ability to adjudicate a grey area — because there aren't any left
to adjudicate. That is what lets us add independence without giving back what we gained by deleting
the referee panel.

### 9.2 Accepted verifiers

| Route | Who | Cost to entrant | Fits |
|---|---|---|---|
| **A** | An ISO/IEC 17025-accredited test laboratory hosting the run | **~$0 marginal** — this is already what a test report is | Funded entrants |
| **B** | An independent verification body attending the entrant's own chamber — DNV, TÜV, Bureau Veritas, Lloyd's Register, Element, NTS, Intertek | **~$3–8k**, two site visits | Mid-size entrants |
| **C** | A MoonDAO sealed metrology package plus a MoonDAO-appointed observer | Shipping and observer travel | Open Field |
| **D** | A MoonDAO-hosted trials event (Part VI) | Included | Everyone, once it exists |

**Disqualifying relationships.** An employee, contractor, investor, board member, adviser, or family
member of the entrant. Anyone holding a position in the market on any outcome. Any organisation
receiving funding from the entrant. Conflicts are declared in writing and published.

Route B is the load-bearing one and it is not exotic. Verification bodies certify performance claims
for batteries, hydrogen systems and grid equipment as routine business. They do not need to
understand lunar anything; they need to own a meter and sign their name.

### 9.3 The observation protocol — two attended days, not 354 hours

**Day 0.** The verifier weighs and photographs the article, applies tamper-evident seals, inventories
every conductor at the feedthrough panel and records what each one carries, installs and calibrates
their own load and environment sensors, then starts the log and the witness video.

**Day 15.** The verifier confirms the seals are intact, stops the log, takes custody of the raw
files, and publishes them with a signed statement.

Nothing between those two days is attended. Tamper-evident seals plus continuous video cover the
gap, which is what keeps verification affordable — the cost is two person-days and travel, not two
weeks of standing watch.

### 9.4 Self-published and retroactive claims

A test MoonDAO did not organise still qualifies, **but only if independent custody was in place at
the time.** An accredited laboratory's own test report generally satisfies this. A company's internal
test does not, however good the data and however open the licence.

In practice most historical tests will fail on the feedthrough inventory, which nobody records unless
someone is specifically looking for smuggled energy. Expect claims to be prospective.

## 10. Restarts, excursions, and ties

**Excursions.** Exceed the §4 budget and the run is void. Restarting is free and unpenalised with a
fresh T0. A facility compressor failure is not the entrant's fault, and there is no limit on
attempts.

**Ties.** Earlier verified end-of-Window timestamp wins.

**Rules changes.** The rules freeze when the market opens. Afterwards, only clarifications that
cannot change an outcome, published as a dated addendum. The validator script is versioned and
pinned at open.

## 11. Roster and eligibility

Teams **claim** — they do not apply. Listing is editorial and does not imply participation,
endorsement, or affiliation. Any qualifying entrant not named competes through the **Open Field**
slot. The outcome set is frozen when the market opens and can never be resized; changing it requires
a new generation (§IV).

## 12. What this test does not prove

Stated in the rules so nobody has to discover it later. A terrestrial chamber does not reproduce
regolith conduction, dust, one-sixth gravity, launch vibration, or the radiation environment. A
100 K shroud is warm relative to a ~40 K permanently-shadowed crater floor. Clearing this bar makes
a system credible for a lunar night; it does not qualify it for flight.

## 13. Safety

Entrants are responsible for their own safety, insurance, and regulatory compliance. Radiological
work must be conducted under valid licence at a licensed facility in any jurisdiction;
security-sensitive parameters may be redacted, but the §8.2 data may not. MoonDAO does not direct,
supervise, fund, or supply entrant work.

We note this section matters because §4 deliberately makes the prize accessible to small teams
working with liquid nitrogen and vacuum vessels.

---

# PART III — COMPETITORS

Seven named systems plus Open Field. Selected on one rule: **compete systems, not hosts.** If
Firefly flies Zeno's box, that is one result and it belongs to Zeno.

## Slot 0 — Zeno Power (US)

Founded 2018, spun out of Vanderbilt; radioisotope power using Sr-90 and Am-241 rather than
plutonium. The only named commercial lunar night-power **product** in existence.

**Harmonia** is a NASA 2023 Tipping Point **funded Space Act Agreement** — $15M from NASA,
milestone-paid, with Zeno carrying 10–25% cost share over up to four years. It is not a FAR
contract: Zeno owns the design, and NASA is buying the option to purchase a product later.
Subcontractors include Sunpower (Stirling convertors), Blue Origin (convertor integration),
Intuitive Machines (~$2.4M lander interface, constraining the unit to fit a Nova-class lander),
UDRI, NASA Glenn and Marshall.

Public milestones: **FDR complete April 2026 at 3.5× the original power specification**; currently
building an **electrically heated** Stirling and lander rig; terrestrial demonstration **early 2027**
covering EMI, lunar-condition TVAC and vibration, targeting Stirling TRL 6; real Am-241 heat source
to TRL 5 **mid-2027** against an **Orano La Hague offtake signed September 2025**;
flight-qualification transition from 2028. Note that **the end state of the $15M is not a fueled
lunar night.**

Separately, Zeno supplies a **5 W thermal Am-241 RHU** for Firefly's CLPS CS-8 "Survive-the-Night
Package" on Blue Ghost, NET 2028, against a ~$15M task order with a 120-hour beacon bonus. A parallel
Sr-90 line serves DoD and Navy programs (DEPTHS, STRATFI).

**Read.** The favourite, and the Sustained Output Rule is almost free for them — an isotope source
decays by fractions of a percent over fifteen days. Two frictions: their marquee 2027 demonstration
is electrically heated, which counts only if the heater draws on onboard stored energy; and 10 We of
americium is ~$1.4M of fuel. Their Sr-90 line may be the faster route to a fueled closed-loop run.

## Slot 1 — Astrobotic, NITE (US)

Pittsburgh. NITE is a **non-nuclear** lunar night power system — chemical and fuel-cell based —
funded by a ~$2.8M NASA Tipping Point award. Thermal-vacuum testing at Penn State encountered
leakage and an oxidizer pump failure under vacuum. Assessed at roughly TRL 4.

Astrobotic's wider record is mixed and relevant: Peregrine Mission One failed in January 2024;
Griffin follows; the company will fly Venturi Astrolab's FLIP rover in late 2026.

**Read.** The only serious non-nuclear operate-through system with dedicated funding, and no
licensing friction. The Sustained Output Rule is the live question: a fuel cell sized exactly to 354
hours will be sagging at the end and fail the 98% check. Oversizing fixes it and costs mass.

## Slot 2 — Venturi Space (Monaco / Switzerland / France)

Batteries designed and assembled in Monaco, hyper-deformable wheels in Switzerland, onboard
electronics and BMS in Toulouse. Strategic partner of US-based Venturi Astrolab, which NASA selected
in May 2026 to provide **CLV-1**, a crewed lunar vehicle targeted to reach the Moon by 2028.

The relevant capability is the battery. Packs are qualified across **−240 °C to +130 °C** — a 33 K
low, far below our 100 K shroud. Cell screening is severe: of 10,000 cells delivered, ~80% are
selected, after **endurance simulations over lunar cycles under vacuum**, plus short-circuit,
overload, over-discharge, vibration, shock, impact, vacuum and radiation testing. The BMS monitors
every cell voltage at 10 ms intervals. Their rovers — FLIP (450 kg, flying on Astrobotic late 2026),
CLV-1, and Mona Luna (750 kg, ESA/Argonaut, 2030) — are all advertised as designed to survive
multiple lunar nights.

**Read.** The fastest possible clearance on the board. Non-nuclear, no licensing friction, and
**vacuum lunar-cycle endurance testing is already inside their qualification flow** — we would
largely be asking them to instrument and publish a test they run anyway. The 98% rule forces them to
oversize; the scoreboard will then show exactly what that costs in kilograms.

## Slot 3 — Perpetual Atomics + University of Leicester (UK)

Leicester has led European americium radioisotope power since 2010; **Perpetual Atomics** spun out in
2024 and is based at Space Park Leicester. Work runs under ESA's **ENDURE** programme (European
Devices Using Radioisotope Energy), begun 2022 within GSTP, funded by the UK Space Agency in
collaboration with the US.

Recent milestones: **November 2025**, high-velocity impact testing of a welded platinum-alloy clad
with a purpose-built inactive fuel simulant. **December 2025**, Orano La Hague Am-241 offtake.
**April 2026**, with QSA Global of Burlington MA, the **first americium-fuelled RHU full-scale
core** — ceramic Am-241 pellets in metal containment. Also April 2026, a Generation 5 Am-RHU
structural thermal model passed **25 G sine and 28 Grms random** vibration and was thermally cycled
**+80 °C to −70 °C in vacuum**.

**Read.** Genuine, fast-moving, the most credible European entrant. Two gaps: −70 °C is 203 K,
nowhere near our 100 K spec; and an RHU produces **heat**, so they need a convertor to deliver watts
electric.

## Slot 4 — CNNC / China Institute of Atomic Energy (China)

With CAST as spacecraft integrator. **The only organization besides Apollo with flight-proven lunar
night electricity.**

Chang'e-3 (2013) placed an RTG and RHUs on the lander; its instruments were still operating past 60
lunar nights. Chang'e-4 (January 2019, far side) carries three RHUs and a Pu-238 RTG delivering
**2.5 We** plus 120 W thermal, with the heat source developed as a China–Russia collaboration.
Yutu-2 broke Lunokhod 1's longevity record in November 2019.

Institutionally the signal is stronger than the hardware. China issued **GB/T 44319-2024**, a
*national standard* for "Radioisotope thermoelectric generator of lunar and deep space probe," in
force since March 2025 — standardization implies productionization. A 2026 CNNC/CIAE paper sets out
Pu-238 RTGs for the ILRS south pole as emergency backup, primary power, or heat source, explicitly
including PSR work. Chang'e-7 launched around 24 August 2026 for the Shackleton rim, but on solar
with a follow-the-light and hibernation strategy. Chang'e-8 follows around 2028–29.

**Read.** Deepest relevant flight heritage on the board, and the prior art most likely to be cited
against this prize. Would have to clear the **Procurement Rule**, which state Pu-238 does not.
Realistically will not claim.

## Slot 5 — Rosatom / Krasnaya Zvezda / Kurchatov Institute (Russia)

Heritage runs from Lunokhod's Po-210 heaters through the RORSAT and TOPAZ reactor programmes.
Luna-25 carried a radioisotope unit and crashed in August 2023.

Current activity sits at two very different scales. Valery Efremov of the Sarov nuclear centre has
described small **RTG-based power plants** with ≥10-year autonomous operation, intended to prepare
ILRS infrastructure. Far larger is **Selena** — Roscosmos, Rosatom and the Kurchatov Institute,
5–10 kWe, ten-year life, likely lead-bismuth cooled, derived from the Elena-AM terrestrial SMR. NPO
Lavochkin signed the build contract in December 2025; prototype 2032, support missions 2033–34,
power module delivered 2035, operational 2036. Luna-26 orbits in 2028, Luna-27A reaches the south
pole in 2029, 27B the north in 2030.

**Read.** Real heritage and, because Russia reprocesses spent fuel, a legitimate Sr-90 and Am-241
supply route. But nothing at watt scale on a near timeline — Selena is a reactor, wrong scale and
wrong decade. Expect it to price low.

## Slot 6 — ISRO / BARC (India)

Chandrayaan-3 landed in August 2023 on solar power and did not survive its first night. A BARC- and
ISRO-developed **RHU flew on that mission as a technology demonstrator — on the propulsion module,
not the lander**, because the integration came too late to change the lander design.

ISRO and the Department of Atomic Energy are now developing Am-241 RHU-based heating to extend
lander life from 14 days to **100–200 days**, with protection claimed to −180 °C. Chandrayaan-4
sample return follows around 2027–28; Chandrayaan-5 / **LUPEX** with JAXA, approved March 2025 and
launching NET 2028 for a mission of well over 100 days, is ISRO's named lunar-night-survival
demonstrator. Notably, the JAXA-built LUPEX rover **dropped RHUs for insulation** after a
mass-driven redesign. Project director P. Veeramuthuvel: *"we have to have a nuclear resource."*
PRL's Santosh Vadawale: *"RTG still will be a little bit away."*

**Read.** A real, funded, publicly stated night programme — aimed at **heat, not watts**. India
reprocesses spent fuel, so the supply route is sound. Unlikely to claim.

## Slot 7 — OPEN FIELD

Any qualifying entrant not named above: university laboratories, unannounced startups, national labs,
small teams. Bettors backing this slot do not know which entity they are backing — the standard
"field" instrument, disclosed as such.

§4 permits an LN₂-shrouded bell jar and §8.3 permits a self-published run, so the Open Field is a
genuine threat rather than a formality. The binding constraint on a small team is not money — it is
holding a chamber for fifteen continuous days.

## Considered and deliberately excluded

| Organization | Why not |
|---|---|
| Firefly Aerospace | **Host.** Its CS-8 package is Zeno's 5 W thermal RHU |
| Intuitive Machines | **Customer.** CS-8 Am-241 RHU for Aug 2028, vendor unnamed, requires NASA indemnification. Also a Harmonia subcontractor |
| Blue Origin | Harmonia subcontractor; Blue Alchemist is ISRU solar, not night power |
| SpaceX | HLS is solar plus batteries and fuel cells at crew scale. Not in this race |
| ispace | **Host** for Zeno's planned 2027 demonstration |
| JAXA | No radioisotope power programme; LUPEX rover dropped RHUs |
| QSA Global, Sunpower, Orano | Component and fuel suppliers — fold into the system entries |
| City Labs | Tritium; BOHR CubeSat July 2026 produced µW. Four orders of magnitude short |
| Betavolt | Betavoltaic cells at ~100 µW |
| entX | Suborbital RHU demonstration, duration in minutes |
| Advanced Cooling Technologies | $5M heat-pipe toolbox — parts, not a system |
| NASA Glenn | Hibernation research (S3R cold start at 57 K; 18650 freeze/thaw at 50 K). **Survive and wake, not operate.** Better as a facility partner and as public contrast |

---

# PART IV — MECHANISM

Night Shift runs on MoonDAO's existing DePrize infrastructure. Bettors buy outcome tokens on named
competitors through an LMSR market; 5% of betting volume accrues to a Juicebox prize pool; the Senate
settles the winner. See [DEPRIZE.md](DEPRIZE.md) and
[DEPRIZE_ROSTER_CHANGES.md](DEPRIZE_ROSTER_CHANGES.md).

| Item | Value |
|---|---|
| Purse | **$25,000**, plus 5% of betting volume |
| Outcome slots | **8** — frozen at market open, can never be resized |
| Deadline | **Rolling** (see below) |
| Resolution | Validator script → checklist confirmation → Senate vote → Safe transaction |

## Open until solved, in practice

There is no way to register a DePrize with no deadline. `register` reverts with `InvalidSunset`
unless the sunset is in the future
([DePrizeRegistry.sol:92](../subscription-contracts/src/deprize/DePrizeRegistry.sol)).

But `setSunset` has since shipped, and outside `DRAFT` it is **extend-only** — a sunset can always be
pushed out and can never be pulled in
([:124-136](../subscription-contracts/src/deprize/DePrizeRegistry.sol)). That gives us what was
actually wanted, and gives bettors something better than an open-ended market: **a date that can only
ever move away from them.**

**Recommended operation.** Register with a 24-month sunset. Review annually and extend by 12 months
while the prize is unclaimed. The market never expires in practice; the pool keeps accumulating; no
one is ever surprised by an early close.

**When the roster changes**, use `supersede` — also now shipped
([:166](../subscription-contracts/src/deprize/DePrizeRegistry.sol)) — which forks onto a new roster
while keeping the same Juicebox project, and therefore the same accumulating pool. Prefer extending
the sunset over superseding: extension keeps one liquid market, while superseding leaves the old
generation sell-only until settlement.

## One milestone, two contract calls

The registry hard-codes a two-tranche payout: `SETTLED → M1_RELEASED (30%) → M2_COMPLETE (70%)`.
With a single milestone, **call `releaseM1` and `completeM2` in the same Safe batch.** The 30/70
split becomes an implementation detail that no entrant or bettor ever sees. Flagging it so whoever
runs the deployment is not surprised by the state machine.

---

# PART V — THE SCOREBOARD

The prize may go years without being claimed. The **scoreboard** is what makes that fine, and it is
arguably the more valuable artifact.

MoonDAO publishes a standing public table of every listed competitor's **best publicly verified
result against this exact standard** — watts, hours, sink temperature, output retention, mass,
source and price. Most cells will start empty or say *"not publicly demonstrated."*

This does three things:

1. **It is the disclosure engine.** Organisations correct records that show them behind. An empty
   cell next to a rival's filled one is an argument inside their own building.
2. **It gives the market something to price** every month, rather than one binary event years out.
3. **It works from day one**, with no entrants, no venue, and no chamber.

Alongside it, a records ladder that keeps running after the prize is claimed: **specific energy**
(Wh delivered per kg), **output retention**, **cost per watt-year**, and **projected repeat cycles**.
This is where a 40 kg battery and a 4 kg RTG that both cleared the same bar get told apart in public
without either being disqualified.

---

# PART VI — A TESTING FACILITY (future track, not a launch dependency)

Nothing in Part II requires MoonDAO to own or book a chamber. That is deliberate — chamber access was
the single most likely quiet killer of the v0.3 design, and §8.3 keeps it off the critical path.

It remains the most interesting thing we could build second, and it now has two justifications rather
than one. **Fifteen continuous days of cryoshrouded vacuum is the real barrier to entry**, and
whoever lowers it decides how large the field gets — but a MoonDAO-hosted event is also **verification
Route D**, the strongest and cheapest form of independence available to a small team. Own the venue
and the independence problem solves itself for everyone who shows up.

**Shape of the event.** A 15-day soak cannot be a live event, but it can be bracketed by two:

| Phase | Format |
|---|---|
| Load-in day | Public, streamed. Weigh-in, sealing, cold-soak start |
| 354-hour soak | Unattended. Live public telemetry dashboard, running leaderboard |
| Dawn day | Public, streamed. Shroud up — who is still delivering ten watts |

Multiple articles can share one shroud provided each has an isolated mount and its own feedthrough
allocation; chamber volume and feedthrough count set the field size.

**Partnering rather than building.** A dedicated chamber sized for several 10–20 kg articles is
plausibly $30–80k of capital plus operating cost, which is more than the purse. Partnering is likely
better. Candidate hosts, with the conflict position noted:

| Host | Note |
|---|---|
| Commercial labs — Element, NTS, Intertek, Wyle | Conflict-free by construction; they sign test reports as core business. Costs $2–10k/day |
| NASA Glenn (Armstrong Test Facility) | Large chambers, and there is **direct precedent**: Watts on the Moon ran its finals in Glenn's vacuum chambers. Slow to arrange; arguably conflicted via Harmonia |
| Non-conflicted university centres — Colorado/LASP, Purdue, Texas A&M, ASU, Colorado School of Mines | Cheaper, slower, variable capability |
| Penn State ARL | **Conflicted** — Astrobotic's test house |
| Space Park Leicester | **Conflicted** — Perpetual Atomics' home |

Recommended sequencing: launch the market and the scoreboard with no venue, and open facility
conversations in parallel. If a partner materialises, the trials become an additional route to
qualifying evidence, never the only one.

---

# PART VII — OPEN QUESTIONS

1. **Can you beat the validator?** Find a data file that passes §8.2 with hardware that shouldn't
   count. This is the highest-value thing a reviewer can do.
2. **Is 98% the right retention threshold?** It is trivial for any isotope and hard for any
   consumable. Too tight, too loose, or measuring the wrong thing?
3. **Is 10 We right?** 4× Chang'e-4, and ~$1.4M of americium for an isotope entry. Correct, or should
   it be 5 We?
4. **Is two attended days enough independence?** Seals and video cover the 350 hours in between. Can
   you defeat that, and would a third mid-run spot check be worth its cost?
5. **Would a verification body actually take this?** Route B assumes DNV, TÜV, Element or similar
   will witness a fifteen-day cryogenic vacuum test for a few thousand dollars. Is that realistic
   pricing, and does anyone have a relationship worth using?
6. **Does the verification cost price out the Open Field?** Route B at $3–8k on top of chamber time
   may be the difference between a university team entering and not. Should MoonDAO fund Route C
   metrology packages out of the purse, and if so at what cost to the headline number?
7. **Is the wall-power ban correct?** It means Zeno's flagship 2027 demonstration does not count
   unless reconfigured. Honest rigour, or self-defeating?
8. **Who did we miss?** Especially outside the US and Europe, and especially non-nuclear approaches.
9. **Does an unclaimed prize with a live scoreboard read as patient, or as failed?** The design bets
   heavily on the former.
10. **Is $25k the right purse** given it is roughly 50–100% of the cheapest credible attempt, ~10–25%
    of a corporate one, and ~1% of a nuclear one?

---

## Appendix A — Principal sources

Horvath, Hayne & Paige, *GRL* 49 (2022) — lunar thermal environments · NASA RPS Program
commercialization status, IEEE 2025 · GAO-17-673 — Pu-238 production · DOE ORNL Pu-238 shipment
releases · *Nuclear Systems Used for Space Exploration by Other Countries* (Chang'e RTG/RHU figures)
· CAST statements via SCIO, January 2019 · GB/T 44319-2024 · CNNC/CIAE, *Prospects of ²³⁸Pu RTGs in
Lunar Scientific Research Station*, 2026 · University of Leicester / Space Park Leicester releases,
Nov 2025 and Apr 2026 · UNOOSA A/AC.105/C.1/2026/CRP.17 — ESA RPS and NLSAP · NEI, WNN and TASS on
Selena and Lavochkin · Venturi Space technical pages · NASA Tipping Point award announcements ·
NASA Watts on the Moon Challenge · Planetary Society and Wikipedia mission summaries for Chang'e-7
and LUPEX.
