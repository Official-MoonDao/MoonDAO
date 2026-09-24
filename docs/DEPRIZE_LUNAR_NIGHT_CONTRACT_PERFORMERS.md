# Lunar-night survival — national-contract performers

**Status:** Research snapshot, 2026-08-19
**Companion spreadsheet:** [`deprize-lunar-night-contract-performers.csv`](./deprize-lunar-night-contract-performers.csv)
**Related:** [`DEPRIZE_FIRST_PRIZE_CANDIDATES.md`](./DEPRIZE_FIRST_PRIZE_CANDIDATES.md) (P1 spec), [`deprize-survive-the-night-outreach.csv`](./deprize-survive-the-night-outreach.csv) (prize-recruitment list), [`DEPRIZE_GTM_SURVIVE_THE_NIGHT.md`](./DEPRIZE_GTM_SURVIVE_THE_NIGHT.md)

This is **not** another outreach list. The outreach CSV is "who might enter a $5k non-nuclear prize." This document is "who is already being paid by NASA, DARPA, DoD, DOE, ESA, UKSA, METI, or a state government to develop lunar-night survival technology," with the named performers on those vehicles.

Inclusion bar: a published contract, Space Act Agreement, SBIR/STTR, NIAC, Centennial Challenge award, Tipping Point, CLPS incentive, STRATFI, or equivalent national grant whose **stated purpose** is surviving the lunar night, operating in permanently shadowed regions, or building an enabling subsystem (heat, darkness-independent power, hibernation electronics, freeze-tolerant thermal control, RHU/RPS, chemical heaters). Workshop talks without an award are omitted. Generic lander contracts are omitted unless they carry an explicit night-survival workshare.

---

## 1. What the map actually looks like

National money is concentrated on **radioisotopes**, then **passive thermal hardware**, then **chemical heat**, then **hibernation electronics**. Fission surface power is a separate, habitat-scale track. Almost nobody is funding an open, non-nuclear, 1 kg hibernation payload — which is why P1 is not redundant.

| Approach | Who is paying | Payload-scale (≤ tens of W / ≤ few kg)? | P1 DePrize status |
|---|---|---|---|
| Am-241 / Sr-90 / tritium RHU and RPS | NASA STMD Tipping Point, CLPS CS-8 incentive, NIAC, USAF STRATFI, Navy DEPTHS, DARPA Rads to Watts, ESA ENDURE, UKSA, SASIC | Yes (RHU) to lander-scale (Stirling RSG) | **Banned** by P1 radioisotope rule |
| Chemical metal-oxidation heat + fuel cell (NITE/MOWS) | NASA SBIR + 2020 Tipping Point | Yes (~5 W thermal demo) | **Eligible** — strongest funded non-nuclear competitor class |
| Passive thermal (VCHP, LHP shutoff, OHP, PCM, freeze-tolerant radiators) | NASA SBIR Sequential Phase II, GCD-adjacent | Yes | **Eligible** — parts vendors more than prize teams |
| Cryo hibernation electronics + freeze-thaw Li-ion | NASA Glenn in-house STMD | Yes — this is the P1 architecture | **Judges, not competitors** |
| Watts-class power transmission + storage through darkness | NASA Centennial Challenge (closed 2024) | No — km-scale, not 1 kg | Alumni are **eligible** at hibernation scale |
| Regenerative fuel cells / wireless charging | NASA 2020 Tipping Point | Lander/infrastructure | Adjacent; too heavy for P1 |
| 40 kWe fission surface power | NASA + DOE/INL | Habitat | Wrong scale |
| Variable-conductivity insulation for tiny rovers | NASA NIAC 2026 | Yes | **Eligible**, early TRL |

---

## 2. Shortlist: performers actually developing the technology

These are the organizations whose hardware, fuel, or electronics are the product — not just a lander that might carry someone else's box.

### 2.1 Radioisotope heat and power (cannot enter P1; they define the funded state of the art)

