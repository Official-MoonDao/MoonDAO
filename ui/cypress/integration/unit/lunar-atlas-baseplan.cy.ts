/**
 * Moon Base Zero street plan (headless, mocha + chai).
 *
 * The plan is geometry that nothing on screen will tell you has broken. Add a
 * fourth competitor to a race and two lots quietly overlap, and what you see is
 * one reactor standing inside another; shorten a branch and its outer lots stand
 * on open regolith. So the invariants are asserted here: no two plots touch,
 * every plot fronts a street at the same setback, every road reaches the lots it
 * serves, the spine runs past both ends of the settlement, and the districts
 * clear each other.
 *
 * The plan is TIERED — one spine, a branch per district running out to it, and a
 * spur off three of those branches — so almost every check below is stated in
 * the frame of the road a lot actually FRONTS (`along` measured from that road's
 * dead end, `across` to the left of it) rather than in the spine's frame this
 * file used to be written in. That is not a rename. A district no longer sits on
 * the spine, so a lot's offset from the spine says nothing about its setback,
 * and the frame a check is written in is the difference between asserting the
 * plan and asserting nothing.
 *
 * Two things about the shape of the layout are asserted directly rather than
 * left to the eye, because the layout was reworked precisely to fix them and
 * regressing either would look fine in a screenshot: the districts stand at the
 * ENDS of their branches rather than on the spine, and the branches VARY — in
 * length, in bearing, and in which side of the spine they take.
 */

import { expect } from 'chai'
import {
  BASE_PLAN,
  BASE_STREETS,
  BRANCH_TAIL_M,
  DISTRICT_GAP_M,
  PATROL,
  RANK_BRANCH,
  RANK_SPINE,
  RANK_SPUR,
  ROAD_HALF_M,
  ROAD_RUNS,
  SETBACK_M,
  SOLAR_ARRAYS,
  SOLAR_ARRAY_R_M,
  SOLAR_FARM_ZONES,
  SOLAR_PANEL_HALF_W_M,
  SOLAR_ROW_PITCH_M,
  SOLAR_SHADOW_PITCH_M,
  solarArrayFrame,
  SPINE_BEARING_DEG,
  SPINE_END_M,
  SPINE_START_M,
  at,
  dirFor,
  distToRoadM,
  districtAlongM,
  districtExtentM,
  districtGround,
  districtRoads,
  districtSlots,
  frontingRoad,
  onRoad,
  shuttleAt,
  shuttleLapM,
  spineCoords,
  withinDistrictGround,
  type Plot,
  type SitePlan,
} from '../../../lib/lunar-atlas/baseplan'
import {
  BURIED_HABITATS,
  vaultGeometry,
} from '../../../lib/lunar-atlas/subplan'
import {
  SUN_LOCAL_BEARING_DEG,
  SUN_LOCAL_ELEV_DEG,
} from '../../../lib/lunar-atlas/sun'
import {
  BREACH_LOT_RADIUS_M,
  TRACK_CORRIDOR_HALF_M,
  TRACK_DECK_CLEAR_M,
  TRACK_HEADING_DEG,
  TRACK_LENGTH_M,
  TRACK_SPLAY,
  bentLegs,
  trackBentStations,
  trackDeckY,
  trackLegHeights,
} from '../../../lib/lunar-atlas/trackplan'
import type { ProjectType } from '../../../lib/lunar-atlas/types'

const plots = (...radii: number[]): Plot[] =>
  radii.map((radiusM, i) => ({ id: `p${i}`, radiusM }))

// A terminus district at the end of its own branch, which is the default
// everything else is measured against.
//
// Both the crossing and the bearing are chosen to be awkward. `along` 120
// rather than 0, because at the origin the spine's frame and the map frame share
// a centre and a check written in the wrong one would still pass. And a bearing
// of 150 deg, which is neither the spine's nor square to it, because those are
// the two values that let a frame error cancel: a branch on the spine's own
// bearing makes `along` and `across` agree between the two frames, and a
// perpendicular one makes them swap cleanly.
const FIXTURE_ALONG_M = 120
const FIXTURE_BEARING_DEG = 150
const FIXTURE_LENGTH_M = 90
const terminus = (over: Partial<SitePlan> = {}): SitePlan => {
  const branch = {
    bearingDeg: FIXTURE_BEARING_DEG,
    lengthM: FIXTURE_LENGTH_M,
    ...over.branch,
  }
  const crossing = at(FIXTURE_ALONG_M)
  const [de, dn] = dirFor(branch.bearingDeg)
  return {
    east: crossing.east + de * branch.lengthM,
    north: crossing.north + dn * branch.lengthM,
    alongM: FIXTURE_ALONG_M,
    turn: 0,
    ...over,
    branch,
  }
}

// A plot's position in the frame of the road it FRONTS: `along` measured out
// from the point that road's centreline ends — so a positive value is past the
// dead end, where the head plot stands, and a negative one is back down the
// approach — and `across` to the left of that road's outbound direction.
//
// This is the frame nearly every assertion below is written in, and it replaced
// one written in the spine's frame. That was the right frame while every
// district straddled the spine; now that the comms race stands at the end of a
// 145 m branch on a bearing 80 deg off it, a lot's offset from the spine is a
// number with no meaning at all.
const onItsRoad = (plan: SitePlan, slot: { east: number; north: number }) => {
  const road = frontingRoad(plan, slot)
  const [de, dn] = dirFor(road.bearingDeg)
  return {
    alongM:
      (slot.east - road.head.east) * de + (slot.north - road.head.north) * dn,
    acrossM: road.acrossM,
  }
}

// Distance from a point to a segment, for the district keep-out capsules.
const segDistM = (
  east: number,
  north: number,
  [ax, ay]: [number, number],
  [bx, by]: [number, number]
): number => {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t =
    len2 > 0
      ? Math.max(0, Math.min(1, ((east - ax) * dx + (north - ay) * dy) / len2))
      : 0
  return Math.hypot(east - (ax + dx * t), north - (ay + dy * t))
}

// Closest approach between the EDGES of every pair of plots, which is the
// number that matters: plots are spaced from their edges, not their centres.
function tightestGap(plan: SitePlan, list: Plot[]): number {
  const slots = districtSlots(plan, list)
  let min = Infinity
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = slots.get(list[i].id)!
      const b = slots.get(list[j].id)!
      const d = Math.hypot(a.east - b.east, a.north - b.north)
      min = Math.min(min, d - list[i].radiusM - list[j].radiusM)
    }
  }
  return min
}

// The real rosters, by race. Radii are footprints in meters (footprintRadiusM).
const ROSTERS: Partial<Record<ProjectType, Plot[]>> = {
  // The whole habitat race, largest to smallest: Artemis Base Camp (38 m,
  // dome-to-dome) and ILRS (21.9 m, comms guy anchor to the PV field's far
  // corner) — the two publicly declared sustained-presence programs, not one
  // competing against its own precursor lander; ILRS reads as the
  // extended-model station China/Roscosmos have on the public roadmap for the
  // 2040s, not the single-mast 2035 basic model — alongside Sierra's
  // inflatable LIFE habitat and Thales' MPH module, and Toyota's Lunar Cruiser
  // (3.3 m). A base is not a different kind of thing from a habitat module,
  // just more of them integrated together, so all five compete on the same
  // hardstand.
  //
  // The two modules are BURIED, and the figures below are the ones that costs
  // them: 13.937 and 14.056 m are their cover mounds' half-lengths, not their
  // hulls' — a cut-and-cover berm reaches about twice as far as the can under
  // it, so each went from a ~6 m plot to a ~14 m one. Both come out of
  // vaultGeometry (lib/lunar-atlas/subplan) via footprintRadiusM, so a change
  // to either vault's span, length, cover or excavation moves them and this
  // roster has to be recomputed rather than nudged. Artemis Base Camp at 19 m
  // is the largest, so it is what sets this district's `reach` — and at 47 m
  // that is the longest branch on the plan.
  habitat: plots(19, 12.86, 13.937, 14.056, 3.3),
  lander: plots(31.2, 9.6),
  // eVinci radiator wall, IX's radiator canopy, Lockheed's radiator mast — the
  // three fission bids, and three very different amounts of ground.
  power: plots(11, 6.5, 4),
  // Blue Origin, Sierra, Lunar Resources — dataset order. Sierra's packaged
  // skid (5.35) and Lunar Resources' single crucible (5.58) are each little
  // more than half the generic field-plus-tower footprint (9.5) Blue Origin
  // still stands on.
  isru_plant: plots(9.5, 5.35, 5.58),
  rover: plots(2.3, 2.1, 2.2),
  // ICON, Redwire, Astroport, AI SpaceFactory, Astrobotic — five bids on the
  // same generic paving footprint, and one of only two districts that field
  // more than four. It is therefore what exercises the spill in districtSlots'
  // crossroads case, so this roster has to stay at the real count: at four it
  // silently stopped covering that branch, which is how a fifth lot came to be
  // placed off the end of its own road.
  construction: plots(6.3, 6.3, 6.3, 6.3, 6.3),
  // Nokia, ESA, Crescent, IM — dataset order. ESA's user terminal (1.04) and
  // Crescent's (1.52) are a fraction of the ground Nokia takes. Crescent's
  // case is a bigger footprint than ESA's mast despite being the smaller
  // program's terminal by design intent, because a mast plants on one point
  // while a case-plus-panel spreads flat — both still sell a service off a
  // relay in orbit rather than building a south-pole site. IM's sealed
  // avionics package (1.13) sits between the two — it operates the network
  // rather than subscribing to one — but is a fraction of the generic
  // mast-shelter-array lot Nokia still stands on.
  comms_pnt: plots(7.5, 1.04, 1.52, 1.13),
  // A single concept-study competitor, standing alone on its own corner lot.
  // The lot holds the launcher's BREACH WORKS only (BREACH_LOT_RADIUS_M) — the
  // 600 m guideway runs out of it and is checked as a corridor, further down,
  // because no disc describes it. This used to be 33.6 m, a fraction of the
  // model's own length that had to be kept paired with the district's `turn`.
  mass_driver: plots(BREACH_LOT_RADIUS_M),
}

