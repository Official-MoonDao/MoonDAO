# NIGHT SHIFT

### A DePrize for the first purchasable lunar-night power system

> **CONFIDENTIAL — INTERNAL / NDA**
> Draft for advisor and expert review. Not for publication, quotation, or distribution
> outside the review list.
> **Version** 0.3-draft · **Date** 25 Aug 2026 · **Owner** MoonDAO · **Status** pre-registration,
> nothing on-chain.
> Competitor listings are editorial and based solely on public sources. No listed organization
> has been contacted, has consented, or is affiliated with this prize.

---

## 0. What we are asking you for

This document is a request for destructive criticism, not approval. The specific questions are
in [Part V](#part-v--questions-for-reviewers). If you read only one section, read that one, then
§2.1 and §II.5.

Three things we most want challenged:

1. **Is 10 We the right floor?** We raised it from 1 We after concluding that Chang'e-4 already
   clears 1 We in flight.
2. **Is the Procurement Rule enforceable?** It is the load-bearing novelty of this prize and the
   easiest thing to get wrong.
3. **Have we mis-scoped the claim?** We assert this has never been done. We would rather find out
   from you than from a reviewer on launch day.

This document supersedes `DEPRIZE_SURVIVE_THE_NIGHT_SPEC.md`, whose 1 kg mass cap and
no-radioisotopes clause were technology-banning and outcome-blind.

---

# PART I — ONE PAGER

## 1. Problem statement

A lunar night is **354 hours** of darkness at roughly **100 K**. Almost every spacecraft ever
landed on the Moon dies in it, or sleeps through it.

The result is that lunar surface assets are **disposable**. A CLPS lander is a two-week instrument
that becomes a monument at sunset. A rover is a machine that spends half its life unconscious.
Nothing accumulates. Every mission starts from zero, and the Moon acquires no installed base.

The technical problem is not warmth. It is **useful electrical work, continuously, from a source
you can actually buy.**

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

This is an **industrialization** milestone, not a physics breakthrough. Reviewers should hold us to
that framing and tell us if it is too modest to be worth doing.

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

**What it does not unlock — say this plainly**

Nothing here scales to a habitat, a crew, or an ISRU plant. Those need kilowatts to megawatts and
remain a fission problem. Ten watts is the difference between *a dead lander* and *a working
instrument station*. It is not the difference between a lander and a base.

## 5. The prize in one table

| | |
|---|---|
| **Name** | Night Shift |
| **Question** | Which team will first complete a verified 120-hour closed-loop lunar-night operating run at ≥ 10 We? |
| **Environment** | ≤ 1×10⁻⁵ torr, radiative sink ≤ 100 K, terrestrial thermal-vacuum chamber |
| **Core rule** | **Nothing crosses the chamber boundary into the article except data** |
| **Second rule** | The energy source must be **commercially procurable**, with price and lead time published |
| **M1 — market resolves, 30%** | 120 continuous hours at ≥ 10 We |
| **M2 — 70%, 18 months** | 354 h + dawn transition + 72 h, plus a **decade-class energy inventory** |
| **Seed** | $5,000; pool grows from 5% of betting volume |
| **Roster** | 7 named systems + Open Field |
| **Sunset** | 18 months |

---

# PART II — PRIZE RULES v0.3

## 1. Definitions

**Article** — the complete system under test, including every energy source, converter, storage
element, structure, insulation, and control electronics inside the chamber. Its mass is the mass of
everything the team put in.

**Qualifying Run** — a pre-registered, referee-witnessed test satisfying §2 through §6.

**T0** — the instant the chamber first satisfies §3 with the article in its final configuration and
all external connections in their run state.

**Night phase** — any period during a Qualifying Run when §3 is satisfied and no illumination is
applied.

## 2. The Unplug Rule

> During any night phase, **nothing crosses the chamber boundary into the article except data.**

No electrical power, heat, propellant, coolant, gas, or mass. Every joule the article spends must
have been aboard at T0 and included in its declared mass.

### 2.1 Consequences, stated explicitly to prevent argument later

- A wall-powered electric heater standing in for a radioisotope source is **not permitted**. The
  chamber wall would be the power source.
- An electric heater **powered by an onboard battery is permitted**. It is a genuine closed-loop
  demonstration; it simply spends the team's own energy inventory, which matters at M2.
- There is **no technology ban and no carve-out for nuclear.** One rule, applied identically to
  every chemistry.

**2.2 Telemetry** — signal only. If a telemetry link draws power, that power comes from the article
and counts as parasitic load, not as delivered output.

**2.3 Boundary control** — a single feedthrough panel, sealed by the referee. Every conductor
entering the chamber is metered and logged for the duration.

## 3. Environment

| Parameter | Requirement |
|---|---|
| Pressure | ≤ 1×10⁻⁵ torr. Excursions to 1×10⁻⁴ permitted, ≤ 60 min cumulative |
| Radiative sink | ≤ 100 K across ≥ 90% of the article's view factor. **LN₂ at 77 K qualifies** |
| Conduction | No surface in contact with the article above 100 K. Parasitic conduction through mounts and sense leads budgeted and measured at < 0.1 W |
| Illumination | Zero during night phases |
| Instrumentation | ≥ 4 shroud thermocouples and chamber pressure logged at ≥ 0.1 Hz for the entire run |

**Note on accessibility.** LN₂ satisfying the shroud spec is deliberate. A qualifying chamber can be
a dewar-jacketed bell jar; boil-off for a small article runs roughly 20–60 L/day, on the order of
$500–1,500 of nitrogen for a full campaign. **We want this winnable outside a national laboratory.**
Reviewers should tell us if 100 K is too generous — see Part V, Q5.

## 4. Load and measurement

MoonDAO supplies a **Standard Night Load** kit free to every pre-registered attempt: a cold-tolerant
wirewound resistive bank inside the chamber, with precision metrology outside on the feedthrough
panel. External metrology is measurement-only and adds no energy.

| Requirement | Value |
|---|---|
| Delivered power | **≥ 10.0 We** averaged over any rolling 60-minute window |
| Instantaneous floor | **≥ 5.0 We** at all times |
| Maximum gap | No output below floor for > 60 s |
| Logging | V and I at the load, ≥ 1 Hz, calibrated, certificates filed |

The rolling average and the instantaneous floor exist together so that a large burst cannot
substitute for continuous operation.

**Why 10 We.** Four times Chang'e-4's entire nighttime electrical budget. It is the line between *a
thermometer running while the spacecraft sleeps* and *a lander doing work* — a real radio, a real
computer, a heated instrument. Our earlier draft used 1 We, benchmarked against a 1.1 W thermal RHU.
That benchmark was wrong once Chang'e-4 is on the table.

## 5. The Procurement Rule

> The article's energy source must be **commercially procurable**. Evidence: a purchase order, an
> offtake agreement, or a published price and lead time, from a supplier who could deliver a second
> unit within 24 months. **The price and lead time are published as part of the record.**

**This is not a technology ban.** It says nothing about which physics you use. It says the answer
must be one that someone else could buy.

| Source | Status |
|---|---|
| DOE Pu-238 | **Fails** — state reserve, < 0.5 kg/yr, not for sale |
| Chinese or Russian state Pu-238 | **Fails** — same reason, applied identically |
| Am-241 (Orano, NNL, QSA Global) | **Passes** — ~$1,500/g, offtakes exist today |
| Sr-90 | **Passes** — reprocessing byproduct |
| Batteries, chemical, fuel cells | **Passes** |

A useful side effect: nationality never enters the rules. A Chinese entry does not fail for being
Chinese; it fails on the merits if its fuel comes from a state reserve, exactly as a US entry using
DOE plutonium would.

**Cost reality, for calibration.** At Stirling-class conversion, Am-241 runs roughly **$136,000 of
fuel per watt electric**. A 10 We isotope source is therefore ~0.9 kg of americium and ~$1.4M in
fuel alone. This is why we expect M1 to be won by a battery or chemical system and M2 to require a
funded program.

## 6. Milestones

### M1 — FIRST LIGHT · the market resolves here · 30% of pool

- **120 continuous hours** satisfying §2 through §5.
- Chosen to align with the NASA CLPS CS-8 survive-the-night bonus, so the number already carries
  meaning in industry.
- **No endurance requirement.** Batteries, chemical, hibernation, isotope — all eligible. This is
  the open bar.

### M2 — THE LONG NIGHT · 70% · within 18 months of M1

One unbroken chamber campaign, approximately 19.5 days:

1. **354 continuous hours** at ≥ 10 We under full spec.
2. **Verified dawn transition** — shroud raised, ≥ 12 hours, article remains functional.
3. **Return to ≤ 100 K and ≥ 72 further hours** at ≥ 10 We.

Plus:

> **The Decade Rule.** At T0 the article must carry an available energy inventory of
> **≥ 876,600 Wh** of output at the demonstrated power level — ten years at 10 We — verified by
> referee audit of the declared source.

Step 3 is the permanence proof: *fifteen days dark, wake up, keep going.* The Decade Rule is what
separates a permanent asset from a large battery. A battery clearing it would weigh roughly two
tonnes.

**Consequence, disclosed:** the market resolves at M1, so a team can win the market and the 30% and
then fail M2. Bettors are paid in full at M1 from a separate pool; the unearned 70% returns to the
prize pool. This is designed behaviour.

## 7. Pre-registration

Mandatory for any market-resolving attempt. Declare **≥ 14 days ahead**; a referee is assigned; T0
is announced publicly. Every pre-registered run is published, pass or fail — no cherry-picking.
Retroactive claims may be adjudicated only with complete raw data and facility countersignature.

## 8. Verification and referees

A three-member **Night Operations Review Panel**: one cryogenic/TVAC test engineer, one space power
systems engineer, one member literate in radiological licensing. Independent of every listed
competitor, with published conflict disclosures. **Two of three** must sign. The panel issues the
technical finding; the **MoonDAO Senate votes on the memo**. The Senate is not asked to adjudicate
thermodynamics.

Facility operators countersign chamber logs. Referees attend in person or witness remotely via
sealed cameras.

**Excursions and restarts.** Exceed the §3 budget and the run voids; a restart is free and
unpenalised with a fresh T0. A facility compressor failure is not the team's fault.

**Rules freeze at market open.** A pre-open clarification window is provided. Afterwards, only
clarifications that cannot change an outcome, appended to a public Referee FAQ.

## 9. Publication

Within 30 days of run end, under an open licence: raw CSV logs, facility-countersigned chamber
records, mass statement, photographs and video, **source price and lead time** (§5), and a
**Longevity Statement** naming the limiting mechanism — isotope half-life, propellant mass,
convertor wear, cell chemistry — with evidence.

**Minimum public dataset** is deliberately narrow — load power, timestamps, chamber pressure and
temperature, mass, source procurement terms — so that export-controlled or security-sensitive
programs can compete without disclosing anything else.

## 10. Records leaderboard (published, non-resolving)

Specific energy (Wh delivered per kg of article), peak sustained We, total Wh, cost per watt-year,
and projected operating life. This is where two systems that both cleared M1 are told apart in
public without either being disqualified.

## 11. Safety

Mandatory facility EHS sign-off. Unsafe runs are disqualified regardless of result. MoonDAO does not
direct, supervise, or fund entrant work, and entrants sign a waiver. Radiological work must be
conducted under valid licence at a licensed facility in any jurisdiction; security-sensitive
parameters may be redacted from the public record.

We note this section exists precisely because §3 deliberately invites small teams to work with
liquid nitrogen and vacuum vessels.

## 12. Eligibility and roster

Teams **claim** — they do not apply. Listing is editorial and does not imply participation,
endorsement, or affiliation. Any qualifying entrant not named competes through the **Open Field**
slot. The outcome set is frozen when the market opens and can never be resized.

## 13. Ties

Earlier verified T0 wins. If identical, earlier pre-registration timestamp.

## 14. What this test does not prove

Stated in the rules so nobody has to discover it later. A terrestrial chamber does not reproduce
regolith conduction, dust, one-sixth gravity, launch vibration, or the radiation environment.
Optional bonus credit is available for vibration and thermal-cycling campaigns. A 100 K shroud is
warm relative to a ~40 K PSR floor.

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

**Read.** Strongest M2 candidate on the board. Two frictions: their marquee 2027 demonstration is
electrically heated, which under §2 counts only if the heater draws on onboard stored energy; and
10 We of Am-241 is ~$1.4M of fuel. Their Sr-90 line may be the faster route to a genuinely fueled
closed-loop run.

## Slot 1 — Astrobotic, NITE (US)

Pittsburgh. NITE is a **non-nuclear** lunar night power system — chemical and fuel-cell based —
funded by a ~$2.8M NASA Tipping Point award. Thermal-vacuum testing at Penn State encountered
leakage and an oxidizer pump failure under vacuum. Assessed at roughly TRL 4.

Astrobotic's wider record is mixed and relevant: Peregrine Mission One failed in January 2024;
Griffin follows; the company will fly Venturi Astrolab's FLIP rover in late 2026.

**Read.** The only serious non-nuclear operate-through system with dedicated funding. A real M1
contender with no licensing friction. **Structurally cannot clear the Decade Rule** — a one-night
chemical system is by definition not a decade-class inventory.

## Slot 2 — Venturi Space (Monaco / Switzerland / France)

Batteries designed and assembled in Monaco, hyper-deformable wheels in Switzerland, onboard
electronics and BMS in Toulouse. Strategic partner of US-based Venturi Astrolab, which NASA selected
in May 2026 to provide **CLV-1**, a crewed lunar vehicle targeted to reach the Moon by 2028.

The relevant capability is the battery. Packs are qualified across **−240 °C to +130 °C** — a 33 K
low, far below our 100 K shroud. Cell screening is severe: of 10,000 cells delivered, ~80% are
selected, after **endurance simulations over lunar cycles under vacuum**, plus short-circuit,
overload, over-discharge, vibration, shock, impact, vacuum and radiation testing. The BMS monitors
every cell voltage at 10 ms intervals and manages thermal and energy state through the night. Their
rovers — FLIP (450 kg, flying on Astrobotic late 2026), CLV-1, and Mona Luna (750 kg, ESA/Argonaut,
2030) — are all advertised as designed to survive multiple lunar nights.

**Read.** The strongest recent addition. Non-nuclear, so zero licensing friction, and **vacuum
lunar-cycle endurance testing is already inside their qualification flow** — we would largely be
asking them to instrument and publish a test they run anyway. Same structural position as Astrobotic:
strong at M1, cannot clear the Decade Rule.

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

**Read.** Genuine, fast-moving, and the most credible European entrant. Two gaps against this prize:
−70 °C is 203 K, nowhere near our 100 K spec; and an RHU produces **heat**, so they need a convertor
to deliver watts electric.

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
with a follow-the-light and hibernation strategy — no RTG in the published configuration. Chang'e-8
follows around 2028–29.

**Read.** Deepest relevant flight heritage on the board, and the prior art most likely to be cited
against this prize. Would have to clear the **Procurement Rule**, which Chinese state Pu-238 does
not obviously do. Realistically will not claim.

## Slot 5 — Rosatom / Krasnaya Zvezda / Kurchatov Institute (Russia)

Heritage runs from Lunokhod's Po-210 heaters through the RORSAT and TOPAZ reactor programmes.
Luna-25 carried a radioisotope unit and crashed in August 2023.

Current activity is at two very different scales. Valery Efremov of the Sarov nuclear centre has
described small **RTG-based power plants** with ≥10-year autonomous operation, intended to prepare
ILRS infrastructure. Far larger is **Selena** — Roscosmos, Rosatom and the Kurchatov Institute,
5–10 kWe, ten-year life, likely lead-bismuth cooled, derived from the Elena-AM terrestrial SMR. NPO
Lavochkin signed the build contract in December 2025; prototype 2032, support missions 2033–34,
power module delivered 2035, operational 2036. Luna-26 orbits in 2028, Luna-27A reaches the south
pole in 2029, 27B the north in 2030.

**Read.** Real heritage and, because Russia reprocesses spent fuel, a legitimate Sr-90 and Am-241
supply route. But nothing at watt scale on a near timeline — Selena is a reactor, wrong scale and
wrong decade for this prize. Expect it to price low.

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

Given that §3 permits an LN₂-shrouded bell jar, we consider the Open Field a genuine threat at M1
rather than a formality.

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
| NASA Glenn | Hibernation research (S3R cold start at 57 K; 18650 freeze/thaw at 50 K). **Survive and wake, not operate.** Better as a referee source and as public contrast |

---

# PART IV — MECHANISM

Night Shift runs on MoonDAO's existing DePrize infrastructure. Bettors buy outcome tokens on named
competitors through an LMSR market; 5% of betting volume accrues to a Juicebox prize pool; the Senate
declares the winner; the pool disburses 30% at M1 and 70% at M2. See [DEPRIZE.md](DEPRIZE.md) and
[DEPRIZE_ROSTER_CHANGES.md](DEPRIZE_ROSTER_CHANGES.md).

| Item | Value |
|---|---|
| Outcome slots | **8** — frozen at market open, can never be resized |
| Sunset | 18 months |
| Seed | $5,000 |
| Resolution | Referee panel memo → Senate vote → Safe transaction |
| If no claim by sunset | Disclosed no-winner terminal; pool rolls to a Gen-2 prize with a revised bar |

**Seed allocation.** $2,000 LMSR liquidity (recoverable at settlement); $1,500 Standard Night Load
kits; $750 referee honoraria; $500 data hosting and publication; $250 contingency.

The $5,000 is **seed, not prize**. The pool grows with betting volume, and the product a serious
entrant receives is an independently witnessed public record plus a live market pricing them against
their rivals.

---

# PART V — QUESTIONS FOR REVIEWERS

1. **Is 10 We right?** It is 4× Chang'e-4 and implies ~$1.4M of americium for an isotope entry. Does
   that make M2 unwinnable, or correctly hard? Would 5 We be better?
2. **Is the Procurement Rule enforceable?** How should a referee audit "commercially procurable"? Is
   a signed offtake sufficient, or does it need a delivered invoice? Where does it break?
3. **Is 354 h + dawn + 72 h the right permanence proof**, or should M2 require two complete nights?
   The latter roughly doubles chamber cost.
4. **Is a decade the right inventory horizon**, and can a referee actually audit an energy inventory
   without proprietary disclosure?
5. **Is 100 K too generous?** It admits LN₂ and therefore small teams, but a PSR floor is nearer
   40 K. Gen-2 tightening, or wrong now?
6. **Is the wall-power ban correct?** It is the biggest structural call in the document, and it means
   Zeno's flagship 2027 demonstration does not count unless reconfigured. Is that honest rigour or
   self-defeating?
7. **Who did we miss?** Especially outside the US and Europe, and especially non-nuclear approaches.
8. **Who will actually lend a chamber for 19 continuous days**, and at what cost? This is our largest
   unpriced risk.
9. **Is "market resolves at M1, money weighted to M2" legible** to a non-expert bettor, or does it
   invite a sense of being misled?
10. **Is the framing too modest?** We claim an industrialization milestone, not a physics
    breakthrough. Is that worth a prize?

---

## Appendix A — Principal sources

Horvath, Hayne & Paige, *GRL* 49 (2022) — lunar thermal environments · NASA RPS Program
commercialization status, IEEE 2025 · GAO-17-673 — Pu-238 production · DOE ORNL Pu-238 shipment
releases · *Nuclear Systems Used for Space Exploration by Other Countries* (Chang'e RTG/RHU figures)
· CAST statements via SCIO, January 2019 · GB/T 44319-2024 · CNNC/CIAE, *Prospects of ²³⁸Pu RTGs in
Lunar Scientific Research Station*, 2026 · University of Leicester / Space Park Leicester releases,
Nov 2025 and Apr 2026 · UNOOSA A/AC.105/C.1/2026/CRP.17 — ESA RPS and NLSAP · NEI, WNN and TASS on
Selena and Lavochkin · Venturi Space technical pages · NASA Tipping Point award announcements ·
Planetary Society and Wikipedia mission summaries for Chang'e-7 and LUPEX.
