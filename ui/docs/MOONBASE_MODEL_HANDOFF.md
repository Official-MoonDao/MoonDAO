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
notices. Three districts currently render one model several times over:

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
  navigation broadcast. Its ground terminal is the smallest lot in the
  district by far — a sealed avionics case on point feet, doors and a
  connector face, a solar panel racked up steeply on its own bracket, a small
  camera/sensor head, and a fixed patch under a radome with no antenna gimbal
  at all, because a multi-satellite network means a customer never has to
  track one specific node.

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

### Priority 3 — ISRU (3 competitors, 3× the same model)

| Odds | Org | Project | id |
|---|---|---|---|
| 41% | Blue Origin | Blue Alchemist ISRU | `blue-origin-blue-alchemist` |
| 32% | Sierra Space | Carbothermal Oxygen Reactor | `sierra-space-carbothermal` |
| 27% | Lunar Resources | Molten Regolith Electrolysis | `lunar-resources-mre` |

All three render `IsruPlant`. Three different chemistries — molten regolith
electrolysis, carbothermal reduction, and Blue's own electrolysis — so there is
real hardware difference to draw.

### Not actually duplicated (lower priority)

- **`thales-mph`** renders the generic `habitat` model, but that model *is* the
  MPH — it was rebuilt as the MPH deliberately. Habitat district is fully
  differentiated (MPH / Lunar Cruiser / LIFE).
- **`westinghouse-fission-surface-power`** renders the generic `power` model,
  which *is* the eVinci. Power district is fully differentiated (Lockheed / IX /
  eVinci).
- **Placeholder GLBs** worth replacing eventually: `blue-origin-blue-moon-mk2`
  uses `insight-lander.glb` (an InSight Mars lander standing in for Blue Moon).

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
target). `ILRSBase` is sized smaller than `CrewedBase` (13 m vs. 38 m) on
purpose: ILRS's own roadmap has it in a robotic construction phase through
2035 — a shared power/comms mast with a handful of separately-landed modules
underneath it — rather than the crewed habitat-plus-greenhouses Artemis Base
Camp is designed as; the core district's hardstand only has room for a plot
this size next to the 38 m camp regardless.

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
  dish is nearly horizontal — never nadir.
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
