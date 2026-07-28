# Moon Base Zero — handoff for building per-competitor models

Written to continue one specific job: replacing the **generic per-type models**
with company-specific hardware, one competitor at a time.

The page is `/moonbase` (`ui/pages/moonbase/index.tsx`). It is a true-to-scale
settlement on the Shackleton connecting ridge, laid out as a city of "districts",
one per capability race. Every declared competitor in a race stands on its own
lot, so a race is something you can *see* rather than read — which is why two
competitors sharing one model is a real bug, not a cosmetic one.

---

## 1. Where things live

| What | File |
|---|---|
| Every procedural model, and the per-project registry | `ui/components/lunar-atlas/ProjectModel.tsx` |
| City layout: districts, lots, streets | `ui/lib/lunar-atlas/baseplan.ts` |
| Orbital stations (the sky) | `ui/lib/lunar-atlas/skyplan.ts` |
| Ground models + beacons on the surface | `ui/components/lunar-atlas/MarkerLayer.tsx` |
| Satellites overhead | `ui/components/lunar-atlas/SkyLayer.tsx` |
| Fixed Earth backdrop | `ui/components/lunar-atlas/EarthGlobe.tsx` |
| Scene, sun, shadows, camera rig | `ui/components/lunar-atlas/MoonGlobe.tsx` |
| Load-in framing | `ui/lib/lunar-atlas/homeview.ts` |
| Camera framings (surface / orbit / sky) | `ui/lib/lunar-atlas/geo.ts` |
| Projects, orgs, races, odds | `ui/lib/lunar-atlas/seed/atlas.dataset.json` |
| Layout unit tests | `ui/cypress/integration/unit/lunar-atlas-baseplan.cy.ts` |

`ProjectModel.tsx` is ~5,700 lines and is *the* file for this work. Read the
model nearest to what you are building before starting — `IxFsp`, `SierraLife`,
`Habitat` (the Thales MPH) and `RelaySat` are the most recent and the most
representative of the current standard.

---

## 2. The queue — what is still generic

Priority is set by **duplication inside a district**, because that is what a user
notices. Construction still renders one model four times over. Comms and ISRU
are each down to a single project (Nokia; Blue Origin) on the generic model,
which is no longer duplication, just one competitor left where the generic
model already happens to be that competitor's own concept:

### Priority 1 — comms / PNT (1 of 4 still on the generic model)

| Odds | Org | Project | id | Status |
|---|---|---|---|---|
| 30% | Nokia Bell Labs | Lunar Surface Communication System | `nokia-lunar-lte` | generic `CommsPnt` |
| 28% | Intuitive Machines | Lunar Relay Satellites | `im-near-space-network` | **done** — `RelaySat` (orbit, ×3) + `RelayGroundTerminal` (ground) |
| 24% | ESA | Lunar Pathfinder & Moonlight | `esa-lunar-pathfinder` | **done** — `Pathfinder` (orbit) + `PathfinderTerminal` (ground) |
| 18% | Crescent Space Services | Parsec | `crescent-parsec` | **done** — `Parsec` (orbit, ×2) + `ParsecTerminal` (ground) |

All four comms bids are now orbiter-plus-ground builds except Nokia, which has
no orbital component to begin with, and each one answers "what's in orbit and
what's on the ground" differently on purpose:

- **IM** (`RelaySat`, ×3 stations + `RelayGroundTerminal`): an operational
  TDRS-class bus, four-panel wings, a big Earth dish, overhead. On the ground,
  a single sealed avionics package on a flight pallet with its own dish
  gimballed straight onto the lid — a delivered unit, not a built site,
  because IM's actual infrastructure is the constellation. Bigger than ESA's
  and Crescent's customer terminals (IM operates the network, they subscribe
  to one) but a fraction of the sprawling mast-shelter-array lot Nokia still
  stands on.
- **ESA** (`Pathfinder`, ×1 station + `PathfinderTerminal`): a 300 kg SSTL
  precursor with one fixed array and two staggered deployables, a small dish
  aimed at the MOON rather than Earth, and a ground lot that is little more
  than a customer's own UHF/S-band mast — Moonlight sells a service, it
  doesn't build a south-pole site.
