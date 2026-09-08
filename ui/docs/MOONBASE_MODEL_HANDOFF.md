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

### The habitat district — the two flagship programs (2 of 2 done)

`crewed_base` and `habitat` are one `ProjectType` now (`habitat`) — a base
isn't a different kind of hardware from a habitat module, just more of it
integrated together, so Artemis Base Camp and ILRS compete on the same
district ground as the MPH, LIFE and Lunar Cruiser modules (see
`BASE_PLAN.habitat` in `baseplan.ts`). Both keep explicit `PROJECT_MODEL` overrides rather than
falling back through `project.type` — `nasa-artemis-base-camp` renders
`CrewedBase`; `ilrs` renders `ILRSBase`. This
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

Growing ILRS this much cost the habitat district real ground, and where that
ground comes from changed with the layout. It used to come out of a fixed
budget: the race stood on a paved hardstand inside a ring road, so a bigger
ILRS meant widening the ring itself, and the ring was near its ceiling because
the power district's own lots were closing in on it from outside.

There is no ring, and no hardstand. The race is a `terminus` district at the
far end of its own branch (`BASE_PLAN.habitat`, off the ridge centre), which
means growth is absorbed by the branch's own `lengthM` — 130 m, with a 38 m
spur at 55 m — and by its `block`, the half-width of the keep-out capsule
around its roads. Currently 39 m against a roster that needs 36.5 m, so about
2.5 m of slack; `scripts/pack-size-tmp.ts` reports that margin per district if
you need to check after a size change.

That is a much cheaper place to grow than the ring was. The ring's diameter
was shared by every plot at once, so one big model widened the whole thing; a
branch is a line, so a big model either takes more of the branch's length or
pushes the district's `block` out laterally, and the two are independent. What
it has to stay clear of is its neighbours' capsules, which is checked
plan-wide rather than only up the street — a diagonal branch can reach past
its own along-spine neighbour toward somebody two crossings away, so
"neighbours in spine order" is no longer a sufficient check and the tests do
not use it.

The landing zone kept its own separation for the same reason it always had
one. `BASE_PLAN.lander` sits 280 m southwest along the spine, standing beside
the road as a `flank` with no branch at all, because a Starship-class descent
has to clear the nearest structure by more than the 30 m ejecta-standoff floor
the unit tests assert, and its 62 m apron is why its `block` (71 m) is nearly
twice any other district's.

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
  which must match the terrain bake's hillshade). The sun never gets near the
  zenith here, so solar arrays are **turned onto the sun's bearing and raked
  back to its elevation** rather than lying flat — which at 44.5° is a roughly
  45° rake — and radiators lie **flat** to see the cold zenith. Both facts are
  already argued in the MPH and relay comments. Note the sun is FIXED: the
  terrain albedo is a hillshade baked from this exact direction, so nothing
  here may be justified by the sun moving.
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
- **A standardized logistics prop family, for "operational" rather than
  "decorative" clutter.** `CargoCrate`/`CrateCluster`, `SparePartsPallet`,
  `BatteryStack`, `FramedTank`, `JunctionBox`, `WorkLightTower`,
  `CargoTrailer`, and `BrickPallet` (`ProjectModel.tsx`, right after
  `ScorchMark`, before `RoverDepotYard`) are a second, larger clutter family
  alongside the first — the difference is that every one of these reads as a
  *recognizable logistics unit* rather than a resized box: `CargoCrate` comes
  in four real size/proportion families (small/medium/large/a long
  antenna-or-drill case) rather than one cube rescaled, each with corner
  handle blocks and a stenciled placard; `SparePartsPallet` racks an actual
  wheel beside cut pipe stock and a coiled hose rather than dropping a bare
  wheel on the regolith; `BatteryStack`'s status LEDs are a fixed
  charge-green rather than any org's accent, because a battery's own
  indicator is never a team's brand color. All of them take a small `seed`
  for deterministic yaw/variant/color variation, all are authored in real
  meters like the first clutter family, and a couple of each have already
  been hand-placed into the generic models (`IsruPlant`, `Power`, `Habitat`,
  `CommsPnt`, `ConstructionSite`, `CrewedBase`, `ILRSBase`) as a first taste
  — the fuller per-district logistics/maintenance/utility treatments this
  family exists for (a real cargo yard, a real maintenance bay, a utility
  ring around the habitats) are each their own follow-up pass, not done yet.