| Performer | Role | Vehicle | What they are building |
|---|---|---|---|
| **Zeno Power** | Prime | NASA Tipping Point 2023 **Harmonia** $15M; CLPS CS-8 survive-the-night incentive with Firefly (Am-241 5 W RHU, NET 2028); USAF STRATFI ~$30M (Sr-90 satellite); Navy/DoD DEPTHS $7.5M (Sr-90 seabed RPS); NIAC 2026 **EARENDIL** (Am-241 EVA-suit heaters) | Commercial Am-241 Stirling RSG for lunar night/PSRs; Am-241 RHU "Survive-the-Night Package"; Sr-90 systems for DoD. FDR complete Apr 2026; terrestrial demo early 2027. |
| **Sunpower** | Convertor | Harmonia + DEPTHS | Stirling convertors for Zeno RSGs |
| **University of Dayton Research Institute** | Partner | Harmonia + DEPTHS | Integration / test |
| **Blue Origin** | Partner | Harmonia + DEPTHS | Convertor integration / lunar architecture |
| **Intuitive Machines** | Sub (~$2.4M of Harmonia) + CLPS CS-8 | Harmonia; CS-8 night-survival incentive (~$15M, IM public statement) | Landed integration of Am-241 RSG/RHU; pursuing same CS-8 bonus as Firefly |
| **Firefly Aerospace** | Integrator | CLPS CS-8 Blue Ghost, NET 2028 | Flies Zeno's 5 W Am-241 RHU package; 120 h night beacon is the NASA incentive gate |
| **City Labs** | Prime | NASA NIAC 2024 tritium ChipSat sensors (with Cornell); DARPA **Rads to Watts** $1.5M (with Microlink Devices); NASA/DoD-funded BOHR CubeSat (Jul 2026) | NanoTritium betavoltaics; tritium RHU planned ~2027; PSR micropower sensors |
| **Microlink Devices** | Sub | DARPA Rads to Watts | Watt-class radiovoltaic cells with City Labs |
| **Perpetual Atomics** (Leicester spinout) | Prime designer | ESA **ENDURE**; UKSA; UK International Bilateral Fund | Gen-5 Am-241 RHU (vibe + TVAC qualified 2026); Am-RTG / Stirling path |
| **University of Leicester / Space Park Leicester** | Lab lead since ~2010 | ESA ENDURE; UKSA; UK IBF with ispace EUROPE | Am-RHU/RTG design, safety testing; consulting ispace Series 3 night survival |
| **UK National Nuclear Laboratory** | Fuel | UKSA + ESA ENDURE | Only UK Am-241 extraction/pelleting from civil Pu stocks (Sellafield) |
| **Framatome** | Industrial fuel | ESA ENDURE (2025) | Sovereign sealed-source production with Perpetual Atomics + Amentum |
| **Amentum** | Regulatory / PM | ESA ENDURE | Safety case and licensing |
| **QSA Global** (+ QSA Europe) | Fuel core | ENDURE / commercial collab | First full-scale Am-241 RHU core pellets in metal containment (Apr 2026) |
| **entX** | Prime | South Australia SASIC Round 2, AUD $200k with ispace | Commercial RHU; lunar demo study on a future ispace flight |
| **The Aerospace Corporation** | Prime | NASA NIAC APPLE Phase I 2021 / Phase II 2022 (~$600k) with ORNL + JPL | Modular Pu-238/Am-241 thermoelectric tiles; later papers pitch small lunar-night experiments |
| **Oak Ridge National Laboratory** | Fuel / test | APPLE; DOE Sr-90 recycle for Zeno (BUP-500) | Isotope supply and radiation test |
| **Teledyne Energy Systems** | Convertor / heritage RPS | NASA Glenn **DRPS** contracts; 2020 Tipping Point $2.8M fuel cell (adjacent) | Stirling convertors with American Semiconductor; long-life fuel cells |
| **American Semiconductor** | Convertor | NASA GRC DRPS | Stirling convertors with Teledyne |
| **Creare** | Convertor + thermal | NASA GRC DRPS Turbo-Brayton (with Aerojet/L3Harris); SBIR freeze-tolerant radiators (80NSSC21C0462, 80NSSC23PB412) | Dynamic conversion **and** freeze-tolerant variable-conductance radiators for lunar night |
| **Westinghouse** | Heat-source facility + FSP | Zeno facility use; NASA/DOE FSP Phase 1 2022 ($5M, with Aerojet/L3Harris) | Radiological assembly; 40 kWe lunar fission concept |
| **Orano** | Am-241 supply | Commercial agreement with Zeno | Americium feedstock |
| **NorthStar** (Vallecitos hot cells) | Manufacturing | Zeno lease | Restore hot cells for nuclear-battery production |
| **DOE Oak Ridge Office of Environmental Management** | Fuel recycle | Zeno BUP-500 | Sr-90 from a legacy RPS into Zeno's first 10+ units |
| **PNNL** | Test | Zeno Sr-90 heat-source demo (2023) | First Zeno Sr-90 nuclear heat source |