- **Crescent** (`Parsec`, ×2 stations + `ParsecTerminal`): built on Lockheed's
  off-the-shelf Curio smallsat bus (the same one that flew Lunar Trailblazer),
  smaller again than Pathfinder, with two roughly equal dishes (comms AND
  ranging/PNT, sold as equal products) plus a flat phased-array panel for the
  navigation broadcast. Its ground terminal is the smallest MODEL in the
  district (2.0 m vs. ESA's 2.6 m) — a sealed avionics case on point feet,
  doors and a connector face, a solar panel racked up steeply on its own
  bracket, a small camera/sensor head, and a fixed patch under a radome with
  no antenna gimbal at all, because a multi-satellite network means a
  customer never has to track one specific node. Its ground FOOTPRINT is
  actually a little bigger than ESA's mast despite the smaller model — a
  squat case with a panel racked out behind it covers more ground than one
  point-mast does, so ESA keeps the smallest-footprint lot and Crescent the
  smallest model.

All three orbiters are wired through the same generalized lookup —
`SKY_SAT_MODEL` / `SKY_SAT_SCALE` / `SKY_SAT_SPAN_M` in `ProjectModel.tsx`,
keyed by project id and consumed by `SkyLayer.tsx` — and each gets its own
entry in `SKY_STATIONS` (`skyplan.ts`): 3 stations for IM, 1 for Pathfinder, 2
for Parsec, which is not a portrayal but each program's actual state (an
operational fleet, a single precursor, and a network that starts at two and
scales). Only Nokia's LTE network of small cells remains on the fully generic
`CommsPnt` terminal — the last item in this district.

### Priority 2 — surface construction (4 competitors, 4× the same model)

| Odds | Org | Project | id |
|---|---|---|---|
| 34% | ICON | Project Olympus | `icon-project-olympus` |
| 27% | Redwire | Mason | `redwire-mason` |
| 21% | Astroport Space Technologies | Lunatron / Brickbot | `astroport-lunatron` |
| 14% | AI SpaceFactory | REACT / LINA | `ai-spacefactory-react` |

All four render `ConstructionSite` — the printed apron with the **animated**
gantry (the boom slews; see `PrintBoom`, `SLEW_RAD`, `SLEW_PERIOD_S`). That model
is essentially ICON's concept, so the cheapest correct move is to let ICON keep
the generic slot and build the other three. Astroport's is a *brick* plant, not a
printer, which is a strong visual contrast to lead with.

### Priority 3 — ISRU (done except Blue Origin, which keeps the generic model on purpose)