const races = Object.entries(ROSTERS) as [ProjectType, Plot[]][]

// Ground taken by SHARED infrastructure rather than by anyone's competitor —
// mirrored by hand from the model layer exactly as ROSTERS mirrors
// footprintRadiusM, and for the same reason: this file must not import the
// models. Only the rover district has any: its whole roster is out driving (see
// PATROL), so what stands at the head of its branch is the depot yard and the
// recharge station, and its `block` is sized for those rather than for an LTV.
// See `DEPOT_FOOTPRINT_R` and `GAS_STATION_FOOTPRINT_R` in MarkerLayer.tsx.
const SHARED_GROUND: Partial<Record<ProjectType, number[]>> = {
  rover: [9, 7.25],
}

// Where that shared infrastructure actually stands, mirroring `depotCorner` in
// MarkerLayer the same way SHARED_GROUND mirrors its footprints: a lot on each
// side of the head of the district's branch, at its own frontage off that road
// and back from the dead end by its own radius.
//
// Placed rather than fed through districtSlots, because it is not a competitor
// and does not pack like one — the head of the branch stays empty here, which is
// the whole point of the depot district (its fleet is out driving).
function sharedLots(
  category: ProjectType
): { east: number; north: number; radiusM: number }[] {
  const radii = SHARED_GROUND[category]
  if (!radii) return []
  const plan = BASE_PLAN[category]!
  const [ue, un] = dirFor(plan.branch!.bearingDeg)
  return radii.map((radiusM, i) => {
    const across = (i % 2 ? -1 : 1) * (ROAD_HALF_M + SETBACK_M + radiusM)
    return {
      east: plan.east + ue * -radiusM - un * across,
      north: plan.north + un * -radiusM + ue * across,
      radiusM,
    }
  })
}

// How far a district's ground actually reaches once its real roster AND anything
// shared standing on its lots are packed, in the frame of the roads it fronts:
//
//   lateral — the furthest any plot's edge gets from the centreline of its own
//             road. This is what `block` has to cover, because the keep-out is
//             a capsule along that road (see districtGround).
//   ahead   — the furthest any plot's edge gets PAST the dead end of its road,
//             which is where the head plot stands.
//   behind  — the furthest back down the approach any plot's edge reaches,
//             which is what the road has to be long enough to serve.
//
// All three are checked against hand-set numbers, and neither the rosters nor
// the yard footprints are hand-set, so this is what keeps them honest.
function districtNeed(category: ProjectType, field: Plot[]) {
  const plan = BASE_PLAN[category]!
  const slots = districtSlots(plan, field)
  let lateral = 0
  let ahead = 0
  let behind = 0
  for (const plot of field) {
    const here = onItsRoad(plan, slots.get(plot.id)!)
    lateral = Math.max(lateral, Math.abs(here.acrossM) + plot.radiusM)
    ahead = Math.max(ahead, here.alongM + plot.radiusM)
    behind = Math.max(behind, -here.alongM + plot.radiusM)
  }
  for (const lot of sharedLots(category)) {
    const here = onItsRoad(plan, lot)
    lateral = Math.max(lateral, Math.abs(here.acrossM) + lot.radiusM)
    ahead = Math.max(ahead, here.alongM + lot.radiusM)
    behind = Math.max(behind, -here.alongM + lot.radiusM)
  }
  return { lateral, ahead, behind }
}

// True if a point stands on ONE named district's ground — the per-district form
// of withinDistrictGround, which only answers for the base as a whole. Needed
// because the guideway legitimately stands on its own district and must clear
// everyone else's.
function onDistrictGround(
  category: ProjectType,
  east: number,
  north: number,
  marginM: number
): boolean {
  return districtGround(BASE_PLAN[category]!).some(
    (z) => segDistM(east, north, z.a, z.b) <= z.halfM + marginM
  )
}