DARPA **Rads to Watts** (selected Jul 2026; up to 30 months) is a radiovoltaic competition for extreme environments including space. Lunar night is an application, not the SOW. Primes: **Arizona State University, Avalanche Energy, BWX Technologies** (with JHU APL / University of Michigan), **City Labs**, **Morgan State University** (with Project Omega + Northrop Grumman), **University of Missouri**, **University of North Carolina–Chapel Hill**.

### 2.2 Non-nuclear heat, thermal control, and hibernation (the P1-relevant funded set)

| Performer | Role | Vehicle | What they are developing |
|---|---|---|---|
| **Astrobotic** (inherited **Masten** NITE/MOWS) | Prime | NASA SBIR Phase I 2019 (80NSSC19C0508) + Phase II 2020 (80NSSC20C0177); 2020 Tipping Point **$2.8M** MOWS/NITE | Metal-oxidation chemical heater + fuel-cell electricity. ~5 W thermal / one lunar night demo unit. Non-nuclear, dust-proof. **This is the closest funded analog to P1.** |
| **Penn State Applied Research Lab** | Sub | Masten/Astrobotic SBIR | Metal-oxidation chemistry and breadboard |
| **Honeybee Robotics** | Sub | NITE | Electronics / subsystems on the chemical heater |
| **Advanced Cooling Technologies (ACT)** | Prime | NASA SBIR then Sequential Phase II **$5M** (announced 2021–22); subcontract **Astrobotic** | Passive TMS toolbox: VCHP, LHP with thermal-control valve that **shuts off at night**, high-power thermal switch, PCM. Validated against Peregrine / Griffin / CubeRover architectures. Heritage with Marshall and JSC since ~2010. |
| **ThermAvant Technologies** | Prime | NASA SBIR 80NSSC20C0273 (OHP-enhanced thermal wadi); 80NSSC25C0374 Phase I 2025 ($156k) active thermal-switching OHP radiator | Oscillating heat pipes as thermal switches + buried-regolith heat storage for rover "parking plates" through the night; >600:1 on/off conductance target |
| **NASA Glenn Research Center** — hibernation electronics | In-house | STMD / GRC Power Division (Oeftering, Uguccini, Bennett, Gonzalez et al.) | Passive hibernation: isolate Li-ion, freeze to ~50 K, COTS cryo-operable S3R cold-starts at 57 K, preheats batteries at dawn. **P1's architecture.** Also LESTR 40 K dry-cryo rig. |
| **Fort Wayne Metals** | Industry partner | NASA Glenn LESTR transfer | Uses LESTR 1 to test shape-memory alloys at lunar-night temperatures |
| **JPL (David Bugby)** | In-house + instrument teams | NASA / JPL thermal; LSIC "palette" (reverse thermal switch demonstrated at 2500:1) | Passive thermal switches, MLI, CubeSat-scale instrument wrappers that survive night without RHUs |
| **Virginia Tech** (Austin Phoenix) | Prime | NASA NIAC 2026 **ECLIPSE** Phase I | Shape-memory-alloy variable-conductivity metamaterial: insulate at night, dump heat by day, no heaters, CubeSat-rover scale |
| **UCSB / Philip Lubin — H.E.L.P.S.** | Winner | NASA Watts on the Moon grand prize **$1M** (2024) | Lowest-mass, highest-efficiency power transmission + storage through a Glenn TVAC PSR-night sim; 800 V cable; variable radiation shield |
| **Orbital Mining Corporation** | 2nd place | Watts on the Moon **$500k** | High-voltage DC converter + Li-ion bank that completed the 48 h Glenn night sim |
| **Ohio State Electric Moon** (Jin Wang / Wu Lu) | Final four | Watts on the Moon | 6 km field transmission demo then Glenn TVAC |
| **Michigan Tech PSTDL / HuskyWorks** | Final four | Watts on the Moon; previously BIG Idea Artemis Award | TEMPEST tethered energy storage/transmission; owns a dirty TVAC that already hits −196 °C |
| **Skycorp, Virtus Solis, X-Wheel** | Phase 2 Level 1 ($200k each) | Watts on the Moon | Lunar-night energy architectures that did not make the final four |
| **pH Matter** | Prime | 2020 Tipping Point **$3.4M** (with Glenn) | Reversible regenerative fuel cell for lunar-surface energy storage |
| **Precision Combustion** | Prime | 2020 Tipping Point **$2.4M** | SOFC running on methane/oxygen / ISRU propellants |
| **Astrobotic** (second night-adjacent award) | Prime | 2020 Tipping Point **$5.8M** wireless charging; 2023 Tipping Point **$34.6M** LunaGrid-Lite 1 km high-voltage cable | Charging and power *distribution* that still has to work after darkness; CubeRover deploys the cable from Griffin |

