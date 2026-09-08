# Survive the Night — Technical Specification v1.0-draft

> **SUPERSEDED by [`DEPRIZE_NIGHT_SHIFT.md`](./DEPRIZE_NIGHT_SHIFT.md).** The 1 kg mass cap and
> no-radioisotopes clause below are technology-banning rather than outcome-defined, and the
> hibernate-and-beacon win condition rewards survival rather than operation. Retained for the
> physics and the rejected-options record.

**Status:** Superseded — do not use as rules of record
**Prize:** P1 in [`DEPRIZE_FIRST_PRIZE_CANDIDATES.md`](./DEPRIZE_FIRST_PRIZE_CANDIDATES.md)
**Related:** [`DEPRIZE_GTM_SURVIVE_THE_NIGHT.md`](./DEPRIZE_GTM_SURVIVE_THE_NIGHT.md) (launch plan) · [`DEPRIZE_SURVIVE_THE_NIGHT_RISKS.md`](./DEPRIZE_SURVIVE_THE_NIGHT_RISKS.md) (risk register) · [`DEPRIZE_LUNAR_NIGHT_CONTRACT_PERFORMERS.md`](./DEPRIZE_LUNAR_NIGHT_CONTRACT_PERFORMERS.md) (funded landscape) · [`DEPRIZE.md`](./DEPRIZE.md) (mechanism)
**Last updated:** 2026-08-20

---

## 0. The prize in one sentence

> **Build a payload no heavier than a bag of sugar that freezes in the dark for 15 days in a vacuum chamber — no nuclear heat, no outside power — and wakes itself up when the lamp comes on.**

Long form (two sentences, for the prize page): *Everything we land on the Moon dies at sunset, because surviving the 354-hour lunar night today means carrying radioactive heaters. We are paying $5,000 — and rising — to the first small team whose ≤1 kg payload endures a full simulated lunar night and beacons back to life at dawn on its own solar power.*

---

## 1. Design philosophy (non-normative)

Three decisions define this spec; everything else is detail.

1. **Outcome-defined, technology-agnostic below the nuclear line.** We specify *what the box must do* — survive 354 hours at cryogenic temperature in vacuum and cold-start at dawn — not how. Battery-warm architectures, phase-change mass, chemical heaters, aerogel-and-hibernate, cryo-electronics: all legal. The physics ([battery warm-boxing costs ~5 kg per sustained watt](./DEPRIZE_LUNAR_NIGHT_CONTRACT_PERFORMERS.md); hibernation costs ~zero) will push most teams toward freeze-and-wake, but the rules do not.
2. **No special nuclear material.** Radioisotope heat or power of any kind is banned (§4.4). Not because it doesn't work — because it works so well it turns the prize into a licensing exercise that only [the already-funded performers](./DEPRIZE_LUNAR_NIGHT_CONTRACT_PERFORMERS.md) can enter, and it makes chamber hosts and judges into nuclear-safety officers.
3. **Pass/fail must fit in one video frame.** The winning moment is a beacon arriving within 60 minutes of lamp-on. Every requirement below exists to make that frame unarguable.

---

## 2. Definitions

| Term | Meaning |
|---|---|
| **Payload** | Everything the team places in the chamber: structure, insulation, energy storage, electronics, photovoltaic array, harness to the data feedthrough. |
| **The Night** | The continuous 354-hour period between door-close verification and lamp-on. |
| **Dawn** | The moment the host energizes the solar simulator. |
| **Beacon** | The payload's first valid telemetry frame after Dawn (§6.3). |
| **Host** | The facility operating the chamber. Owns all environment instrumentation. |
| **Judges** | Two independent engineers + the host operator. Sign the verdict the Senate ratifies. |
| **Attempt** | One door-close under run conditions. Each team gets **two** M2 attempts per generation. |

---

## 3. Environment (provided and verified by the Host, not the team)

| ID | Requirement |
|---|---|
| E-1 | Chamber pressure **≤ 1×10⁻³ torr** for the entire Night. |
| E-2 | Radiative shroud **≤ 100 K** for the entire Night, measured at ≥2 shroud locations. |
| E-3 | Payload mounted on **low-conductivity standoffs** (host-provided interface plate, G ≤ 0.05 W/K to chamber structure) so radiation to the shroud dominates heat loss, as it does on the lunar surface. |
| E-4 | **Solar simulator ≥ 1,000 W/m²** at the payload array plane at Dawn, calibrated with a reference cell within 30 days of the run, calibration published before door-close. |
| E-5 | Environment excursions (pump trip, LN₂ interruption, shroud >100 K for >30 min) are **host faults**: the clock pauses, and if conditions cannot be restored within 24 h the attempt is void and does **not** count against the team's two attempts. |
| E-6 | Chamber pressure, shroud temperatures, and lamp state logged at ≥1 sample/min by host instrumentation and published in the evidence bundle. Continuous witness video of the payload and the telemetry console for the entire run. |