describe('moon base zero street plan', () => {
  describe('districtSlots', () => {
    it('stands a lone competitor at the head of its road, not in the turning circle', () => {
      const plan = terminus()
      const only = districtSlots(plan, plots(5)).get('p0')!
      const here = onItsRoad(plan, only)
      // Dead ahead at the end of the road, square across it.
      expect(here.acrossM, 'on the centreline').to.be.closeTo(0, 1e-9)
      // And clear of the pavement: the tail, then the turning circle, then its
      // own setback. Standing at the district centre itself would put it in the
      // middle of that circle.
      expect(here.alongM, 'past the pavement').to.be.closeTo(
        BRANCH_TAIL_M + ROAD_HALF_M + SETBACK_M + 5,
        1e-9
      )
    })

    it('keeps every plot clear of every other, for any size of field', () => {
      // Mixed radii matter most; equal circles are the easy case. Five and six
      // exercise the approach filling back down both sides of the road, which
      // is the path a race that gains competitors will take.
      const fields = [
        plots(9.5, 9.5),
        plots(31.2, 9.6),
        plots(11, 11, 4),
        plots(6.3, 6.3, 6.3, 6.3),
        plots(19, 6, 6, 6, 6),
        plots(2.3, 2.1, 2.2, 8, 15, 3),
      ]
      for (const field of fields) {
        expect(
          tightestGap(terminus(), field),
          `field of ${field.length}`
        ).to.be.greaterThan(DISTRICT_GAP_M)
      }
    })

    it('sends a spur field round the corner rather than further down the road', () => {
      // The point of the spur tier: the smallest competitors get their own dead
      // end instead of a place in a line of five. Without it, a big roster packs
      // as a terrace, which is what the layout was reworked to stop.
      const withSpur = terminus({
        branch: {
          bearingDeg: FIXTURE_BEARING_DEG,
          lengthM: FIXTURE_LENGTH_M,
          spur: { atM: 40, bearingDeg: 60, lengthM: 30, takes: 2 },
        },
      })
      const field = plots(12, 9, 7, 3, 2)
      const slots = districtSlots(withSpur, field)
      const roads = districtRoads(withSpur)
      expect(roads, 'branch and spur').to.have.length(2)

      // The two SMALLEST front the spur; the three largest front the branch.
      const onSpur = field.filter(
        (p) => frontingRoad(withSpur, slots.get(p.id)!).bearingDeg === 60
      )
      expect(
        onSpur.map((p) => p.radiusM).sort((a, b) => a - b),
        'the small stuff goes round the corner'
      ).to.deep.equal([2, 3])

      // And they are still clear of everything, which is the thing that breaks
      // when a spur leaves its branch too near the terminus cluster.
      expect(tightestGap(withSpur, field)).to.be.greaterThan(DISTRICT_GAP_M)
    })

    it('stands every plot the same setback off the street it fronts', () => {
      // The one number that makes the whole base read as surveyed: every asset
      // on the base ends up with an identical strip of clear regolith at its
      // edge, whichever tier of road it happens to front.
      //
      // Two cases, because a dead end has two kinds of lot. A plot BESIDE the
      // road clears the road's half-width plus the setback, laterally. The plot
      // at the HEAD of it stands on the centreline and clears the tail, the
      // turning circle and the setback, longitudinally. Both hold EXACTLY, for
      // every lot — which is what a plan of straight roads buys: on the
      // concentric plan the setback off main street was measured radially and
      // the branch setback could only ever be an arc-versus-tangent
      // approximation.
      for (const [category, field] of races) {
        const plan = BASE_PLAN[category]!
        if (plan.front) continue
        const slots = districtSlots(plan, field)
        for (const plot of field) {
          const { alongM, acrossM } = onItsRoad(plan, slots.get(plot.id)!)
          const head = Math.abs(acrossM) < 1e-9
          if (head) {
            expect(
              alongM,
              `${category}/${plot.id} off the head of its road`
            ).to.be.closeTo(
              BRANCH_TAIL_M + ROAD_HALF_M + SETBACK_M + plot.radiusM,
              1e-9
            )
          } else {
            expect(
              Math.abs(acrossM),
              `${category}/${plot.id} off its road`
            ).to.be.closeTo(ROAD_HALF_M + SETBACK_M + plot.radiusM, 1e-9)
            // Beside the approach, never out past the dead end — that is the
            // head lot's ground and the turning circle's.
            expect(
              alongM,
              `${category}/${plot.id} is back down the approach`
            ).to.be.at.most(1e-9)
          }
        }
        // Exactly one lot per road gets the head, which is what makes a branch
        // read as a road TO somewhere rather than a road past some things.
        const roads = districtRoads(plan)
        for (const road of roads) {
          const heads = field.filter((plot) => {
            const here = onItsRoad(plan, slots.get(plot.id)!)
            return (
              Math.abs(here.acrossM) < 1e-9 &&
              frontingRoad(plan, slots.get(plot.id)!).bearingDeg ===
                road.bearingDeg
            )
          })
          expect(
            heads.length,
            `${category} head lots on its ${road.rank === RANK_SPUR ? 'spur' : 'branch'}`
          ).to.equal(1)
        }
      }
    })

    it('is deterministic — the same field lays out identically', () => {
      const field = plots(9.5, 9.5, 9.5)
      const a = districtSlots(terminus(), field)
      const b = districtSlots(terminus(), field)
      for (const p of field) expect(a.get(p.id)).to.deep.equal(b.get(p.id))
    })

    it('does not depend on the order the field arrives in', () => {
      // Rosters are sorted by market odds upstream, which changes whenever the
      // odds do. The ground must not move when the leaderboard does.
      const field = plots(11, 4, 11)
      const forward = districtSlots(terminus(), field)
      const reversed = districtSlots(terminus(), [...field].reverse())
      for (const p of field) {
        expect(forward.get(p.id)).to.deep.equal(reversed.get(p.id))
      }
    })

    it('aligns each plot to its street rather than spinning it round', () => {
      const slots = districtSlots(terminus({ turn: 22 }), plots(6, 6, 6, 6))
      for (const [, slot] of slots) {
        // Buildings on a street read as aligned to it. The jitter only exists so
        // four identical relay terminals aren't four copies of one render.
        expect(Math.abs(slot.turn - 22)).to.be.lessThan(8)
      }
    })

    it('flanks a road with the landing zone rather than cornering it', () => {
      const plan = BASE_PLAN.lander!
      const slots = districtSlots(plan, ROSTERS.lander!)
      const side = (id: string) =>
        Math.sign(onItsRoad(plan, slots.get(id)!).acrossM)
      // One pad each side of the spine: it runs BETWEEN them, so the haul road
      // carries straight on past both instead of dead-ending at the near one.
      // This is the one district with no branch of its own, and the reason is
      // not grade — a branch here is buildable — but that a landing zone is
      // the one installation you must not put at the end of a cul-de-sac. See
      // BASE_PLAN.lander.
      expect(side('p0')).to.equal(-side('p1'))
      expect(
        BASE_STREETS.some((st) => st.serves?.includes('lander')),
        'the landing zone has no branch'
      ).to.equal(false)
    })
  })

  describe('the colony', () => {
    it('gives every race in the plan a district', () => {
      for (const [category] of races) {
        expect(BASE_PLAN[category], category).to.exist
      }
    })

    it('stands every district at the end of its own branch, not on the spine', () => {
      // The change the whole relayout is: a district's centre is the point its
      // branch REACHES, not a point on the through road. Everything that used to
      // sit on the spine now stands 55 to 145 m off it.
      //
      // Asserted as an identity rather than against expected coordinates,
      // because the identity is what has to hold: walk out from the crossing on
      // the declared bearing for the declared length and you arrive at the
      // district. Exact, because BASE_PLAN's positions are derived by `district()`
      // rather than written as hand-rounded pairs — which is the one thing that
      // guarantees a district cannot drift off its own road.
      for (const [category] of races) {
        const plan = BASE_PLAN[category]!
        const crossing = at(plan.alongM)
        if (!plan.branch) {
          // The landing zone is the exception, and flanks the spine.
          expect(spineCoords(plan).acrossM, `${category} flanks`).to.be.closeTo(
            0,
            1e-9
          )
          continue
        }
        const [de, dn] = dirFor(plan.branch.bearingDeg)
        expect(plan.east, `${category} east`).to.be.closeTo(
          crossing.east + de * plan.branch.lengthM,
          1e-9
        )
        expect(plan.north, `${category} north`).to.be.closeTo(
          crossing.north + dn * plan.branch.lengthM,
          1e-9
        )
        // And it really is OFF the spine, by the whole length of its branch's
        // perpendicular component. Anything less than a road's width would mean
        // the district was still effectively standing on the through road.
        expect(
          Math.abs(spineCoords(plan).acrossM),
          `${category} stands off the spine`
        ).to.be.greaterThan(2 * ROAD_HALF_M)
      }
    })

    it('varies the branches rather than ruling them', () => {
      // The layout's defect before this rework was not a broken invariant. Every
      // check in this file passed: eight straight branches, all square to the
      // spine, all symmetric about it, all between 21 and 71 m, every asset
      // crowded onto the one through road. It was correct and it read as a
      // fishbone.
      //
      // So the variety is asserted, because nothing else here would notice it
      // going away. The three claims are the three axes it varies on, and all
      // three are consequences of the height-field survey rather than of taste —
      // see the notes at the top of baseplan.ts.
      const branched = races
        .map(([category]) => BASE_PLAN[category]!)
        .filter((p) => !!p.branch)
      expect(branched.length, 'branched districts').to.be.at.least(6)

      // 1. Lengths differ, and by a lot: no two districts sit at the same
      //    distance off the street, so the settlement has depth from any angle.
      const lengths = branched.map((p) => p.branch!.lengthM)
      expect(new Set(lengths).size, 'no two branches share a length').to.equal(
        lengths.length
      )
      expect(
        Math.max(...lengths) / Math.min(...lengths),
        'longest to shortest branch'
      ).to.be.at.least(2)

      // 2. Bearings differ, and none of them is square to the spine — which is
      //    the fall line off this crest, and therefore the one bearing a long
      //    branch cannot use.
      const offsets = branched.map(
        (p) => (((p.branch!.bearingDeg - SPINE_BEARING_DEG) % 360) + 540) % 360 - 180
      )
      expect(new Set(offsets).size, 'no two branches share a bearing').to.equal(
        offsets.length
      )
      for (const [i, off] of offsets.entries()) {
        expect(
          Math.abs(Math.abs(off) - 90),
          `branch ${i} is square to the spine`
        ).to.be.greaterThan(5)
        // But still recognisably a branch off the street rather than a second
        // street running beside it.
        expect(Math.abs(off), `branch ${i} barely leaves the spine`).to.be.at.least(
          30
        )
      }

      // 3. Both flanks of the ridge are used. The southeast side falls away
      //    around the middle of the spine, so the split cannot be even — but a
      //    plan that used one side only would read as a comb.
      const left = offsets.filter((o) => o > 0).length
      expect(left, 'districts northwest of the spine').to.be.at.least(2)
      expect(
        offsets.length - left,
        'districts southeast of the spine'
      ).to.be.at.least(2)
    })

    it('keeps every crossing inside the length of the spine', () => {
      // A branch that leaves the spine past the end of it is a branch with no
      // road behind it. Measured at the CROSSING rather than at the district,
      // because the district is deliberately off the spine and its own distance
      // along says nothing about whether the through road reaches its turning.
      for (const [category] of races) {
        const alongM = districtAlongM(BASE_PLAN[category]!)
        expect(alongM, `${category} crosses off the southwest end`).to.be.greaterThan(
          SPINE_START_M
        )
        expect(alongM, `${category} crosses off the northeast end`).to.be.lessThan(
          SPINE_END_M
        )
      }
    })

    it('clears each district of every other, in the plan and not just up the street', () => {
      // The spacing used to be one-dimensional: every district sat on the spine,
      // so the only question was how far apart along it their blocks reached.
      // Now that they stand off the road on seven bearings, two districts can be
      // 60 m apart along the street and 200 m apart on the ground — which is
      // exactly what lets the crossings sit closer together than their blocks
      // are wide, and why this is measured centre to centre in the plan.
      const zones = races.map(([category, field]) => ({
        category,
        plan: BASE_PLAN[category]!,
        need: districtNeed(category, field),
      }))
      for (let i = 0; i < zones.length; i++) {
        for (let j = i + 1; j < zones.length; j++) {
          const a = zones[i]
          const b = zones[j]
          const apart = Math.hypot(
            a.plan.east - b.plan.east,
            a.plan.north - b.plan.north
          )
          // Each district's own reach, whichever direction it reaches furthest.
          const reach = (z: typeof a) =>
            Math.max(z.need.lateral, z.need.ahead, z.need.behind)
          expect(
            apart - reach(a) - reach(b),
            `${a.category} to ${b.category}`
          ).to.be.at.least(DISTRICT_GAP_M)
        }
      }
    })

    it('has nothing on the base standing inside anything else', () => {
      // Every plot in the colony against every other, rather than district
      // bounding radii against each other: the landing zone's radius is set by a
      // 62 m apron off one side of its road, so a circle round the district would
      // fail this while the ground stays perfectly clear.
      const placed = races.flatMap(([category, field]) => {
        const slots = districtSlots(BASE_PLAN[category]!, field)
        return field.map((plot) => ({
          id: `${category}/${plot.id}`,
          slot: slots.get(plot.id)!,
          r: plot.radiusM,
        }))
      })
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i]
          const b = placed[j]
          const gap =
            Math.hypot(a.slot.east - b.slot.east, a.slot.north - b.slot.north) -
            a.r -
            b.r
          // A 'lot' district's two neighbours are packed to EXACTLY the gap
          // (see the `lot` case in districtSlots — nothing in BASE_PLAN uses
          // it today, but the mechanism is still exact), so this is a
          // floating-point tie rather than real slack there — allow the
          // same 1e-6 the rest of this file uses for exact geometric
          // identities.
          expect(gap, `${a.id} vs ${b.id}`).to.be.at.least(DISTRICT_GAP_M - 1e-6)
        }
      }
    })

    it('gives the habitat race a quiet address rather than the main road', () => {
      // The habitat race has been moved twice, away from the same mistake both
      // times. It began as THE CORE — a plaza of its own inside a perimeter
      // road, on a 60.5 m paved hardstand, packed as a ring of five. Then it
      // became an ordinary district standing ON the spine. Both put the crew's
      // front door on the road every hauler, propellant tank and paving machine
      // on the base uses.
      //
      // It is now at the end of the longest branch of any inhabited district,
      // which is what habitation on a linear plan is for.
      const habitat = BASE_PLAN.habitat!
      expect(habitat.front, 'no special frontage').to.be.undefined
      expect(habitat.branch, 'the habitat race has a branch').to.exist

      // Further off the through road than any other district where people live
      // or work — the only things further out are relay masts.
      const off = (category: ProjectType) =>
        Math.abs(spineCoords(BASE_PLAN[category]!).acrossM)
      for (const [category] of races) {
        if (category === 'habitat' || category === 'comms_pnt') continue
        expect(off('habitat'), `habitat stands further out than ${category}`).to.be
          .greaterThan(off(category))
      }

      // And it has a spur, so the two buried modules get their own frontage
      // instead of a place in a line of five.
      expect(habitat.branch!.spur, 'the habitat branch has a spur').to.exist

      // It also still packs tighter than the ring did, which is worth keeping
      // hold of because the ring was near its ceiling and this is not. Measured
      // as the width of the BUILT STRIP either side of its roads, not as
      // districtExtentM: that returns the furthest any plot gets from the
      // district centre, and with two competitors round the corner on a spur the
      // furthest plot from the centre is 89 m away without the race occupying
      // anything like a 89 m circle.
      expect(
        districtNeed('habitat', ROSTERS.habitat!).lateral,
        'packs no wider than the ring it replaced'
      ).to.be.lessThan(58.7)
    })

    it('leaves every plot clear of every road, not just its own two', () => {
      // The check that used to be "clear of the perimeter road", and it is
      // strictly stronger: a lot is measured against the whole network, so a
      // district moved next to a neighbour's branch is caught too. The old plan
      // could not ask this — main street was a spline that bulged inside its own
      // circle, so the distance to it was only ever approximate.
      for (const [category, field] of races) {
        const plan = BASE_PLAN[category]!
        const slots = districtSlots(plan, field)
        for (const plot of field) {
          const slot = slots.get(plot.id)!
          expect(
            distToRoadM(slot.east, slot.north) - plot.radiusM,
            `${category}/${plot.id} off the nearest road`
          ).to.be.at.least(ROAD_HALF_M + SETBACK_M - 1e-9)
        }
      }
    })

    it('runs every road long enough to reach the lots on it', () => {
      // Branch lengths are hand-set and the rosters are not, so this keeps them
      // honest. A road shorter than the cluster it serves leaves its back lots
      // standing on open regolith with no pavement beside them.
      //
      // Only a lower bound, unlike the `reach` check this replaces, and that is
      // the point rather than a weakening: a branch's length is now chosen for
      // WHERE the district should stand — 130 m up a quiet branch for the crew,
      // 145 m out for terminals that want a clear horizon — and not for how much
      // hardware happens to be parked at the end of it. Overshoot is no longer a
      // defect; it is the layout.
      for (const [category, field] of races) {
        const plan = BASE_PLAN[category]!
        if (!plan.branch) continue
        expect(
          plan.branch.lengthM,
          `${category} branch reaches its own lots`
        ).to.be.at.least(districtNeed(category, field).behind)
      }
    })

    it('keeps every district keep-out tight around its own real ground', () => {
      // `block` is what holds base-wide filler off a district (see
      // withinDistrictGround), it is hand-set, and the rosters that decide what
      // it has to cover are not. So it is solved for here and checked from both
      // sides: too small and the boulder field spawns rock inside somebody's
      // reactor, too large and a district sterilises a stretch of open ground it
      // never uses — and with eight districts on eleven roads, blocks a couple
      // of times larger than they need to be would between them claim most of
      // the base and leave the filler nowhere to go.
      //
      // Solved rather than derived because `block` is BOTH the half-width of the
      // keep-out capsules and how far past each dead end they run (see
      // districtGround), so what it needs is not a closed form — enlarging it
      // lengthens the capsule as well as widening it.
      const contains = (
        plan: SitePlan,
        standing: { east: number; north: number; radiusM: number }[],
        block: number
      ) =>
        districtGround({ ...plan, block }).length > 0 &&
        standing.every((lot) =>
          districtGround({ ...plan, block }).some(
            (z) => segDistM(lot.east, lot.north, z.a, z.b) + lot.radiusM <= z.halfM
          )
        )

      for (const [category, field] of races) {
        const plan = BASE_PLAN[category]!
        const slots = districtSlots(plan, field)
        // Everything that stands on this district's ground: its competitors, and
        // the shared yards that are nobody's competitor. The depot's `block` is
        // set by the latter, so leaving them out would call it 14 m oversized.
        const standing = [
          ...field.map((plot) => ({
            ...slots.get(plot.id)!,
            radiusM: plot.radiusM,
          })),
          ...sharedLots(category),
        ]

        expect(
          contains(plan, standing, plan.block!),
          `${category} keep-out covers everything standing on it`
        ).to.equal(true)

        let least = plan.block!
        while (least > 1 && contains(plan, standing, least - 0.5)) least -= 0.5
        expect(
          plan.block! - least,
          `${category} keep-out is ${plan.block! - least} m larger than it needs`
        ).to.be.lessThan(8)
      }
    })

    it('holds base-wide filler off every plot on the base', () => {
      // The point of the keep-out, asserted from the outside in: the boulder
      // field and the street furniture only ever ask withinDistrictGround, so
      // whatever it says is clear had better actually be clear.
      for (const [category, field] of races) {
        const plan = BASE_PLAN[category]!
        const slots = districtSlots(plan, field)
        for (const plot of field) {
          const slot = slots.get(plot.id)!
          expect(
            withinDistrictGround(slot.east, slot.north, 0),
            `${category}/${plot.id} is district ground`
          ).to.equal(true)
        }
      }
    })

    it('shuttles the patrol along the spine and back', () => {
      for (const [category, run] of Object.entries(PATROL)) {
        expect(BASE_PLAN[category as ProjectType], category).to.exist
        const lap = shuttleLapM(run!)
        // The run stays on the road, short of both ends by a turning circle.
        expect(run!.fromAlongM, `${category} start`).to.be.greaterThan(
          SPINE_START_M
        )
        expect(run!.toAlongM, `${category} end`).to.be.lessThan(SPINE_END_M)

        // Sampled right round one lap: never off the pavement, and never off
        // the ends of the run. This is what the rigid rotation used to give for
        // free — a lap of a circle cannot leave the circle — and what a triangle
        // wave along a line has to be checked for instead.
        let sawOutbound = false
        let sawReturn = false
        let minAlong = Infinity
        let maxAlong = -Infinity
        for (let d = 0; d < lap; d += 3) {
          const p = shuttleAt(run!, d)
          const here = spineCoords(p)
          expect(
            Math.abs(here.acrossM),
            `${category} wanders off the lane at ${d} m`
          ).to.be.closeTo(run!.acrossM, 1e-9)
          expect(
            distToRoadM(p.east, p.north),
            `${category} leaves the road at ${d} m`
          ).to.be.lessThan(ROAD_HALF_M)
          minAlong = Math.min(minAlong, here.alongM)
          maxAlong = Math.max(maxAlong, here.alongM)
          if (p.outbound) sawOutbound = true
          else sawReturn = true
        }
        // Out and BACK: a fleet that only ever drove one way would have to
        // teleport home, and half of it would be doing so at any moment.
        expect(sawOutbound, `${category} drives out`).to.equal(true)
        expect(sawReturn, `${category} drives back`).to.equal(true)
        // And it covers the whole street rather than a stretch of it, which is
        // the only reason the traffic reads as belonging to the settlement
        // rather than to the depot.
        expect(minAlong, `${category} covers the southwest end`).to.be.lessThan(
          run!.fromAlongM + 4
        )
        expect(maxAlong, `${category} covers the northeast end`).to.be.greaterThan(
          run!.toAlongM - 4
        )
        // Closes exactly: one lap returns a vehicle to where it started, so the
        // fleet's spacing holds however long it runs.
        const start = shuttleAt(run!, 0)
        const round = shuttleAt(run!, lap)
        expect(round.east, `${category} lap closes`).to.be.closeTo(start.east, 1e-9)
        expect(round.north, `${category} lap closes`).to.be.closeTo(start.north, 1e-9)
      }
    })

    it('stands the landing zone well clear of anything pressurized', () => {
      // A Starship-class descent throws ejecta on ballistic arcs with no air to
      // stop it. This is already a compromise with keeping the vehicle in frame,
      // so the assertion is a floor, not a target.
      const pad = BASE_PLAN.lander!
      const homes = BASE_PLAN.habitat!
      const gap =
        Math.hypot(pad.east - homes.east, pad.north - homes.north) -
        districtExtentM(pad, ROSTERS.lander!) -
        districtExtentM(homes, ROSTERS.habitat!)
      expect(gap).to.be.greaterThan(30)
      // And the launcher fires from the OTHER end, so the two things on the plan
      // that throw mass are as far apart as the street is long.
      expect(
        Math.abs(
          districtAlongM(BASE_PLAN.mass_driver!) - districtAlongM(pad)
        ),
        'the pads and the launcher share an end'
      ).to.be.greaterThan(500)
    })
  })

  describe('the solar farm', () => {
    // The one large installation on the base that belongs to no race, and the
    // one whose whole geometry is an argument about where the SUN is rather
    // than about where the ridge is. Every check here is a claim that would
    // look perfectly fine in a screenshot if it broke, which is why it is here:
    // a field of panels shadowing itself, or facing the wrong quarter of the
    // sky, renders as a tidy solar farm either way.
    // The shadow figure every spacing check here is measured against. Taken
    // from the plan rather than re-derived, because the plan's version accounts
    // for the panels' own overhang either side of their centres and a version
    // recomputed here from the height alone would be wrong by about 4 m — in
    // the permissive direction, which is the worst way for a test to be wrong.
    const shadowM = SOLAR_SHADOW_PITCH_M

    it('stands every array on ground nothing else has a claim on', () => {
      // The farm is laid out by lattice and the fouled stations dropped, so
      // this is the check that the dropping actually happens. A field that
      // ignored it would stand an array on a competitor's lot or in the
      // pavement — and since the arrays are placed before any roster is known,
      // it has to hold with margin rather than exactly.
      expect(SOLAR_ARRAYS.length, 'the farm exists').to.be.greaterThan(12)
      for (const a of SOLAR_ARRAYS) {
        const where = `array ${a.field}/${a.row}:${a.bay}`
        expect(onRoad(a.east, a.north), `${where} in the road`).to.equal(false)
        expect(
          distToRoadM(a.east, a.north),
          `${where} clear of the pavement`
        ).to.be.greaterThan(ROAD_HALF_M + SOLAR_ARRAY_R_M)
        for (const category of Object.keys(BASE_PLAN) as ProjectType[]) {
          expect(
            onDistrictGround(category, a.east, a.north, SOLAR_ARRAY_R_M),
            `${where} on the ${category} district's ground`
          ).to.equal(false)
        }
      }
    })

    it('stands no part of an array in front of its own face', () => {
      // The one thing about this hardware that HAS to be true, and the one that
      // a render cannot be trusted to show. An earlier version of the array
      // hung the assembly off a ten-meter mast on a yoke; because the yoke
      // offset the panel to -X while the mast stayed at 0, the mast stood in
      // front of the face and ran on two and a half meters past the top of it.
      // Every panel in the field had a pole through the middle of it, and the
      // scene still rendered as a perfectly tidy solar farm — the pole reads as
      // a plausible piece of structure until someone looks closely.
      //
      // So: every structural node, measured as a signed distance from the
      // face's own plane along the face's own normal, must come out NEGATIVE.
      // Measured in the plane's frame rather than in X, because the face is
      // raked — a member can sit at negative X and still poke through.
      const f = solarArrayFrame((SUN_LOCAL_ELEV_DEG * Math.PI) / 180)
      const behind = (p: readonly number[]) =>
        (p[0] - f.centre[0]) * f.normal[0] +
        (p[1] - f.centre[1]) * f.normal[1] +
        (p[2] - f.centre[2]) * f.normal[2]

      const nodes: [string, readonly number[]][] = [['torque tube', f.tube]]
      for (const leg of f.legs) {
        nodes.push([`leg ${leg.z.toFixed(1)} back foot`, leg.back])
        nodes.push([`leg ${leg.z.toFixed(1)} fore foot`, leg.fore])
      }
      for (const [what, p] of nodes) {
        expect(behind(p), `${what} stands in front of the face`).to.be.lessThan(0)
      }

      // And the array stands ON the ground rather than floating over it or
      // sunk into it: the feet are at zero and the face clears the surface.
      for (const leg of f.legs) {
        expect(leg.back[1], 'a back foot is off the ground').to.equal(0)
        expect(leg.fore[1], 'a fore foot is off the ground').to.equal(0)
      }
      const lowestFace = f.centre[1] - f.halfH * Math.cos(
        (SUN_LOCAL_ELEV_DEG * Math.PI) / 180
      )
      expect(lowestFace, 'the face digs into the ground').to.be.greaterThan(0)
    })

    it('pitches the rows further apart than an array own shadow', () => {
      // THE load-bearing number, and the reason the farm is as large as it is.
      // A low sun throws a long shadow, so a row planted closer than one
      // shadow length behind another spends part of its day in that row's
      // shade — which is invisible on screen and is the whole point of a solar
      // farm. Asserted against the sun's own elevation rather than a copied
      // figure, so a change to the light re-derives the spacing it needs.
      expect(
        SOLAR_ROW_PITCH_M,
        `rows must clear a ${shadowM.toFixed(1)} m shadow`
      ).to.be.greaterThan(shadowM)

      // And measured on the arrays themselves, not just on the constant: two
      // arrays in different rows must never line up along the sun's bearing
      // closer than that. This is what catches a lattice laid out in the wrong
      // frame — rows pitched correctly but stacked along the SPINE would put
      // some pairs well inside a shadow of each other.
      // Across the whole farm and not merely within a field, because the two
      // fields are separately sited and nothing stops a future pair of them
      // lining up on the sun's axis. That is the failure this half of the check
      // is really for: a field that self-shadows is a spacing mistake, but one
      // field shadowing ANOTHER is a siting mistake, and it is the easier of
      // the two to make.
      const [se, sn] = dirFor(SUN_LOCAL_BEARING_DEG)
      for (const p of SOLAR_ARRAYS) {
        for (const q of SOLAR_ARRAYS) {
          if (p.field === q.field && p.row === q.row) continue
          // Offset between them, split into along-sun and across-sun.
          const de = q.east - p.east
          const dn = q.north - p.north
          const alongSun = de * se + dn * sn
          const acrossSun = -de * sn + dn * se
          // Only a pair that overlaps ACROSS the sun can shadow each other at
          // all; two arrays offset sideways by more than a blanket's width are
          // clear of one another whatever their spacing up-sun.
          if (Math.abs(acrossSun) >= SOLAR_PANEL_HALF_W_M * 2) continue
          expect(
            Math.abs(alongSun),
            `array ${p.field}/${p.row}:${p.bay} shadows ${q.field}/${q.row}:${q.bay}`
          ).to.be.greaterThan(shadowM)
        }
      }
    })

    it('surveys every field to something, and never to nothing', () => {
      // A field's ROW LINES are the strongest thing about it on screen, so the
      // angle they run at is a real design decision and this is the check that
      // each one was actually made. Both fields here are surveyed, and to
      // different things on purpose:
      //
      //   field 0 to the SUN — its rows run square across the sun's bearing, so
      //     a row's shadow falls on open ground and never on the next row. That
      //     is what makes the shadow check above true by construction rather
      //     than by luck, and it is the default every field gets.
      //   field 1 to the HABITAT ROAD — its rows run parallel to it. It gives
      //     up the by-construction guarantee (which is why the shadow check is
      //     pairwise and not merely a claim about the pitch) in exchange for
      //     lining up with the one strong line it shares a frame with.
      //
      // What is asserted is the DISCIPLINE rather than either choice: every
      // field's rows are parallel to a bearing that is written down somewhere
      // else on the plan. A field at its own arbitrary angle reads as debris,
      // and is the thing this test exists to fail on.
      const rows = new Map<string, typeof SOLAR_ARRAYS>()
      for (const a of SOLAR_ARRAYS) {
        const key = `${a.field}/${a.row}`
        if (!rows.has(key)) rows.set(key, [])
        rows.get(key)!.push(a)
      }
      expect(rows.size, 'more than one row').to.be.greaterThan(1)

      // Every bearing on the plan a field could legitimately be surveyed to:
      // across the sun, or along any district's own branch.
      const surveyable = new Map<string, number>([
        ['across the sun', SUN_LOCAL_BEARING_DEG + 90],
      ])
      for (const category of Object.keys(BASE_PLAN) as ProjectType[]) {
        const b = BASE_PLAN[category]!.branch
        if (b) surveyable.set(`the ${category} road`, b.bearingDeg)
      }

      // A row line has no direction, only an axis, so 95 and 275 are the same
      // survey and the comparison has to be modulo half a turn.
      const axis = (deg: number) => ((deg % 180) + 180) % 180

      const surveyOf = new Map<number, string>()
      for (const [row, bays] of rows) {
        if (bays.length < 2) continue
        const first = bays[0]
        const last = bays[bays.length - 1]
        const bearing =
          (Math.atan2(last.north - first.north, last.east - first.east) * 180) /
          Math.PI
        const hit = [...surveyable.entries()].find(
          ([, deg]) => Math.abs(axis(bearing) - axis(deg)) < 0.5
        )
        expect(
          hit,
          `row ${row} runs at ${bearing.toFixed(1)} deg, which is not on the plan`
        ).to.not.equal(undefined)
        // And every row of one field is surveyed the same way, or it is not a
        // field. Recorded on the first row seen and compared on the rest.
        const was = surveyOf.get(first.field)
        if (was === undefined) surveyOf.set(first.field, hit![0])
        else expect(hit![0], `field ${first.field} is not one survey`).to.equal(was)
      }

      // Field 0 to the sun and field 1 to the habitat road, specifically. The
      // discipline check above passes if the two are swapped or if both go the
      // same way, and both of those would be wrong for reasons argued in
      // SOLAR_FIELDS — so name them.
      expect(surveyOf.get(0), 'field 0 is surveyed to the sun').to.equal(
        'across the sun'
      )
      expect(
        surveyOf.get(1),
        'field 1 is surveyed to the habitat road'
      ).to.equal('the habitat road')

      // If the sun's bearing and the spine's ever coincided, "surveyed to the
      // sun" and "surveyed to the ridge" would stop being distinguishable and
      // the whole test would pass without meaning anything. Say so here rather
      // than let it rot silently.
      expect(
        Math.abs(SUN_LOCAL_BEARING_DEG - SPINE_BEARING_DEG),
        'the sun and the spine are not the same axis'
      ).to.be.greaterThan(5)
    })

    it('leaves no two blankets touching', () => {
      // Within a row the arrays are coplanar and shadow each other not at all,
      // so the only thing that limits how close they stand is their own width.
      for (let i = 0; i < SOLAR_ARRAYS.length; i++) {
        for (let j = i + 1; j < SOLAR_ARRAYS.length; j++) {
          const p = SOLAR_ARRAYS[i]
          const q = SOLAR_ARRAYS[j]
          expect(
            Math.hypot(p.east - q.east, p.north - q.north),
            `arrays ${p.field}/${p.row}:${p.bay} and ${q.field}/${q.row}:${q.bay} touch`
          ).to.be.greaterThan(SOLAR_PANEL_HALF_W_M * 2)
        }
      }
    })

    it('keeps the farm further off the pads than any race hardware', () => {
      // The reason the large empty ground beside the landing zone STAYS empty,
      // and so the reason neither field is in it. Ejecta off an airless body
      // leaves at orbital speed and does not come back down, so a field of
      // glass is close to the worst thing to put near a pad — and unlike a
      // habitat, a panel cannot be bermed against it.
      //
      // Asserted RELATIVE to what the plan already accepts rather than against
      // an absolute standoff, because an absolute one here would be invented.
      // The plan's own floor is the 30 m the pressurized structures get, and
      // the closest race ground actually stands 59 m off; a fixed figure for
      // the farm would either duplicate that argument or contradict it. What
      // is defensible is the ordering: whatever standoff the races are held to,
      // the panels are held to more, because they are the most ejecta-sensitive
      // hardware on the base and the least protectable.
      const pad = BASE_PLAN.lander!
      const toPad = (p: { east: number; north: number }) =>
        Math.hypot(p.east - pad.east, p.north - pad.north)

      let nearestRace = Infinity
      for (const category of Object.keys(BASE_PLAN) as ProjectType[]) {
        if (category === 'lander') continue
        for (const z of districtGround(BASE_PLAN[category]!)) {
          nearestRace = Math.min(
            nearestRace,
            segDistM(pad.east, pad.north, z.a, z.b) - z.halfM
          )
        }
      }

      let nearestArray = Infinity
      let which = ''
      for (const a of SOLAR_ARRAYS) {
        if (toPad(a) < nearestArray) {
          nearestArray = toPad(a)
          which = `${a.field}/${a.row}:${a.bay}`
        }
      }
      expect(
        nearestArray,
        `array ${which} is nearer the pads than the closest race is`
      ).to.be.greaterThan(nearestRace * 2)
    })

    it('serves every field off a road rather than stranding it', () => {
      // An address on this base is somewhere you can drive to — that is the
      // whole argument for the tiered street plan — so a field of arrays with
      // no access would be the one installation the plan cannot explain. Both
      // fields front the spine in a wedge off it, so neither needs a road of
      // its own, but both need to actually BE near one.
      //
      // Checked per field, not across the farm. The farm's nearest array to a
      // road is the obvious thing to measure and it is the wrong one: with two
      // fields it is satisfied entirely by whichever field is closer, and a
      // second field stranded 200 m out on the flank would pass it.
      //
      // The upper bound is loose and the lower one is the point: panels are set
      // WELL back from a haul road deliberately, because traffic throws
      // regolith and dust on a blanket is the standing problem with lunar PV.
      // Close enough to serve, far enough not to be sandblasted by every
      // passing hauler.
      const fields = new Set(SOLAR_ARRAYS.map((a) => a.field))
      expect(fields.size, 'the farm is distributed').to.be.greaterThan(1)
      for (const f of fields) {
        let nearest = Infinity
        for (const a of SOLAR_ARRAYS.filter((x) => x.field === f)) {
          nearest = Math.min(nearest, distToRoadM(a.east, a.north))
        }
        expect(nearest, `field ${f} is reachable`).to.be.lessThan(60)
        expect(
          nearest,
          `field ${f} is set back out of the road dust`
        ).to.be.greaterThan(ROAD_HALF_M + SOLAR_ARRAY_R_M)
      }
    })

    it('holds the base-wide filler off the farm', () => {
      // The farm keeps ground the same way a district does, and for the same
      // reason: the boulder field, the roadside cargo and the maintenance fleet
      // are all placed by walking candidates and rejecting whatever falls on
      // built ground. Before the farm was added to that check, every one of
      // them was free to spawn a rock or a crate between the panel rows.
      expect(SOLAR_FARM_ZONES.length, 'the farm reserves ground').to.be.above(0)
      for (const a of SOLAR_ARRAYS) {
        expect(
          withinDistrictGround(a.east, a.north, 0),
          `filler may stand on array ${a.field}/${a.row}:${a.bay}`
        ).to.equal(true)
      }
      // And it reserves the rows rather than the whole rectangle: the clear
      // ground between two rows is a shadow gap, not a yard, so a boulder there
      // is fine and a farm that claimed it would sterilize the flank.
      const [se, sn] = dirFor(SUN_LOCAL_BEARING_DEG)
      const mid = SOLAR_ARRAYS[0]
      const between = {
        east: mid.east + se * (SOLAR_ROW_PITCH_M / 2),
        north: mid.north + sn * (SOLAR_ROW_PITCH_M / 2),
      }
      expect(
        SOLAR_FARM_ZONES.some(
          (z) => segDistM(between.east, between.north, z.a, z.b) <= z.halfM
        ),
        'the farm claims the gaps between its own rows'
      ).to.equal(false)
    })
  })

  describe('the buried habitats', () => {
    it('reserves the cover mound rather than the module', () => {
      // The roster above mirrors these by hand, and the habitat district's whole
      // packing is solved against those figures — so if a vault's dimensions
      // move and this roster doesn't, every packing assertion in this file
      // starts testing a colony that no longer exists.
      const want: Record<string, number> = {
        'sierra-space-life': 13.937,
        'thales-mph': 14.056,
      }
      for (const [id, site] of Object.entries(BURIED_HABITATS)) {
        expect(want[id], `${id} is missing from this test's roster`).to.exist
        expect(vaultGeometry(site).footprintM, id).to.be.closeTo(want[id], 5e-4)
      }
    })

    it('carries enough regolith over the crown to be worth burying for', () => {
      // The point of the exercise. Three to five meters is the range the
      // shielding literature keeps landing on, and it is the number the
      // dataset's shielding milestones quote — a vault that quietly lost its
      // cover to a geometry tweak would still look fine and mean nothing.
      for (const [id, site] of Object.entries(BURIED_HABITATS)) {
        expect(site.coverM, id).to.be.at.least(3)
      }
    })

    it('stands the cutaway camera inside the vault it is looking into', () => {
      // The eye is placed from these same numbers (see subViewFraming and the
      // `sub` branch of MoonGlobe's CameraRig), and there is no fallback if it
      // lands wrong: outside the end wall it looks at the back of the liner,
      // and below the floor it looks at nothing at all.
      for (const [id, site] of Object.entries(BURIED_HABITATS)) {
        const g = vaultGeometry(site)
        expect(g.standoffM, `${id} eye is past the end wall`).to.be.lessThan(
          g.lengthM / 2
        )
        // Between the floor and the crown, and looking UP at the module rather
        // than down through the floor at it.
        expect(g.eyeDepthM, `${id} eye is under the floor`).to.be.lessThan(
          g.floorDepthM
        )
        expect(g.eyeDepthM, `${id} eye is above the crown`).to.be.greaterThan(
          g.floorDepthM - g.crownM
        )
        expect(
          g.subjectDepthM,
          `${id} looks down at its own module`
        ).to.be.lessThan(g.eyeDepthM)
      }
    })
  })

  describe('the street network', () => {
    const spine = BASE_STREETS.find((st) => st.rank === RANK_SPINE)!
    const branches = BASE_STREETS.filter((st) => st.rank === RANK_BRANCH)
    const spurs = BASE_STREETS.filter((st) => st.rank === RANK_SPUR)

    it('lays one spine, straight, on the bearing the ground chose', () => {
      // Every road on this plan is described by its two endpoints and nothing
      // in between, which is the whole reason a distance to a road is now exact
      // (see distToRoadM). A waypoint off the line would silently reintroduce
      // the spline bulge the concentric plan had.
      expect(
        BASE_STREETS.filter((st) => st.rank === RANK_SPINE),
        'exactly one spine'
      ).to.have.length(1)
      expect(spine.serves, 'the spine serves no one district').to.be.undefined
      expect(spine.points, 'the spine is two waypoints').to.have.length(2)
      for (const pt of spine.points) {
        expect(
          spineCoords({ east: pt[0], north: pt[1] }).acrossM,
          'the spine is straight'
        ).to.be.closeTo(0, 1e-9)
      }
      // Runs the full declared extent, and nothing is closed: there is no ring
      // road on this plan, and the windrow logic in BaseRoads keys off `closed`.
      const ends = spine.points
        .map((pt) => spineCoords({ east: pt[0], north: pt[1] }).alongM)
        .sort((a, b) => a - b)
      expect(ends[0]).to.be.closeTo(SPINE_START_M, 1e-9)
      expect(ends[1]).to.be.closeTo(SPINE_END_M, 1e-9)
      for (const street of BASE_STREETS) {
        expect(street.closed, 'no road on this plan is a loop').to.not.equal(true)
      }
    })

    it('runs one straight branch from the spine out to each district', () => {
      // A T, not a crossing. Every branch STARTS on the spine and runs away from
      // it to the district at its far end, where it used to straddle the spine
      // and carry on out the other side. junctions.ts depends on this shape (see
      // its note on why crossings are found by distance minimum), and so does
      // every setback assertion above.
      for (const [category] of races) {
        const plan = BASE_PLAN[category]!
        // The landing zone flanks the spine instead (see its own test above).
        if (!plan.branch) continue
        const street = branches.find((st) => st.serves?.includes(category))
        expect(street, `${category} branch`).to.exist
        const pts = street!.points
        expect(pts, `${category} branch is two waypoints`).to.have.length(2)

        // It begins ON the spine, at its own crossing.
        const start = spineCoords({ east: pts[0][0], north: pts[0][1] })
        expect(start.acrossM, `${category} branch starts on the spine`).to.be.closeTo(
          0,
          1e-9
        )
        expect(start.alongM, `${category} branch starts at its crossing`).to.be.closeTo(
          districtAlongM(plan),
          1e-9
        )

        // It runs on its declared bearing, and ends a turning circle past the
        // district — the whole road on one side of the spine.
        const [de, dn] = dirFor(plan.branch.bearingDeg)
        const want = plan.branch.lengthM + BRANCH_TAIL_M
        expect(pts[1][0], `${category} branch end east`).to.be.closeTo(
          pts[0][0] + de * want,
          1e-9
        )
        expect(pts[1][1], `${category} branch end north`).to.be.closeTo(
          pts[0][1] + dn * want,
          1e-9
        )

        // Nothing on the far side of the spine: a branch that overshot back
        // across the through road would be a crossing again, and would put
        // pavement on ground no lot of this district uses.
        const end = spineCoords({ east: pts[1][0], north: pts[1][1] })
        expect(
          Math.sign(end.acrossM),
          `${category} branch stays on one side of the spine`
        ).to.equal(Math.sign(spineCoords(plan).acrossM))
      }
    })

    it('hangs every spur off the branch it belongs to', () => {
      // A spur is the third tier, and the thing that makes it a tier rather than
      // a second branch is that it leaves its PARENT rather than the spine. If
      // one ever started on the spine it would be a branch with a district's name
      // on it and no district at the end.
      for (const street of spurs) {
        const category = street.serves![0]
        const plan = BASE_PLAN[category]!
        const spur = plan.branch!.spur!
        expect(spur, `${category} spur`).to.exist

        const from = { east: street.points[0][0], north: street.points[0][1] }
        // On its parent branch, `atM` out from the crossing — and that is
        // strictly inside the branch, not at either end of it.
        const crossing = at(plan.alongM)
        const [de, dn] = dirFor(plan.branch!.bearingDeg)
        expect(from.east, `${category} spur leaves its branch`).to.be.closeTo(
          crossing.east + de * spur.atM,
          1e-9
        )
        expect(from.north, `${category} spur leaves its branch`).to.be.closeTo(
          crossing.north + dn * spur.atM,
          1e-9
        )
        expect(spur.atM, `${category} spur leaves the spine itself`).to.be.greaterThan(
          ROAD_HALF_M
        )
        expect(
          spur.atM,
          `${category} spur leaves past the end of its branch`
        ).to.be.lessThan(plan.branch!.lengthM)

        // And it is the narrowest road serving that district, so the hierarchy
        // reads at a glance rather than only in the junction logic.
        const parent = branches.find((st) => st.serves?.includes(category))!
        expect(
          street.width ?? 1,
          `${category} spur is narrower than its branch`
        ).to.be.lessThan(parent.width ?? 1)
      }
    })

    it('gives no road a bearing the base has no reason to travel', () => {
      // Every road is either the settlement's own frame (the spine), a branch out
      // to a district, or a spur off one of those. The rule exists because the
      // failure mode here is decorative roads, which read as tyre marks.
      const branched = races.filter(([c]) => !!BASE_PLAN[c]!.branch)
      expect(branches.length, 'a branch per district that has one').to.equal(
        branched.length
      )
      expect(spurs.length, 'a spur per district that asks for one').to.equal(
        branched.filter(([c]) => !!BASE_PLAN[c]!.branch!.spur).length
      )
      expect(BASE_STREETS.length, 'and nothing else').to.equal(
        1 + branches.length + spurs.length
      )
      for (const street of [...branches, ...spurs]) {
        expect(street.serves, 'every road serves a district').to.not.be.empty
      }
      // Only the larger rosters get a spur. A spur to a single competitor is a
      // road built for one shed.
      for (const street of spurs) {
        expect(
          ROSTERS[street.serves![0]]!.length,
          `${street.serves![0]} is big enough to want a spur`
        ).to.be.at.least(4)
      }
    })

    it('walks every road as a straight run of its own length', () => {
      // ROAD_RUNS is what the base-wide filler places against (see
      // InterDistrictFiller), and it is derived from BASE_STREETS rather than
      // written out, so this is the check that the derivation holds: a run's
      // own `at()` has to agree with the street it came from at both ends.
      expect(ROAD_RUNS).to.have.length(BASE_STREETS.length)
      ROAD_RUNS.forEach((run, i) => {
        const pts = BASE_STREETS[i].points
        const start = run.at(0, 0)
        const end = run.at(run.lengthM, 0)
        expect(start.east, `run ${i} start`).to.be.closeTo(pts[0][0], 1e-6)
        expect(start.north, `run ${i} start`).to.be.closeTo(pts[0][1], 1e-6)
        expect(end.east, `run ${i} end`).to.be.closeTo(pts.at(-1)![0], 1e-6)
        expect(end.north, `run ${i} end`).to.be.closeTo(pts.at(-1)![1], 1e-6)
        // An offset is perpendicular to the run and exactly as far as asked, so
        // a light placed at ROAD_HALF_M + 1.4 really is that far off the
        // pavement. Checked against the run's OWN centreline rather than the
        // network: a spur's midpoint can legitimately be within a road's width
        // of its parent branch, so a point offset from there is not necessarily
        // clear of every road on the base.
        const mid = run.at(run.lengthM / 2, 0)
        const off = run.at(run.lengthM / 2, 9)
        expect(
          Math.hypot(off.east - mid.east, off.north - mid.north),
          `run ${i} offset distance`
        ).to.be.closeTo(9, 1e-9)
        const dot =
          (off.east - mid.east) * (end.east - start.east) +
          (off.north - mid.north) * (end.north - start.north)
        expect(dot, `run ${i} offset is perpendicular`).to.be.closeTo(0, 1e-6)
      })
    })

    it('runs the spine on the same line the guideway was levelled on', () => {
      // Two independent answers to the same question about the same ridge.
      // Profiled off the rendered height field over the spine's true extent,
      // every whole bearing, 5 m stations: 40 deg is 12.7 m of relief end to
      // end (24th of 180) and never pitches past 8.0% (14th of 180) — the only
      // bearing in the top 15% on both. See the table in baseplan.ts.
      //
      // Pinned to the guideway's heading rather than to the literal 40, because
      // the interesting claim is that they AGREE: the guideway needs level
      // because fall is leg height, the spine needs it because a 730 m road
      // cannot dodge, and they land on one line. Split them and the launcher
      // stops reading as the street continuing out of town.
      expect(SPINE_BEARING_DEG).to.equal(TRACK_HEADING_DEG)
    })
  })

  describe('the mass driver guideway', () => {
    // The launcher is the one asset the plot-packing math above cannot describe.
    // Every other check in this file models an installation as a DISC, which is
    // fair for a reactor and useless for a structure 600 m long and 6 m wide:
    // the disc containing it is 300 m across. So its lot holds the breach works
    // only, and the track is checked here as what it is — a corridor running out
    // of that lot across open ground. See lib/lunar-atlas/trackplan.

    const plan = BASE_PLAN.mass_driver!
    const slot = districtSlots(plan, ROSTERS.mass_driver!).get('p0')!

    // Every point the guideway sweeps: both edges of the corridor and its
    // centreline, at 1 m stations. Sampling the centreline alone would miss a
    // corridor that straddles a road, which is the failure that matters.
    const corridor = () => {
      const rad = (TRACK_HEADING_DEG * Math.PI) / 180
      const ce = Math.cos(rad)
      const cn = Math.sin(rad)
      const pts: { d: number; east: number; north: number }[] = []
      for (let d = 0; d <= TRACK_LENGTH_M; d += 1) {
        for (const off of [-TRACK_CORRIDOR_HALF_M, 0, TRACK_CORRIDOR_HALF_M]) {
          pts.push({
            d,
            east: slot.east + ce * d - cn * off,
            north: slot.north + cn * d + ce * off,
          })
        }
      }
      return pts
    }

    it('runs the whole way without touching a road', () => {
      for (const p of corridor()) {
        expect(
          onRoad(p.east, p.north),
          `guideway on a road at ${p.d} m`
        ).to.equal(false)
      }
    })

    it('runs the whole way without crossing another district', () => {
      // Checked per district and with the launcher's OWN excluded, rather than
      // against the base as a whole after a few exempt stations. The breach
      // works stand on their own lot on purpose and the guideway leaves it up
      // the same street, so any "first N meters are exempt" figure is really a
      // restatement of the mass driver's own block — and would go stale the
      // moment that block changed.
      for (const p of corridor()) {
        for (const [category] of races) {
          if (category === 'mass_driver') continue
          expect(
            onDistrictGround(category, p.east, p.north, 10),
            `guideway over ${category} at ${p.d} m ` +
              `(east=${p.east.toFixed(1)}, north=${p.north.toFixed(1)})`
          ).to.equal(false)
        }
      }
    })

    it('runs the whole way without crossing the solar farm', () => {
      // The farm is the newest ground on the plan and the guideway is the
      // longest thing on it, so this is the pairing most likely to foul without
      // anyone noticing: the launcher's run is a kilometre of structure up in
      // the air, and a 10 m array standing under it would read, from most
      // angles, as simply part of the base.
      //
      // Checked against the arrays themselves rather than against the farm's
      // keep-out capsules, because the capsules are what holds SCENERY off the
      // farm and are deliberately generous. What matters here is the hardware.
      for (const p of corridor()) {
        for (const a of SOLAR_ARRAYS) {
          expect(
            Math.hypot(p.east - a.east, p.north - a.north),
            `guideway over array ${a.field}/${a.row}:${a.bay} at ${p.d} m`
          ).to.be.greaterThan(SOLAR_ARRAY_R_M)
        }
      }
    })

    it('fires the guideway away from the base rather than over it', () => {
      // The launcher sits at the head of the spine and throws outward, which is
      // the point of putting it there. Asserted as "the far end is further up
      // the street than every district" rather than as a bearing, because it is
      // the ORDER on the street that makes it safe.
      const rad = (TRACK_HEADING_DEG * Math.PI) / 180
      const muzzle = {
        east: slot.east + Math.cos(rad) * TRACK_LENGTH_M,
        north: slot.north + Math.sin(rad) * TRACK_LENGTH_M,
      }
      const far = spineCoords(muzzle).alongM
      for (const [category] of races) {
        if (category === 'mass_driver') continue
        expect(
          far,
          `the guideway ends past ${category}`
        ).to.be.greaterThan(districtAlongM(BASE_PLAN[category]!))
      }
      expect(far, 'the guideway ends past the spine itself').to.be.greaterThan(
        SPINE_END_M
      )
    })

    it('stands its deck clear of the ground at every bent', () => {
      // The geometric contract the model relies on: whatever the ground does
      // under the run, the deck is level and no bent is shorter than the
      // clearance. Exercised with a fall profile at least as bad as the real
      // one — the flattest heading measures about 10.6 m over the run.
      const stations = trackBentStations()
      const fall = stations.map((d) => -(d / TRACK_LENGTH_M) * 14)
      const deck = trackDeckY(fall)
      const legs = trackLegHeights(fall)

      expect(legs.length, 'a leg height per bent').to.equal(stations.length)
      for (const [i, h] of legs.entries()) {
        expect(h, `bent ${i} clearance`).to.be.at.least(TRACK_DECK_CLEAR_M)
        // Level means level: every bent's foot plus its own height lands on the
        // one deck. This is what makes a trestle a trestle.
        expect(fall[i] + h, `bent ${i} reaches the deck`).to.be.closeTo(
          deck,
          1e-9
        )
      }
      // The tallest bent is the clearance plus the whole fall, and no more.
      expect(Math.max(...legs)).to.be.closeTo(TRACK_DECK_CLEAR_M + 14, 1e-9)
    })

    it('stands every bent on its feet rather than on its point', () => {
      // An A-frame, not a V. This is not a nicety about which way a shape looks:
      // the splay is the base width that resists the cross-track overturning
      // moment, and inverted it puts the whole trestle up on its points. It
      // shipped inverted once, from a lean angle whose sign was written by hand,
      // which is why bentLegs returns endpoints instead.
      for (const h of [TRACK_DECK_CLEAR_M, 9, 16, 40]) {
        const [left, right] = bentLegs(0, 0, h)
        const footSpan = Math.abs(right.foot[2] - left.foot[2])
        const headSpan = Math.abs(right.head[2] - left.head[2])
        expect(footSpan, `bent ${h} m: feet wider than head`).to.be.greaterThan(
          headSpan
        )
        // Symmetric about the centreline, and the right leg is the +z one.
        expect(left.foot[2]).to.be.closeTo(-right.foot[2], 1e-9)
        expect(right.foot[2]).to.be.greaterThan(0)
        // Splay grows with height — a taller bent needs a wider base, and a
        // fixed foot offset would make the tall far-end bents the slenderest.
        expect(footSpan - headSpan).to.be.closeTo(2 * TRACK_SPLAY * h, 1e-9)
        // Feet on the ground, heads at the cap.
        expect(left.foot[1]).to.equal(0)
        expect(right.head[1]).to.equal(h)
      }
    })

    it('keeps the breach works on a lot that fits the district', () => {
      // The lot is sized to the breach works, not to the track. If that ever
      // drifts back toward the model's own length, the crossing gets shoved out
      // and this district stops matching the street.
      expect(ROSTERS.mass_driver![0].radiusM).to.equal(BREACH_LOT_RADIUS_M)
      // A single competitor, so it takes the head of its own branch: on the
      // centreline, a turning circle and a setback past where the pavement ends.
      const here = onItsRoad(plan, slot)
      expect(here.acrossM, 'breach lot is on its branch centreline').to.be.closeTo(
        0,
        1e-9
      )
      expect(here.alongM, 'breach lot setback past the pavement').to.be.closeTo(
        BRANCH_TAIL_M + ROAD_HALF_M + SETBACK_M + BREACH_LOT_RADIUS_M,
        1e-9
      )
    })
  })
})