### 2.3 Integrators flying or studying night survival (they buy or host the tech)

| Performer | Vehicle | Night-survival workshare |
|---|---|---|
| **Firefly Aerospace** | NASA CLPS CS-8 (~$144.2M lander + ~$15M survive-the-night incentive) | Flies Zeno 5 W Am-241 RHU package; 120 h post-sunset signal is the gate |
| **Intuitive Machines** | Harmonia sub; CLPS CS-8 (~$148.3M + same incentive) | Publicly pursuing Am-241 RHU for the $15M bonus; needs NASA nuclear indemnification |
| **Astrobotic / Voyager Lunar Systems** | CLPS CS-8 (two deliveries, $297.9M); ACT and NITE thermal work | Standardized lander production; thermal toolbox customer; NITE owner |
| **ispace** (JP) | METI SBIR up to **¥12B** for Series 3 / ULTRA lander; JAXA Space Strategy Fund polar landing (2026) | Mission 4 goal is long-term / lunar-night operations near the south pole |
| **ispace EUROPE** | UK International Bilateral Fund (Leicester consulting) | Series 3 RHU feasibility with Leicester Am-RHU |
| **ispace-U.S.** | Commercial MOU with Zeno (target 2027 demo) | Integrating Zeno RPS onto U.S. missions |
| **Blue Origin** | Harmonia partner; 2023 Tipping Point $34.7M Blue Alchemist (ISRU solar cells — adjacent) | Harmonia lunar RSG path |
| **Lockheed Martin + BWXT + Creare** | NASA/DOE FSP Phase 1 2022, $5M | 40 kWe, 10-year, sun-independent lunar reactor concept |
| **IX (Intuitive Machines + X-Energy) + Maxar + Boeing** | FSP Phase 1 2022, $5M | Same |
| **Westinghouse + Aerojet Rocketdyne / L3Harris** | FSP Phase 1 2022, $5M | Same |
| **Idaho National Laboratory / Battelle Energy Alliance** | NASA+DOE FSP managing contractor | Awards and government reference design |
| **Los Alamos National Laboratory** | FSP reactor expertise | Government team |
| **NANO Nuclear Energy** | Bought USNC **Pylon** space-reactor IP out of Ch.11 (Dec 2024, $8.5M) | Inherits a fission-for-space design; EmberCore radioisotope line status after USNC bankruptcy is unclear |

---

## 3. Programs, with every named performer

### 3.1 NASA STMD Tipping Point

**2023 (sixth call), lunar night named in the SOW**

- **Zeno Power** $15M — Am-241 Stirling RSG (Harmonia). Partners: Blue Origin, Intuitive Machines (~$2.4M), NASA Glenn, NASA Marshall, Sunpower, UDRI. Goal: flight-ready hardware, 2027 lunar demo.
- **Astrobotic** $34.6M — LunaGrid-Lite 1 km cable + CubeRover (power *distribution*, PSR/night adjacent).

**2020 (fifth call), lunar surface topic**

- **Masten** $2.8M — universal chemical heat/electric attachment for lunar night and craters → **NITE/MOWS**, now Astrobotic. Penn State + Honeybee on the SBIR thread.
- **Astrobotic** $5.8M — lunar wireless charging (with Glenn).
- **pH Matter** $3.4M — reversible regenerative fuel cell for lunar energy storage (with Glenn).
- **Precision Combustion** $2.4M — SOFC from CH4/O2.
- **Teledyne Energy Systems** $2.8M — 10,000-hour hydrogen fuel-cell power system.

### 3.2 NASA CLPS CS-8 survive-the-night incentive (award 30 Jun 2026)