---

## 4. Payload requirements

### 4.1 Physical

| ID | Requirement |
|---|---|
| P-1 | Total mass **≤ 1.00 kg** as weighed by the host at check-in, including array, harness, and any consumables. |
| P-2 | Envelope **≤ 10 × 10 × 30 cm** (3U). No deployables required; any deployable must complete deployment before door-close and stay within a 20 × 20 × 30 cm envelope. |
| P-3 | Self-contained. The **only** permitted penetration is one host-supplied data line to the feedthrough (§6.2). No power, fluid, or mechanical connections cross the chamber wall. |

### 4.2 Energy and thermal (the technology-agnostic core)

| ID | Requirement |
|---|---|
| P-4 | After door-close, the payload receives **no energy input of any kind** until Dawn: no external electrical power, no charging, no commanded heating, no RF power transfer, no thermal input beyond the ≤100 K shroud. |
| P-5 | All stored energy (electrochemical, chemical, thermal/phase-change, mechanical) must be **onboard at door-close and within the 1 kg budget**. Any onboard architecture that fits P-1/P-4 is legal: keep-warm, hibernate-and-freeze, or hybrid. |
| P-6 | At Dawn, the payload must operate **from its own array under the simulator**. Recharging its own storage from its own array after Dawn is the intended path and is unrestricted. |

### 4.3 Autonomy

| ID | Requirement |
|---|---|
| P-7 | No uplink, no commanding, no human interaction from door-close to verdict. The payload must detect Dawn and recover **entirely on its own logic**. |
| P-8 | The payload must record its **own internal temperature at ≥1 sample per 10 minutes for the entire Night**, at minimum at the energy store and at the main electronics, and retain the log through the night for transmission in the Beacon. (Logging may be implemented passively or by ultra-low-power circuits — but see P-4: whatever runs the logger runs on onboard energy.) |

### 4.4 Prohibitions (disqualifying)

| ID | Prohibited |
|---|---|
| X-1 | **Any radioisotope or nuclear material** used for heat, power, or ballast: RHU, RTG, betavoltaic, tritium in any form, or any source requiring an NRC/DOE/agency license or general license. If it decays on purpose, it's banned. |
| X-2 | External energy in any form during the Night (see P-4), including energy smuggled via the data line — the host line is opto-isolated and power-limited (§6.2). |
| X-3 | Pyrotechnics; pressure vessels above 2 bar absolute; primary lithium cells above 30 g total lithium content; anything the host's safety officer rejects (host safety review is final). |
| X-4 | Human intervention, physical or by command, between door-close and verdict. |
| X-5 | Concealed mass or energy discovered at teardown (§7.4). |

---

## 5. The two milestones

Matches the DePrize 30/70 disbursement (`releaseM1` / `completeM2`).

### M1 — Qualifying Night (30% of the purse)

A **72-hour** soak under full §3 conditions, followed by a Dawn cold start meeting all §6 success criteria. Purpose: prove the architecture end-to-end, calibrate the odds, and de-risk the host's long run.

### M2 — The Long Night (70% of the purse)

One **354-hour** soak under full §3 conditions, followed by a Dawn cold start meeting §6 — **then, without opening the chamber**, a same-conditions **72-hour encore night** and a second successful Dawn. The encore proves repeatability (the freeze–thaw cycle is survivable more than once) without the ~45 days of chamber time three full nights would cost. *(Generation 2 may raise M2 to three full consecutive nights.)*

Total M2 chamber occupancy: ~18 days. First team to complete M2, as ratified by the Senate over the judges' signed verdict, wins.

---

## 6. Success criteria at Dawn

### 6.1 The clock

The payload must transmit a valid Beacon **within 60 minutes of lamp-on**. The 60-minute window is generous by design — Glenn's cryo cold-start work shows dawn-mode wake in minutes — because the drama of the countdown is part of the product.

### 6.2 The data line

The Beacon travels over a **host-provided wired serial line** through the chamber feedthrough (opto-isolated, current-limited so no meaningful power can flow inward). RF inside a steel chamber is unreceivable and unverifiable; the wire is the antenna. Teams get the line's electrical spec (3.3 V UART, 9600 baud, connector pinout) at registration and it is identical for every team.

### 6.3 A valid Beacon contains

| ID | Content |
|---|---|
| B-1 | A team-unique identifier and an incrementing frame counter. |
| B-2 | The **full internal temperature log of the Night** (§ P-8) — this is the proof the payload actually endured the environment rather than sleeping through a warm corner of the chamber. |
| B-3 | Current internal temperatures and energy-store voltage, updated live for ≥30 minutes after first frame. |
| B-4 | For M2: log continuity across the Long Night **and** the encore night in the final Beacon. |

### 6.4 Judged pass/fail