- **The rover district's own lot is shared infrastructure, not a
  competitor's model.** `RoverDepotYard` (`ProjectModel.tsx`, right after
  `ScorchMark`) is a compact 13 x 10 m paved apron with three marked bays,
  charging bollards, a wheel-service canopy, and yard lights. It exists
  because the rover race's actual hardware never parks anywhere — the whole
  field shuttles the length of the spine and back (see `PATROL` in
  `baseplan.ts`) — so every competitor's own plot in that district is bare
  regolith by design, and a literally empty district reads as a gap rather
  than as that story. Two of the three bays are filled (not three, not
  zero — see the section's own comment for why), with `RoverBody` — the
  generic unbranded rover shape kept as the fallback for a future competitor
  with no custom model — parked in a flat neutral tone rather than any org's
  accent, so a depot spare never reads as one team's race entry benched
  there. It has no `PROJECT_SIZE_M`/`TYPE_SIZE_M` entry (it isn't a
  project): `MarkerLayer`'s `depotCorner` computes its own position by hand,
  on a lot beside the HEAD of the depot's own branch rather than on
  `BASE_PLAN.rover`'s own centre, which is the middle of the branch's turning
  circle and would put the apron under the pavement. Worth noticing how much
  simpler this got with each version of the plan: it began as an arcsine swing
  and a radius solved against a circle, because the two roads a district
  fronted were a circle and a radial; it became a pair of flat offsets when
  those became a spine and a perpendicular branch; and now that a district
  fronts ONE road it is just a distance along that road and a distance across
  it, both in the road's own frame. `BASE_PLAN.rover.block` is sized for these
  two rather than for the roster, which is the honest way round — at 2.3 m an
  LTV needs almost no ground, and nothing in the roster ever parks — and
  `scripts/pack-size-tmp.ts` counts them in when it reports the district's
  margin.
- **A driving competitor is framed where it IS on the road — the camera comes
  to the rover, the rover never comes to the camera.** Because the fleet
  shuttles the spine rather than parking (see `PATROL`), a rover's real position
  is never its own bare corner lot (`dir`) and isn't even a fixed road point:
  it's wherever the run has carried it. `CompetitorPlot`'s `useFrame` publishes that
  live surface direction every frame into `LIVE_PATROL_DIR`
  (`MarkerLayer.tsx`, keyed by project id), and the page's `flyToProject` reads
  it so picking a rover from the list zooms straight to it on the road. Opening
  the race rolls the fleet to a stand *in place* (throttle eased to zero) so
  the vehicles sit still while the camera flies in — it deliberately does NOT
  roll them back to any start line, which read as a teleport. The fallbacks, in
  order, are the rover's road *start* position (`standDir`, precomputed into the
  shared `ColonyLayout.plots` table by `buildColonyLayout` for the one frame
  before the model has published anything) and then the plot itself for
  anything that doesn't drive.