NASA's published award text for the four standardized landers (Astrobotic ×2, Firefly, IM; ~$590M) does **not** mention a night bonus. Industry reporting after the fact (Payload, SpaceNews, IM at the Space Nuclear Industry Symposium 13 Aug 2026) says the task order carried a **~$15M** survive-the-night incentive: beacon after **120 hours** of lunar night.

Performers developing or flying the tech against that incentive:

- **Zeno + Firefly** — Am-241 5 W RHU "Survive-the-Night Package," NET 2028 Blue Ghost.
- **Intuitive Machines** — also pursuing Am-241 RHU; Vince Bilardo stated the incentive is $15M and NASA indemnification is a flight gate.

### 3.3 NASA SBIR / Sequential Phase II (lunar night in the topic)

| Award | Performer | Title / product |
|---|---|---|
| 80NSSC19C0508 Phase I | Masten (+ Penn State) | Chemical heat packs / MOWS |
| 80NSSC20C0177 Phase II | Masten | MOWS demo unit, universal payload interface |
| Sequential Phase II ~$5M (2021–22) | ACT (+ Astrobotic sub) | Lunar vehicle/payload TMS for extreme environments |
| 80NSSC21C0614 | ACT | Passive TMS / variable thermal links |
| 80NSSC20C0273 | ThermAvant | OHP-enhanced thermal wadi |
| 80NSSC25C0374 Phase I $156k (2025) | ThermAvant | Active thermal-switching OHP radiator for lunar science |
| 80NSSC21C0462 / 80NSSC23PB412 | Creare | Freeze-tolerant / freeze-proof variable-conductance radiators |

### 3.4 NASA NIAC (lunar night or PSR in the abstract)

| Year | PI / org | Study |
|---|---|---|
| 2021–22 | E. Joseph Nemanick, **Aerospace Corporation** (+ ORNL, JPL Phase II) | APPLE modular radioisotope power tiles |
| 2023 | Christopher Morrison, **USNC-Tech** (+ Thomas Prettyman, Planetary Science Institute) | EmberCore flashlight / lunar-night heat source. **USNC filed Ch.11 Oct 2024;** follow-on owner of EmberCore is not publicly clean. |
| 2024 | **City Labs** + Mason Peck / **Cornell** | Autonomous tritium micropowered ChipSat sensors for PSRs |
| 2026 | A.C. Charania, **Zeno** | EARENDIL — Am-241 heaters in EVA suits for night/PSR |
| 2026 | Austin Phoenix, **Virginia Tech** | ECLIPSE — passive variable-conductivity insulator for small surveyors |
| 2026 | Keunhan Park, **University of Utah** | Plasmon-enhanced radioisotope TPV — interstellar-framed, conversion tech adjacent |
| 2026 | Gilly Elor, **Stone Aerospace** | LUX lunar-underground explorer, power-over-fiber — adjacent, not night-survival |

### 3.5 NASA Centennial Challenge — Watts on the Moon (closed 2024)

Glenn-hosted 48-hour TVAC at PSR-like cold. Named performers who **built night-power hardware**:

- H.E.L.P.S. / UCSB (Philip Lubin) — $1M
- Orbital Mining Corporation — $500k
- Electric Moon / Ohio State — final four
- Michigan Tech PSTDL — final four
- Skycorp, Virtus Solis, X-Wheel — Phase 2 Level 1, $200k each

Glenn Power Division (Rob Button and team) ran the test. They are judges/hosts, not developers of a competing product.

### 3.6 NASA Glenn / Marshall in-house (not a vendor contract, but they are the government performers)

- **Glenn hibernation electronics** — cryo-operable S3R, freeze-thaw 18650s, dawn cold-start. The P1 spec is a public, amateur-scale version of this architecture.
- **Glenn LESTR** — 40–125 K, high vacuum, no liquid cryogens. LESTR 1 at Fort Wayne Metals; LESTR 2 in build.
- **Glenn Dynamic Radioisotope Power Systems (DRPS)** — three convertor contracts: Sunpower + Aerojet/L3Harris (Stirling), American Semiconductor + Teledyne (Stirling), Creare + Aerojet/L3Harris (Turbo-Brayton). Explicit lunar-night / PSR use case.
- **Marshall** — ACT thermal heritage; Break the Ice TVAC host (V-20); Harmonia partner center.