Pass = valid Beacon within 60 min of each Dawn, log complete and consistent with host environment data, no prohibition violated, teardown clean. Anything else = fail. There is no partial credit and no style scoring; the judges' only discretion is fact-finding, not merit.

---

## 7. Verification and evidence

| ID | Requirement |
|---|---|
| V-1 | **Weigh-in and inspection** at check-in: mass, envelope, visual inspection, safety review, photographs of all internals before closeout. Team seals the payload in the judges' presence. |
| V-2 | **Environment record**: host logs per E-6, published raw. |
| V-3 | **Witness video**: continuous, timestamped, covering payload and telemetry console; the Dawn window streamed live. |
| V-4 | **Teardown**: after the verdict, the payload is opened in front of the judges and compared against the sealed inspection photos (checks X-1/X-5). |
| V-5 | **Evidence bundle** (IPFS, per [`DEPRIZE.md`](./DEPRIZE.md)): the ten-minute review set — one-page judge verdict with three signatures, the Dawn video clip, the Beacon log, the environment traces, weigh-in sheet, teardown photos. A Senate member must be able to verify the win in ten minutes without being a thermal engineer. |
| V-6 | **Open source at M2**: winning team publishes BOM, schematics, CAD, firmware, and a build/test narrative within 30 days of the verdict, CERN-OHL or equivalent. 70% disbursement is contingent on publication. |

---

## 8. Attempts, aborts, and the schedule

| Rule | Detail |
|---|---|
| Attempts | Two M2 attempts per team per generation. M1 may be re-attempted freely as chamber time permits, but M1 must be passed ≥30 days before an M2 attempt. |
| Abort taxonomy | **Host fault** (E-5): clock pauses or attempt voided, no attempt consumed. **Payload fault** (silence at Dawn, log gap, prohibition): attempt consumed. **Force majeure** (facility emergency): attempt voided. The judges classify every abort in writing; ambiguity resolves in the team's favor once, then against. |
| Scheduling | The M2 Long Night runs **time-locked to a real lunar night** at the Artemis south-pole reference site (chamber dark at real sunset, lamp at real sunrise) per the [GTM](./DEPRIZE_GTM_SURVIVE_THE_NIGHT.md). May–September window; never July. |
| Ties | If two teams pass M2 in the same chamber campaign, first valid Beacon timestamp wins the purse; both enter the evidence record. |

---

## 9. Safety minimums (host may add, never subtract)

- Li-ion cells: commercial cells with UN 38.3 test summaries; team declares chemistry, capacity, and state of charge at door-close. Hibernation architectures **should** enter the Night ≤30% SOC (cold cells are safest near empty); keep-warm architectures must show a fault tree for cell-freeze during an unplanned deep discharge.
- Chemical heat sources (metal oxidation, PCM, exothermics): full reactant inventory and MSDS at registration; reaction products must stay contained within the payload envelope; host safety officer approval required.
- No team member touches chamber controls, LN₂, or vacuum hardware. Ever.

---

## 10. What this spec deliberately does not require

- **No minimum internal temperature during the Night.** Freezing solid is a legal strategy — that's the loophole the whole prize exists to showcase.
- **No useful payload function.** Gen 1 buys survival + wake, nothing else. (Gen 2 candidates: do work at dawn, survive three full nights, carry a guest instrument.)
- **No flight-grade parts, no radiation tolerance, no dust.** One capability per prize.
- **No specific architecture.** If someone wins it with 800 g of paraffin and a bimetallic switch instead of cryo-electronics, that is a fair win and a good story.

---

## 11. Requirement-to-rationale trace

| Requirement | Why it exists |
|---|---|
| ≤1 kg / 3U | Puts the prize below the [~5 kg-per-watt battery warm-box line](./DEPRIZE_LUNAR_NIGHT_CONTRACT_PERFORMERS.md) — forces real engineering, keeps BOM ≤$800 |
| ≤10⁻³ torr / ≤100 K | Kills convection, produces lunar-night radiative physics, and stays reachable by a university chamber with a rotary pump + LN₂ shroud |
| 354 h | One equatorial lunar night; the number is the brand |
| No radioisotopes | Keeps the field open, the hosts safe, and the result novel — every funded night-survival program is nuclear |
| Beacon + full temp log | The log is the fingerprint that the box actually lived through the cold; the beacon is the one-frame verdict |
| Wired beacon | RF in a steel can is unverifiable; the wire makes the pass/fail objective |
| 72 h M1 | Cheap qualifier that exercises `releaseM1` and gives bettors an odds-moving event |
| 354 h + 72 h encore M2 | Proves repeatable freeze–thaw survival without 45 days of chamber time |
| Teardown vs sealed photos | Cheapest possible anti-cheat for hidden energy/isotopes |
| Open source at M2 | The community keeps the design; the winner keeps the credential and the purse |