| Odds | Org | Project | id | Status |
|---|---|---|---|---|
| 41% | Blue Origin | Blue Alchemist ISRU | `blue-origin-blue-alchemist` | generic `IsruPlant` (IS Blue Alchemist's own concept — see PvField) |
| 32% | Sierra Space | Carbothermal Oxygen Reactor | `sierra-space-carbothermal` | **done** — `SierraCarbothermal` |
| 27% | Lunar Resources | Molten Regolith Electrolysis | `lunar-resources-mre` | **done** — `LunarResourcesMre` |

Three different chemistries — Blue's own solar-thermal/electrolysis process,
Sierra's carbothermal reduction, and Lunar Resources' molten regolith
electrolysis — so there is real hardware difference to draw. `IsruPlant`'s
photovoltaic field and solar-thermal receiver already read as Blue Alchemist's
own premise (making solar cells out of regolith), so it keeps the generic
slot the way ICON and the eVinci reactor do elsewhere on this map.

`SierraCarbothermal` is a packaged skid rather than a field-plus-tower
installation, because that is the real state of Sierra's hardware: a
full-scale carbothermal reactor already ran in a thermal-vacuum chamber at
NASA Johnson (the CaRD demonstration), not a concept spread across open
ground. A four-post lattice tower holds a wide reactor vessel (where regolith
actually melts, with a small glowing viewport into the reaction) under a
narrower condenser stage that recovers the carbon monoxide; a hopper feeds
regolith into the reactor's crown; two horizontal tanks downstream hold
product gas; a single solar tracker (not IsruPlant's field of small panels —
Sierra buys conventional power rather than making its own cells) sits off to
one side. The hot supply line off the condenser and the cooled recycle line
back to the hopper follow the same red/blue convention `IsruPlant` uses for
its own thermal loop.

`LunarResourcesMre` reads as one machine rather than Sierra's chain of stages,
because MRE's own pitch is "no consumable reagents": there is nothing to feed
in besides regolith and nothing to recycle back besides current, so the whole
plant is one riveted crucible (the electrolyte pool itself, seen through a
viewport at a paler, hotter glow than Sierra's carbothermal flame), a single
downstream tank collecting both the oxygen and the metal off the same cell,
and a power-conditioning box wired to the crucible by a heavy copper busbar
rather than a solar array — electrolysis draws more continuous current than
a plant this size could collect on its own roof, so it plugs into the base
grid instead of carrying its own field, the same reasoning `SierraLife`'s
softgoods module uses for its own power feed.

### Not actually duplicated (lower priority)

- **`thales-mph`** renders the generic `habitat` model, but that model *is* the
  MPH — it was rebuilt as the MPH deliberately. Habitat district is fully
  differentiated (MPH / Lunar Cruiser / LIFE).
- **`westinghouse-fission-surface-power`** renders the generic `power` model,
  which *is* the eVinci. Power district is fully differentiated (Lockheed / IX /
  eVinci).
- **Placeholder GLBs**, replaced: `blue-origin-blue-moon-mk2` used to render
  `insight-lander.glb` (an InSight Mars lander standing in for Blue Moon). It
  now renders `BlueMoonMk2` — splayed bipod landing gear on gold-MLI lower
  struts, a windowed crew module with a deployable ladder opposite the
  docking hatch, two open lattice bays exposing the propellant tanks, and a
  tapered ascent hull and nose, built off NASA's own Artemis renders of the
  selected lander. `spacex-starship-hls` still uses its GLB.

### Core district — crewed_base (2 of 2 done)

`nasa-artemis-base-camp` renders `CrewedBase`; `ilrs` renders `ILRSBase`. This
pair used to be Artemis Base Camp racing `nasa-artemis-iii` — NASA's own
precursor crewed landing — which was a data bug, not a race: the shared goal's
own description said the two were sequential, not competing, and the
"crewed landing" hardware it stood in for is already raced properly in
`shared-crewed-lander` (`spacex-starship-hls` vs `blue-origin-blue-moon-mk2`).
`nasa-artemis-iii` was removed as a project (its landing milestone folded into
`nasa-artemis-base-camp`'s own milestones), and the China–Russia International
Lunar Research Station (`ilrs`, org `cnsa-roscosmos`) took its place as the
core's actual second competitor — a real, independently-developed, publicly
documented program targeting the same capability at the same pole, on a slower
public timeline (crewed utilization from 2036 vs. Artemis's early-2030s
target).

`ILRSBase` was rebuilt a second time to stand as a real second base rather
than a construction footnote. CNSA's own public roadmap has two horizons, not
one: a single-mast "basic model" through 2035, then an "extended model" in the
2040s officials describe as reaching "considerable scale and stable
operation," hubbed to a second station in lunar orbit (see the `ilrs-extended`
milestone in the dataset). The rebuilt model portrays that later state: the
same shared power/comms mast and fan (`IlrsMast`, unchanged) now sits over
**five** modules (`IlrsModule`, up from three) linked by raised causeways on
support posts (`IlrsCauseway`) rather than standing as five separate,
unconnected landings; a second, independent Earth-link mast off on its own
footing (`IlrsCommsTower`) gives the station redundant comms instead of one
dish for everything; a fixed ground-mounted PV field in the mast's own gold
livery (`IlrsPvFarm`) is the visible sign the station now generates more power
than one fan can carry; and a cargo stack still mid-unload (`IlrsCargoLander`,
now ×2) keeps the "still under construction" honesty the basic-model version
had — ILRS grows by accretion, module by module, at every stage of its
roadmap. `PROJECT_SIZE_M['ilrs']` grew from 13 m to 21.9 m and its footprint
radius from 6.5 m to 12.86 m (confirmed with `scripts/tmp-ilrs-check.ts`,
since deleted) — still well under Artemis Base Camp's 38 m / 19 m, keeping
Artemis the larger of the two the way the higher odds argue it should read,
but no longer a small cluster next to a monument.

Growing ILRS this much moved three numbers in `baseplan.ts`: `RING_RADIUS_M`
(40 → 43) and `HARDSTAND.radius` (34 → 36.5) so the core's now-34.9 m combined
extent still fits inside the perimeter road with a couple of meters to spare,
and the landing zone's distance (`BASE_PLAN.lander`, 130 m → 140 m) so a
Starship-class descent still clears the bigger core by more than the 30 m
ejecta-standoff floor the unit tests assert. `RING_RADIUS_M` is close to its
ceiling now — the power district's own inner corner lots are what stop it
going any further without `MAIN_LOOP_M` moving too (see the comment on
`RING_RADIUS_M`).

---

## 3. Recipe for adding a per-competitor model

1. **Size it.** Add the project's largest real dimension to `PROJECT_SIZE_M` in
   `ProjectModel.tsx`, in meters, with a comment saying which dimension it is and
   where the number comes from. Public figures where they exist, honest estimates
   otherwise.

2. **Author in meters.** Define a scale constant that inverts the size entry:

   ```ts
   const FOO_M = UNIT_MAX_DIM / (PROJECT_SIZE_M['org-project'] ?? 12)
   ```

   then wrap the model in `<group scale={FOO_M}>` and write every dimension
   inside in real meters. This exactly cancels the model-size normalization, so
   a 2.6 m dish really is 2.6 m next to a 1.85 m astronaut. Every recent model
   does this (`IXP_M`, `LIFE_M`, `MPH_*`, `SAT_M`).

3. **Register it** in `PROJECT_MODEL` (bottom of `ProjectModel.tsx`), keyed by
   project id.

4. **Check the footprint.** The district packer spaces lots by
   `footprintRadiusM(project)` = `projectSizeM × FOOTPRINT_FRACTION[id] ?? 0.5`.
   If your model is mostly mast (tall, narrow feet), add a `FOOTPRINT_FRACTION`
   entry or it reserves a lot twice as wide as it needs — see the Lockheed FSP
   entry (`0.21`).

5. **Update the test roster.** `ROSTERS` in
   `cypress/integration/unit/lunar-atlas-baseplan.cy.ts` mirrors those footprint
   radii by hand. Change a size and you must change the roster, or the packing
   assertions are testing a colony that no longer exists.

6. **Verify numerically, then look at it.** See §5.

---

## 4. House rules learned the hard way

These are all mistakes that were made and fixed in this scene. They are cheap to
avoid up front and annoying to find later.

- **Nothing floats, nothing hovers.** Bed every foot, pad and fitting a few
  centimetres *into* what it stands on. Footings should run below grade — a pad
  resolved exactly at `y = 0` lifts clear of any hollow it lands over. Bedding an
  edge a centimetre into regolith is invisible; hovering is not.
- **Nothing is coplanar.** Detail laid flush on a face (cell strings, seams,
  decals) strobes as the camera moves. Stand it proud by 2–4 cm.
- **Fittings on a curved hull need the curve.** A flat frame tangent to a
  cylinder stands off it at the rim. Either sink a *deep* collar into the wall or
  solve the surface height — see `mphFlankZ` in `ProjectModel.tsx`.
- **Check every rotation sign.** This has bitten three separate models. About
  `+X`, a positive rotation carries `+Z` toward `−Y` (i.e. *down*) and lifts the
  far end of a deck laid along `+Z`. Ramps ended up buried at the sill and a
  metre in the air at the foot; the relay's dish aimed 8° into the regolith. If a
  sign is not obvious, compute the resulting world vector in a scratch script.
- **Hemisphere end caps dome the wrong way** if the mirror sign is wrong; the
  give-away is a berthing port that floats off the hull.
- **The sun is at bearing 50°, elevation 44.5°** (`SUN_DIR` in `MoonGlobe.tsx`,
  which must match the terrain bake's hillshade). At 89°S the sun circles near
  the horizon and never climbs, so solar arrays stand **upright across** the
  sun's bearing rather than lying flat, and radiators lie **flat** to see the
  cold zenith. Both facts are already argued in the MPH and relay comments.
- **The Earth sits within a few degrees of the horizon**, so an Earth-pointing
  dish is nearly horizontal — never nadir. Earth itself is now drawn (see
  `EarthGlobe.tsx`): a fixed backdrop sphere at the real bearing/elevation
  (`capLocalDirection` in `southpole.ts`, reusing `SAT_DISH_EL` for elevation
  so the planet and the dishes pointed at it agree) and the real angular
  diameter, at a portrayed distance because the true 384,400 km is past this
  scene's far clip plane and star shell — the same "honest angle, cheated
  distance" rule `skyplan.ts` already uses for satellite altitude.
- **Shadows anchor hardware**, so let models cast them. The exception is
  anything far off the ground: the sun's shadow camera is a ±400 m box on the
  colony, so use `castShadows={false}` (as `SkyLayer` does).
- **Glazing must not cast shadows** — a shadow map is binary and a transparent
  dome would black out the ground beneath it. `SurfaceAnchor` handles this, but
  it means authored opacity has to be set before shadow flags are read.
- **Clone materials** for anything instanced more than once, or the per-instance
  district dim gets fought over by every copy.
- **Emissive accents** in the operator's colour are the house signature: hatch
  lights, boresight markers, ring bands. Keep them small and `toneMapped={false}`.
- **A GLB with no skeleton cannot be re-posed.** `astronaut.glb` was a single
  rigid mesh (no skin, no animation track — check with the raw JSON chunk, not
  by eyeballing the render) frozen in an arms-out reference pose that read as
  the Vitruvian Man. There is no fix for that short of new geometry, so it was
  replaced with a procedural rig (`AstronautRig` / `PatrollingAstronaut` in
  `ProjectModel.tsx`) built from actual hinge groups and driven by `useFrame`
  — the same approach as the LTV's wheels or the print gantry's boom. It is
  now a shared component: drop `<PatrollingAstronaut center={[x, z]}
  radius={r} seed={n} accent={accent} />` into any model for a walking figure
  that wanders a bounded patch rather than standing frozen, in whatever local
  units that model already authors in (see its `fitHeight` prop, which
  follows `GLBModel`'s convention exactly).
- **Site clutter is a shared prop layer, not per-project geometry.**
  `CargoPallet`, `CableReel`, `TailingsPile`, `UtilityCart`, and `ScorchMark`
  (all in `ProjectModel.tsx`, right after `PatrollingAstronaut`) are hand-
  placed into the generic models (`IsruPlant`, `Power`, `Habitat`,
  `CommsPnt`, `ConstructionSite`, `CrewedBase`) and into `ILRSBase`, the same
  deliberate way the ISRU plant's own staged feedstock or the print site's
  paver stacks already were — never inside a per-competitor model, and never
  a random scatter, because an item clipping into a reactor or a dish is
  worse than no item at all. They're authored directly in real meters like
  `Strut`/`LandingPad`, since every call site already authors its own
  geometry that way before its outer `scale={..._M}` wrapper normalizes the
  whole assembly. `ScorchMark` is the un-paved counterpart to `LandingPad`'s
  built-in `PAD_SCORCH` core — for hardware that touches down straight on
  graded regolith (`IlrsCargoLander`) rather than getting a full engineered
  pad.

### Comment style

Comments explain **why**, in prose, and carry the physical or geometric argument
that made the number what it is — including the wrong answer that was tried
first, when that is what stops someone reverting it. They do not narrate what the
code does. Match the density of `SierraLife` or `RelaySat`; that is the standard
throughout this feature.

---

## 5. Verifying

The habit in this feature is: **write a throwaway script, prove the geometry
numerically, delete the script.** Do not eyeball placement. Name them
`scripts/tmp-*.ts` and delete them before finishing.

```bash
cd ui

# Scratch geometry script (tsx is blocked by the sandbox; ts-node works)
npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"commonjs"}' scripts/tmp-foo.ts

# Typecheck
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json

# The four lunar-atlas unit specs (101 tests, all passing as of this handoff)
node node_modules/mocha/bin/mocha.js \
  --require tsconfig-paths/register --require ts-node/register \
  --require scripts/mocha-cypress-setup.cjs --extension ts \
  cypress/integration/unit/lunar-atlas-baseplan.cy.ts \
  cypress/integration/unit/lunar-atlas-geo.cy.ts \
  cypress/integration/unit/lunar-atlas-selectors.cy.ts \
  cypress/integration/unit/lunar-atlas-southpole.cy.ts

yarn dev   # then open /moonbase
```

Things worth asserting in a scratch script: no part floats (compute the gap to
what it sits on), the model's max dimension equals its `PROJECT_SIZE_M` entry,
the footprint still fits its lot with `DISTRICT_GAP_M` to spare, and any
direction you care about (dish axis, array normal) has the world elevation and
bearing you intended.

### Environment quirks

- `npx next lint` **fails to load** the `jsx-a11y` plugin (`[[GeneratorState]]`
  is not present on `O`) — a Node/plugin incompatibility, unrelated to any
  change. Use the editor's diagnostics instead.
- The full `yarn test:cypress-unit` suite has **7 pre-existing failures** in
  `citizenOnboardingImage` (`ReferenceError: File is not defined`). Unrelated to
  the atlas; run the four specs above instead.
- `tsx` fails under the sandbox with `EPERM` (its IPC is blocked). Use `ts-node`.

---

## 6. State of the tree at handoff

Uncommitted work on branch `race-district colony` (last commit `14d23f66e`):

```
 M ui/components/lunar-atlas/MarkerLayer.tsx
 M ui/components/lunar-atlas/MoonGlobe.tsx
 M ui/components/lunar-atlas/ProjectModel.tsx
 M ui/cypress/integration/unit/lunar-atlas-baseplan.cy.ts
 M ui/lib/lunar-atlas/baseplan.ts
 M ui/lib/lunar-atlas/geo.ts
 M ui/lib/lunar-atlas/homeview.ts
 M ui/pages/moonbase/index.tsx
?? ui/components/lunar-atlas/SkyLayer.tsx
?? ui/lib/lunar-atlas/skyplan.ts
```

Typecheck is clean and the 101 lunar-atlas unit tests pass. **Nothing here has
been looked at in a browser yet** — the relay constellation in particular was
verified numerically only.

### What landed most recently

- **IX FSP**, **Thales MPH** (rebuilt as the generic `habitat` model) and
  **Sierra LIFE** models.
- **Home camera refit** so every district clears the timeline and the race panel
  (`homeview.ts`).
- **Relay satellites in orbit.** `RelaySat` replaced the old `OrbitalRelay` stub;
  `skyplan.ts` stations three of them over the colony; `SkyLayer.tsx` renders
  them; `skyViewFraming` in `geo.ts` plus `view: 'sky'` in `GlobeFocus` gives
  them a dedicated shot, reached by selecting the project. `DishAntenna` was
  deleted as dead code and `SurfaceAnchor` gained a `castShadows` prop.

### One thing to know about the sky work

The satellites are **deliberately not in the load-in shot**, and this was
measured rather than guessed. The home frame contains only 3.6° of sky, all of it
behind the title card and the Legend; raising the aim by even 20 m drops the
nearest district behind the timeline. A satellite and the colony cannot share
that frame. So the constellation lives at a real "sky" altitude and gets its own
framing: the eye rises 170 m above the primary satellite and stands off 150 m,
looking *down* at it with the colony filling the background — 227 m slant range,
where a 20 m spacecraft covers an eighth of the frame height and its two
companions read behind it at half and a third of that size. The altitude itself
(160–420 m, where a real relay orbits at tens of km) is the only portrayal cheat
in the scene and is documented as such at the top of `skyplan.ts`.