### 3.7 NASA + DOE Fission Surface Power (habitat-scale night power)

2022 Phase 1, three 12-month $5M concept contracts managed by INL/Battelle:

1. Lockheed Martin + BWXT + Creare
2. IX (Intuitive Machines + X-Energy) + Maxar + Boeing
3. Westinghouse + Aerojet Rocketdyne (now L3Harris)

Government team: NASA Glenn (project), INL, LANL. KRUSTY/Kilopower heritage (2018) at Nevada National Security Site. This is 40 kWe for 10 years — a base, not a payload.

### 3.8 DARPA / DoD / Space Force / Navy

| Vehicle | Performer | Night / darkness relevance |
|---|---|---|
| USAF/USSF **STRATFI** (~$30M, signed Aug 2022) | Zeno | Sr-90 RPS satellite; Bernstein has always cited lunar night as the commercial dual-use |
| Navy / ONR / OE-I **DEPTHS** ($7.5M, Oct 2023) | Zeno + Blue Origin + Sunpower + UDRI + PowerLight | Seabed Sr-90 RPS; same Stirling stack as Harmonia |
| DARPA **Rads to Watts** (7 primes, Jul 2026) | ASU, Avalanche Energy, BWXT, City Labs, Morgan State, Missouri, UNC–Chapel Hill | Radiovoltaics for space / deep-sea / unattended systems. City Labs is the only prime already pitching lunar RHU/PSR sensors. |
| DIU high-ΔV nuclear smallsat (2022) | USNC-Tech EmberCore | Radioisotope heat/power; company bankrupt 2024 |

DARPA **DRACO** (NTP with Lockheed / BWXT / previously Blue Origin + USNC-Tech) is nuclear *propulsion*, not lunar-night survival. Omitted on purpose.

### 3.9 ESA / UK / Australia / Japan

| Program | Agency | Performers developing the tech |
|---|---|---|
| **ENDURE** (European Devices Using Radioisotope Energy), from 2022 | ESA, funded heavily by **UKSA** (~£22M UK contribution cited) | Leicester / Perpetual Atomics (RHU, RTG, Stirling); NNL (Am-241 extraction); Framatome (sealed sources); Amentum (licensing); QSA Global (cores). Target missions include Rosalind Franklin RHU and **Argonaut lunar lander** night survival. |
| UK International Bilateral Fund Phases I–II | UKSA | Leicester + **ispace EUROPE** — Am-RHU on Series 3 lander/rovers |
| SASIC Space Collaboration & Innovation Fund Round 2 | Government of South Australia | **entX** + **ispace** — AUD $200k RHU lunar-demo study |
| METI SBIR "Development and Operational Demonstration of a Lunar Lander" | Japan METI | **ispace** up to ¥12B for Series 3/ULTRA. Mission 4 (JAXA Space Strategy Fund polar landing, 2026 selection) explicitly targets long-term / lunar-night operations. Night *hardware* is being shopped (Leicester RHU, Zeno RPS, entX RHU), not built in-house as a unique heater. |
| Historical ENDURE-adjacent RTG prototype team | ESA / UK | Leicester + Airbus DS, Queen Mary University of London, European Thermodynamics, Lockheed Martin UK, Fluid Gravity Engineering, Johnson Matthey (3 W RHU prototype) |

ESA's separate Pu-238 supply study (Tractebel Engie + SCK CEN, "Optimum Pro") is fuel-supply, not a night-survival device.

---

## 4. Supply chain that is developing enabling technology (not just shipping parts)

These organizations are on contract to make the fuel, convertors, or hot-cell infrastructure without which the radioisotope path does not fly. They are not prize competitors.

- **NNL** — Am-241 from UK civil inventory
- **Orano** — Am-241 for Zeno
- **DOE / ORNL EM** — Sr-90 from BUP-500
- **Westinghouse** — radiological assembly
- **NorthStar / Vallecitos** — hot cells
- **QSA Global** — Am pellet cores
- **Framatome** — European sealed sources
- **Sunpower, Creare, Teledyne, American Semiconductor, Aerojet/L3Harris** — dynamic convertors
- **PNNL** — Sr-90 heat-source demonstration

---

## 5. Implications for the first DePrize