- **The rover district's gas/recharge station is its own freestanding site,
  not a corner of the depot yard.** `RoverGasStation` (`ProjectModel.tsx`,
  defined just above `RoverDepotYard`) is a second 10 x 8.8 m paved
  forecourt with its own apron, curb, and terraced skirt (same techniques as
  `RoverDepotYard`'s own — see the `TerracedSkirt` house rule below), placed
  by `RoverGasStationSite`
  (`MarkerLayer.tsx`, right after `RoverDepotSite`) on the OPPOSITE side of
  the depot branch from the depot yard: the same `depotCorner` call with the
  same distance back from the dead end and the same setback across the branch,
  just the other sign (`side` of `-1` instead of `+1`) and its own (smaller)
  footprint radius, so the two take the lots either side of the head of the
  branch, facing each other across the one straight road they both front
  rather than crowding one lot. The forecourt itself is a canopy on four posts (bigger
  than `ServiceCanopy`'s single wheel-hoist shed, since this is meant to
  read as its own site's principal structure) over two `GasPumpIsland`s,
  each with a glowing readout panel and a nozzle racked on a coiled hose
  (deliberately ambiguous between a high-current connector and a cryogenic
  nozzle, since a future competitor's hardware could plausibly be either),
  fed by a pair of `PropellantTank`s via visible piping (`Strut`), a
  `StationSign` pylon taller than the canopy, painted approach lanes
  (`LaneDashes`) leading a vehicle in from the forecourt's own entrance, an
  `AttendantBooth` with a window/door/antenna at the back corner (staff is
  what tells a forecourt apart from a bare pair of pumps), a little supply
  clutter beside it from the shared prop library (`CableReel`, `CargoCrate`),
  two `CornerBollard`s marking the entrance, and its own `PatrollingAstronaut`
  (a different seed than the depot's own mechanic, so the two never
  synchronize). Every fixture's bounding box was checked by hand against
  every other one and against the apron edges before this was called done,
  the same discipline `RoverDepotYard`'s own tight footprint already
  demanded.
- **A rigid apron's own skirt has to be terraced and flared, not a straight
  vertical-walled block, or it reads as a floating slab.** Both
  `RoverDepotYard` and `RoverGasStation` seat on the HIGHEST ground under
  their own footprint (`footprintSeatRadius` in `MarkerLayer.tsx` — a rigid
  apron cannot sink into a slope), which on this ridge's terrain is often
  enough above the surrounding regolith that a single hard-edged box of fill
  under the apron left a visible gap or a plainly man-made vertical wall on
  the downhill side — the whole pad read as hovering on a plinth rather than
  resting on the ground. `TerracedSkirt` (`ProjectModel.tsx`, shared by both)
  fixes this the same way `LandingPad`'s own cone-frustum skirt already
  does for a circular footprint (see its comment), adapted for a rectangle:
  four stacked courses, each a little lower and a little wider than the one
  above, reaching 3.6 m down and 2.8 m out from the apron's own edge —
  roughly double the straight box this replaced on both counts. There is no
  longer a single hard vertical edge for a slope mismatch to expose;
  whichever course the true ground actually intersects, everything below it
  is already buried and everything above it reads as a deliberate stepped
  foundation.
- **The base's own solar farm is the one large installation that belongs to
  no race.** `SOLAR_ARRAYS` (`baseplan.ts`, right after the district keep-out)
  sites it and `SolarFarmSite` (`MarkerLayer.tsx`, just before
  `InterDistrictFiller`) stands it up, out of `VerticalSolarArray`
  (`ProjectModel.tsx`, just before `ServiceCanopy`), whose layout is
  `solarArrayFrame` in `baseplan.ts`. 63 sun-tracking ground-mounted arrays in
  two fields, one on each flank of the spine — a 4x7 of 28 on the industrial
  flank and a 5x7 of 35 by the habitats, which is the larger because that is
  where the continuous life-support load is. Both are COMPLETE rectangles, and
  for the habitat field that is what caps its size rather than the ground: the
  pocket is hemmed by the ISRU plant, the rover and the spine's setback, and a
  bigger lattice loses corners to one of the three. Bigger rectangles exist
  further out, but only by walking the field north of where it belongs.

  Four things about it are geometry rather than decoration, and all four are
  asserted in `lunar-atlas-baseplan.cy.ts` because all four would look
  perfectly fine in a screenshot if they broke:

  - **The arrays are raked back to face the sun.** At this sun elevation that
    is a ~45° rake, which is why they read like the reference concepts.
    Orientation is taken from `SUN_DIR`/`SUN_LOCAL_ELEV_DEG` rather than
    written down: the site hands `SurfaceAnchor` the sun vector as `noseAlong`
    (which lands the face normal, the model's own `+X`, on the sun's azimuth)
    and the model lifts it by the sun's elevation. So the farm cannot face
    somewhere the light is not. The elevation's sign was confirmed against the
    resulting world vector, per the house rule above — negated, it points
    88.9° off, into the ground.
  - **Nothing structural stands in front of the face.** This sounds like it
    could not go wrong and it already did: an earlier version hung the assembly
    off a 10 m mast on a yoke, and because the yoke offset the panel to `-X`
    while the mast stayed at `0`, the mast stood in *front* of the face and ran
    2.5 m past the top of it. Every panel in the field had a pole through the
    middle of it and the scene still rendered as a tidy solar farm. The layout
    therefore lives in `solarArrayFrame` as plain numbers, and the spec checks
    every structural node's signed distance from the face's own plane. Note
    that the mast was not merely ugly, it was the wrong argument: masts are for
    buying HORIZON on a single lander's array, and buy a 40-array field
    nothing.
  - **Each field is surveyed to something, and the two are surveyed to
    different things.** Field 0's rows run square across the sun's bearing, so
    a row's shadow lands on open ground and never on the next row — that is
    the default, and it makes the shadow check true by construction. Field 1's
    run PARALLEL TO THE HABITAT ROAD instead: it shares a frame with that
    street from most of the spine, and a lattice at its own private angle next
    to the one strong line near it reads as debris rather than as plant. What
    the spec asserts is the discipline — every field's rows are parallel to a
    bearing written down elsewhere on the plan — plus which field got which.
  - **The row pitch is derived from the shadow, not declared.** And derived the
    way the shadow actually lands: from the casting array's TOP edge to the
    receiving array's LOWER edge (`SOLAR_SHADOW_PITCH_M`). Centre-to-centre
    against the array height is the tempting version and it is wrong by two
    panel reaches — about 4 m here, which is half the answer, and wrong in the
    permissive direction. Because field 1's lattice is deliberately off the
    sun's axis, the spec checks every PAIR of arrays in the farm rather than
    just the pitch constant: for a lattice off the sun axis, the pitch alone
    stops being proof.

  The face itself is a texture, not geometry: `makeSolarFaceMaps` bakes a 3×3
  module grid with cell lines, busbars and interconnect dots into one 1024²
  albedo plus a **roughness map**, shared by every array. The roughness map
  is the part that makes it read as glass — matte rails against glossy laminate,
  where the CONTRAST is what the eye reads, not either value alone. The gloss
  is a `clearcoat` over a dark diffuse base rather than a low roughness on the
  base, because that is literally what a module is (cells under glass) and
  because a metallic near-mirror crawls: it reflects the environment at a
  frequency finer than a pixel and the renderer cannot filter it. The scene's
  PMREM lunar environment gives the clearcoat something stable to reflect.

  Siting was measured, not eyeballed (`scripts/open-ground-tmp.ts` maps the
  clear ground). Both fields sit in pockets that reach in toward the spine, so
  each is served off the main street and needs no road of its own — but set
  well back from it (13 m at the closest, 26 m on the industrial flank), because
  traffic throws regolith and dust on a blanket is the standing problem with
  lunar PV. Putting the two on OPPOSITE flanks is
  also the strongest form of the reason any real plant distributes its
  generation: no single impact or dust event reaches both. Both are far from
  the landing zone: the nearest race ground stands 59 m off the pads and the
  nearest array 194 m,
  which is the reason the *other* large empty area — the ground beside the
  landing zone — has to stay empty. Ejecta on an airless body leaves at orbital
  speed and does not come back down, and unlike a habitat a panel cannot be
  bermed.
- **The ground between districts is filled by one base-wide layer, not by
  any one district's model.** `InterDistrictFiller` (`MarkerLayer.tsx`,
  after the rover depot and gas station sites and the underground
  construction marker) renders once for the whole colony rather
  than per-district — it's the fix for the fact that most of the plan by
  *area* is neither a district nor a road, and that open regolith is most
  of what the camera sees on approach. It places four things:
  - a scattered boulder field (`Boulder`/`BoulderCluster` in
    `ProjectModel.tsx`, right after `SurveyTripod`, before
    `RoverDepotYard`) — native rock, not manifested cargo, so it belongs on
    unclaimed ground in a way none of the logistics props do — spread
    anywhere on open ground by walking each road run at a fixed stride and
    scattering off to either side with a low keep-rate (reads as scatter,
    not a filled band);
  - street lights (`StreetLight`, a neutral-colored wrapper around the
    depot's own `DepotLightMast`, now parameterized by height/boom length
    so one fixture serves both) along the spine and every branch and spur;
  - staged cargo along the road shoulders — `CrateCluster`,
    `CableReel` (paired with a small `CargoCrate`), `SparePartsPallet`, and
    `BrickPallet`, all exported from the logistics prop library
    specifically for this — because a crate stack or a cable reel reads as
    something a hauler dropped off, so unlike the boulders this one stays
    close to a road on purpose rather than scattering anywhere;
  - a small fleet of parked `Excavator`s (`EXCAVATOR_COUNT`, six) standing on
    the road shoulders, nosed lengthwise along the run they sit on because a
    grader working a shoulder parks with the road, not at a random angle to
    it. These are held to a tighter district margin than the boulders (9 m
    rather than standing well clear): this fleet works right up against a
    district's own edge, which is the whole reason it reads as active.

  All four are kept off every district's own ground — and off the solar farm's
  — by `withinDistrictGround` (`baseplan.ts`, right after `BASE_PLAN`), which
  is read straight off each district's own roads rather than hand-tuned per
  district: `districtGround` returns a CAPSULE along each of a district's
  roads, `block` wide, and the keep-out is the union of those plus one capsule
  per planted solar row. Note the farm reserves its ROWS and not its whole
  rectangle: the clear ground between two rows is a shadow gap rather than a
  yard, so a boulder standing in it costs the field nothing, where a farm that
  claimed its own gaps would sterilize most of the flank it stands on. That replaced a single
  radius in spine coordinates, which had to be as large as a district's
  longest dimension in every direction — fine when every district was a
  compact block on the spine, and hopeless once a district became a 130 m
  branch with a 38 m spur off it, since a circle big enough to cover the
  branch's far end covers a great deal of open ground nobody is ever going to
  build on. It stays deliberately generous within each capsule, though: it
  doesn't know a district's live roster, only the widest spread its `block`
  allows, so a competitor added later can never find a rock, a lamp post, or a
  crate sitting on its future lot. The street lights and the
  roadside cargo are both placed by walking each road run at a fixed stride
  and dropping something once enough *open* road has accumulated since the
  last one — an evenly-spaced-station approach was tried first for the
  lights and aliased badly (7 districts against 7 evenly-spaced stations left
  only one light standing, by coincidence of matching spacing), which the
  walk-and-accumulate approach doesn't have, since a district's block only
  delays the next placement instead of deleting a whole station. The cargo additionally rolls a keep-probability at each
  eligible slot regardless of whether it renders anything, which is what
  keeps its spacing organic (some slots come up bare) rather than every
  eligible slot filling on a metronome. None of the three are dimmed when a
  race is opened (`SurfaceAnchor`'s `dim` is left at its default of 1): all
  belong to the settlement, not to whichever district happens to be
  nearest.
- **Base-wide filler is explicitly non-interactive.** `SurfaceAnchor` always
  used to wire up `onClick`/`onPointerOver`/`onPointerOut` unconditionally,
  which meant even a boulder or a street light — passed no `onClick` at all
  — still swallowed the pointer and switched the cursor to a hand on hover,
  since the handlers were attached whether or not they had anything to call.
  `SurfaceAnchor` now takes an `interactive` flag (default `true`, so every
  competitor's own model is unaffected); `InterDistrictFiller` sets it
  `false` on all three of the layers above, so scenery with nothing to
  select never raycasts a cursor change or eats a click meant for the
  ground behind it.

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

# Every lunar-atlas unit spec (165 tests, all passing as of this handoff)
node node_modules/mocha/bin/mocha.js \
  --require tsconfig-paths/register --require ts-node/register \
  --require scripts/mocha-cypress-setup.cjs --extension ts \
  cypress/integration/unit/lunar-atlas-*.cy.ts

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

Work on branch `feat/moonbase-linear-spine`. Typecheck is clean (the four
pre-existing `import.meta` errors in
`scripts/verify-deprize-moonbase-sepolia.ts` are on `main` too and unrelated),
and all 174 lunar-atlas unit tests pass.

Four scratch scripts under `ui/scripts/` are deliberately left untracked, and
are worth keeping until the layout settles, because between them they are what
makes the plan checkable rather than eyeballed:

| Script | What it answers |
|---|---|
| `branch-survey-tmp.ts` | How far a branch can run off each crossing, per bearing, under the grade and relief budgets |
| `branch-check-tmp.ts` | Whether the plan as written holds: grades, district separation, and roads fouling each other |
| `pack-size-tmp.ts` | Whether each district's `block` actually contains its roster, and by how much |
| `open-ground-tmp.ts` | Where the plan's clear ground actually is, as a map and as the largest clear rectangles — what sited the solar farm |

### What landed most recently

- **The solar farm** — 63 ground-mounted sun-tracking arrays in two fields, one
  on each flank of the spine, the base's first installation that belongs to no
  race. See its own bullet above for the geometry; it exists because the tiered
  plan left large wedges between districts reading as dead ground, and a solar
  farm is the one kind of built ground that is *supposed* to be mostly empty.
  The arrays were rebuilt once already: the first pass put them on 10 m masts,
  which stood a pole in front of every panel and was the wrong argument anyway
  (masts buy horizon for a lander, not for a field). The face also went from
  one flat quad to a textured module grid with a roughness map, because a
  single colour at a single roughness cannot be both rail and glass, and it is
  the difference between them the eye reads as glass.
- **The tiered street plan** — see the top of `baseplan.ts` for the full
  rationale. One straight spine, one branch per district, and a spur off three
  of them; each district stands at the FAR END of its branch rather than on the
  spine, so a road reads as going somewhere. Branch bearings and lengths are
  read off the height field rather than chosen, which is why they come out
  varied (55–145 m, at +40, −130, +55, −35, +80, −50 and +60 degrees off the
  spine, four northwest and three southeast). The old radial-concentric plan's
  core, ring road and central hardstand are all gone.
- **Junctions became hierarchical.** `junctions.ts` swapped its `through`
  boolean for a `rank`, so at a junction the spine beats a branch and a branch
  beats its own spur, and the giving-way road's surface stops at the through
  road's lane edge. Two figures also stopped being constants: the sweep is now
  angle-aware (`JUNCTION_SHALLOW_MARGIN_M`, because a branch leaving at 35°
  lies in the spine's windrow for much longer than one leaving square), and the
  merge scales with the through road's width (a fixed 1.1 m fits the spine and
  overruns anything narrower, leaving a halo of unpaved ground).
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