1. **P1 is not competing with Harmonia, ENDURE, or CS-8.** Those programs pay for radioisotopes. P1 bans them. The funded non-nuclear set is small enough to name: **Astrobotic NITE**, **ACT (+ Astrobotic)**, **ThermAvant**, **Glenn hibernation**, **JPL Bugby switches**, **Virginia Tech ECLIPSE**, and the **Watts on the Moon** alumni miniaturizing.

2. **Do not recruit the nuclear primes as competitors.** Recruit them as amplifiers and, where relevant, as the "this is what the expensive path looks like" contrast. That matches ranks 39–42 of the outreach CSV (Zeno, City Labs, entX, Leicester/Perpetual Atomics).

3. **Best funded non-nuclear conversation that the outreach CSV underweights:** **Astrobotic NITE** (ex-Masten, SBIR + $2.8M Tipping Point) and **ACT** (already rank 36). NITE is a 5 W chemical heater sized for one lunar night — closer to P1 than Watts-scale transmission. Penn State ARL and Honeybee are the named subs.

4. **Glenn hibernation remains the judge panel, not a roster slot.** Same recommendation as the outreach list.

5. **CS-8's 120-hour on-Moon bonus is the flight-side cousin of P1's 72-hour M1.** Firefly/Zeno and IM are running that in 2028 with Am-241. A public non-nuclear 354-hour chamber run in 2027 is still the only open, amateur-accessible version of the same question.

6. **Fission surface power and LunaGrid are the wrong conversation** for a 1 kg prize. They matter for the Lunar Atlas "base power" layer, not for generation-1 roster recruitment.

---

## 6. Sources (primary)

- [NASA 2023 Tipping Point selections](https://www.nasa.gov/general/2023-nasa-tipping-point-selections/)
- [NASA 2020 Tipping Point selections](https://www.nasa.gov/technology/2020-nasa-tipping-point-selections/)
- [Zeno Harmonia / IM workshare](https://investors.intuitivemachines.com/news-releases/news-release-details/nasa-selects-intuitive-machines-team-develop-survive-lunar-night)
- [Firefly + Zeno CS-8 RHU](https://spacenews.com/firefly-aerospace-to-fly-zeno-power-radioisotope-heating-unit-on-lunar-lander-mission/)
- [ACT Sequential Phase II](https://www.1-act.com/about/news/surviving-the-lunar-night/)
- [Masten MOWS SBIR](https://sbir.org/awards/nasa-80NSSC20C0177-1) and [2020 Tipping Point NITE $2.8M](https://www.nasa.gov/technology/2020-nasa-tipping-point-selections/)
- [ThermAvant OHP wadi SBIR](https://sbir.org/awards/nasa-80NSSC20C0273-1)
- [Glenn hibernation electronics](https://ntrs.nasa.gov/citations/20240004406)
- [Watts on the Moon finale](https://www.nasa.gov/news-release/nasa-awards-1-5-million-at-watts-on-the-moon-challenge-finale/)
- [NASA FSP](https://www.nasa.gov/exploration-systems-development-mission-directorate/fission-surface-power/)
- [DARPA Rads to Watts selections](https://www.ans.org/news/2026-07-07/article-8185/seven-projects-selected-for-darpas-rads-to-watts/)
- [City Labs DARPA $1.5M](https://citylabs.net/city-labs-darpa-contract-2026/)
- [ESA ENDURE / Leicester Am-RHU qualification](https://le.ac.uk/news/2026/april/major-qualification-milestone-americium-radioisotope-heater-unit)
- [Framatome ENDURE fuel](https://www.framatome.com/medias/framatome-selected-by-the-european-space-agency-to-provide-industrial-production-capability-of-sealed-fuel-sources-for-radioisotope-power-systems/?lang=en)
- [entX + ispace SASIC](https://ispace-inc.com/news-en/?p=7268)
- [ispace METI SBIR / Mission 4 night ops](https://www.ispace-inc.com/2026/08/07/ispace-receives-grant-for-japans-space-strategy-fund-project-high-precision-landing-technology-in-the-lunar-poles-region/)
- [NIAC 2026 EARENDIL / ECLIPSE](https://www.nasa.gov/directorates/stmd/niac/niac-studies/niac-2026-selections/)
- [NASA DRPS lunar-night writeup](https://science.nasa.gov/science-research/science-enabling-technology/technology-highlights/surviving-the-lunar-night-drps-could-enable-the-power-to-explore/)
