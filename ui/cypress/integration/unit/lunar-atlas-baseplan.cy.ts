/**
 * Moon Base Zero street plan (headless, mocha + chai).
 *
 * The plan is geometry that nothing on screen will tell you has broken. Add a
 * fourth competitor to a race and two corner lots quietly overlap, and what you
 * see is one reactor standing inside another; shorten a branch and the outer
 * lots stand on open regolith. So the invariants are asserted here: no two plots
 * touch, every plot fronts a street at the same setback, every branch runs the
 * full length of the district it serves, the spine runs past both ends of the
 * settlement, and the districts clear each other along the street.
 *
 * The plan is LINEAR — one spine, one perpendicular branch per district — so
 * almost everything below is stated in the spine's own frame (`along` up the
 * road, `across` to its left) rather than in the polar radius-and-bearing this
 * file used to be written in. That is not a translation of the same assertions:
 * a corner lot's setback off a straight road is a distance, where off a circle
 * it was an arc, and several of the checks here that needed a tolerance are now
 * exact.
 */

import { expect } from 'chai'
import {
  BASE_PLAN,
  BASE_STREETS,
  BRANCH_TAIL_M,
  DISTRICT_GAP_M,
  PATROL,
  ROAD_HALF_M,
  ROAD_RUNS,
  SETBACK_M,
  SPINE_BEARING_DEG,
  SPINE_END_M,
  SPINE_START_M,
  at,
  distToRoadM,
  districtAlongM,
  districtExtentM,
  districtSlots,
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

// A crossroads district on the spine, which is the default everything else is
// measured against. Placed away from the origin on purpose: at `along` 0 the
// spine's own frame and the map frame share a centre, so a check that
// accidentally worked in the wrong one would still pass.
const JUNCTION_ALONG_M = 120
const junction = (over: Partial<SitePlan> = {}): SitePlan => ({
  ...at(JUNCTION_ALONG_M),
  turn: 0,
  ...over,
})

// A plot's position in the spine's own frame, relative to its district.
const local = (plan: SitePlan, slot: { east: number; north: number }) => {
  const here = spineCoords(slot)
  return {
    alongM: here.alongM - districtAlongM(plan),
    acrossM: here.acrossM,
  }
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
// PATROL), so what stands on its corners is the depot yard and the recharge
// station, and its `reach` is sized for those rather than for an LTV. See
// `DEPOT_FOOTPRINT_R` and `GAS_STATION_FOOTPRINT_R` in MarkerLayer.tsx.
const SHARED_GROUND: Partial<Record<ProjectType, number[]>> = {
  rover: [9, 7.25],
}

// How far a district's ground actually reaches from its crossing, across the
// spine and along it, once its real roster AND anything shared standing on its
// corners are packed. This is what `reach` and `block` are checked against —
// both are hand-set and neither the rosters nor the yard footprints are.
function districtNeed(category: ProjectType, field: Plot[]) {
  const plan = BASE_PLAN[category]!
  const slots = districtSlots(plan, field)
  let across = 0
  let along = 0
  for (const plot of field) {
    const here = local(plan, slots.get(plot.id)!)
    across = Math.max(across, Math.abs(here.acrossM) + plot.radiusM)
    along = Math.max(along, Math.abs(here.alongM) + plot.radiusM)
  }
  // Shared infrastructure takes a corner at its own frontage off both roads, so
  // it reaches the same distance either way.
  for (const r of SHARED_GROUND[category] ?? []) {
    const corner = ROAD_HALF_M + SETBACK_M + r + r
    across = Math.max(across, corner)
    along = Math.max(along, corner)
  }
  return { across, along }
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
  const plan = BASE_PLAN[category]!
  const { alongM, acrossM } = spineCoords({ east, north })
  const half = (plan.block ?? plan.reach!) + BRANCH_TAIL_M + marginM
  return (
    Math.abs(alongM - districtAlongM(plan)) <= half && Math.abs(acrossM) <= half
  )
}

describe('moon base zero street plan', () => {
  describe('districtSlots', () => {
    it('puts a lone competitor on a corner lot, not in the junction', () => {
      const slots = districtSlots(junction(), plots(5))
      const only = slots.get('p0')!
      // Standing on the crossing itself would be standing in the road.
      expect(only.offsetM).to.be.greaterThan(ROAD_HALF_M)
    })

    it('keeps every plot clear of every other, for any size of field', () => {
      // Mixed radii matter most; equal circles are the easy case. Five and six
      // exercise the second row of corners, which is the path a race that gains
      // competitors will take.
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
          tightestGap(junction(), field),
          `field of ${field.length}`
        ).to.be.greaterThan(DISTRICT_GAP_M)
      }
    })

    it('stands every plot the same setback off the street it fronts', () => {
      // The one number that makes the whole base read as surveyed. A crossroads
      // plot is `setback + road half-width + its own radius` off the SPINE and
      // the same off its own BRANCH, so every asset on the base ends up with an
      // identical strip of clear regolith at its edge.
      //
      // Both hold EXACTLY, for every lot, which is the simplification the
      // linear plan buys. On the concentric plan the spine was a circle and the
      // setback off it was measured radially, so the branch setback could only
      // be an arc-versus-tangent approximation and the fifth lot onward could
      // only be asserted as a lower bound. Two straight roads have no such
      // problem: `along` is the distance from the branch and `across` is the
      // distance from the spine, full stop.
      for (const [category, field] of races) {
        const plan = BASE_PLAN[category]!
        if (plan.front) continue
        const slots = districtSlots(plan, field)
        // districtSlots fills the corners largest first, so the lot's place in
        // that order is what decides whether it is a corner or a spill.
        const order = [...field].sort(
          (a, b) => b.radiusM - a.radiusM || a.id.localeCompare(b.id)
        )
        order.forEach((plot, i) => {
          const want = ROAD_HALF_M + SETBACK_M + plot.radiusM
          const { alongM, acrossM } = local(plan, slots.get(plot.id)!)
          expect(
            Math.abs(acrossM),
            `${category}/${plot.id} off the spine`
          ).to.be.closeTo(want, 1e-9)
          // A spill lot has no branch beside it — it continues up the spine
          // past a corner — so it stands FURTHER off the branch, never nearer.
          const label = `${category}/${plot.id} off its branch`
          if (i < 4) expect(Math.abs(alongM), label).to.be.closeTo(want, 1e-9)
          else expect(Math.abs(alongM), label).to.be.at.least(want - 1e-9)
        })
      }
    })

    it('is deterministic — the same field lays out identically', () => {
      const field = plots(9.5, 9.5, 9.5)
      const a = districtSlots(junction(), field)
      const b = districtSlots(junction(), field)
      for (const p of field) expect(a.get(p.id)).to.deep.equal(b.get(p.id))
    })

    it('does not depend on the order the field arrives in', () => {
      // Rosters are sorted by market odds upstream, which changes whenever the
      // odds do. The ground must not move when the leaderboard does.
      const field = plots(11, 4, 11)
      const forward = districtSlots(junction(), field)
      const reversed = districtSlots(junction(), [...field].reverse())
      for (const p of field) {
        expect(forward.get(p.id)).to.deep.equal(reversed.get(p.id))
      }
    })

    it('aligns each plot to its street rather than spinning it round', () => {
      const slots = districtSlots(junction({ turn: 22 }), plots(6, 6, 6, 6))
      for (const [, slot] of slots) {
        // Buildings on a street read as aligned to it. The jitter only exists so
        // four identical relay terminals aren't four copies of one render.
        expect(Math.abs(slot.turn - 22)).to.be.lessThan(8)
      }
    })

    it('flanks a road with the landing zone rather than cornering it', () => {
      const plan = BASE_PLAN.lander!
      const slots = districtSlots(plan, ROSTERS.lander!)
      const side = (id: string) => Math.sign(local(plan, slots.get(id)!).acrossM)
      // One pad each side of the spine: it runs BETWEEN them, so a road that
      // dead-ends at the near pad can never leave the bigger vehicle
      // unreachable. This is the one district with no branch of its own, and the
      // reason is grade — a spur out to the pads would run the fall line (see
      // the bearing table in baseplan.ts).
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

    it('stands every district on the spine', () => {
      // The whole plan in one assertion: a district's centre is a point ON the
      // one road, so `across` is zero and `along` is all that distinguishes any
      // of them. Exact rather than tolerant because every position in BASE_PLAN
      // is written by `at()` rather than as a hand-rounded coordinate pair.
      for (const [category] of races) {
        const plan = BASE_PLAN[category]!
        expect(spineCoords(plan).acrossM, category).to.be.closeTo(0, 1e-9)
      }
    })

    it('keeps every district inside the length of the spine', () => {
      // A district past the end of the road is a district with no road, and the
      // spine is the only road that reaches any of them. Measured ALONG the
      // spine rather than as a radius: the landing zone's pads reach 70 m ACROSS
      // it, which says nothing about whether the road is long enough.
      for (const [category, field] of races) {
        const alongM = districtAlongM(BASE_PLAN[category]!)
        const { along } = districtNeed(category, field)
        expect(alongM - along, `${category} runs off the southwest end`).to.be
          .greaterThan(SPINE_START_M)
        expect(alongM + along, `${category} runs off the northeast end`).to.be
          .lessThan(SPINE_END_M)
      }
    })

    it('clears each district of its neighbours up the street', () => {
      // The spacing along the spine is hand-set (see BASE_PLAN), and the rosters
      // are not: a race that gains a competitor spreads further up the street,
      // and construction's fifth paving bid already reaches 43 m. So the gaps
      // are asserted against the real packing rather than against the centres.
      const zones = races
        .map(([category, field]) => {
          const along = districtAlongM(BASE_PLAN[category]!)
          const need = districtNeed(category, field).along
          return { category, along, sw: along - need, ne: along + need }
        })
        .sort((a, b) => a.along - b.along)

      for (let i = 1; i < zones.length; i++) {
        expect(
          zones[i].sw - zones[i - 1].ne,
          `${zones[i - 1].category} to ${zones[i].category}`
        ).to.be.at.least(DISTRICT_GAP_M)
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

    it('gives the habitat race a block on the street like everyone else', () => {
      // The habitat race used to be THE CORE: a plaza of its own inside a
      // perimeter road, on a 60.5 m paved hardstand, packed as a ring of five
      // with no road through it. It is now an ordinary crossroads district, and
      // this is the assertion that says so — it fronts two streets at the same
      // setback as every other lot on the base, and it packs TIGHTER than the
      // ring did (38 m of the 58.7 m the ring needed) because a corner lot uses
      // the ground behind it that a ring could only leave empty in the middle.
      const habitat = BASE_PLAN.habitat!
      expect(habitat.front, 'no special frontage').to.be.undefined
      expect(
        districtExtentM(habitat, ROSTERS.habitat!),
        'packs no wider than the ring it replaced'
      ).to.be.lessThan(58.7)
      // And its branch is a real road on the network, which the plaza never was.
      expect(
        BASE_STREETS.some((st) => st.serves?.includes('habitat')),
        'the habitat race has a branch'
      ).to.equal(true)
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

    it('sizes every branch to the lots it serves and no further', () => {
      // `reach` is hand-set and the rosters are not, so this is the check that
      // keeps them honest in both directions. Short, and the outer corner lots
      // stand on open regolith; long, and the branch is a road to nowhere.
      for (const [category, field] of races) {
        const plan = BASE_PLAN[category]!
        const need = districtNeed(category, field).across
        expect(plan.reach!, `${category} branch reach`).to.be.at.least(need)
        expect(
          plan.reach! - need,
          `${category} branch overshoot`
        ).to.be.lessThan(12)
      }
    })

    it('keeps every district keep-out around its own real block', () => {
      // `block` is what holds base-wide filler off a district (see
      // withinDistrictGround), and unlike `reach` it has to cover the district
      // in BOTH directions — a race with more than four competitors spreads up
      // the spine, so its block is much wider than it is deep.
      for (const [category, field] of races) {
        const plan = BASE_PLAN[category]!
        const need = districtNeed(category, field)
        expect(
          plan.block ?? plan.reach!,
          `${category} keep-out covers its block`
        ).to.be.at.least(Math.max(need.across, need.along))
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
    const spine = BASE_STREETS.find((st) => !st.serves)!
    const branches = BASE_STREETS.filter((st) => st.serves)

    it('lays one spine, straight, on the bearing the ground chose', () => {
      // Every road on this plan is described by its two endpoints and nothing
      // in between, which is the whole reason a distance to a road is now exact
      // (see distToRoadM). A waypoint off the line would silently reintroduce
      // the spline bulge the concentric plan had.
      expect(BASE_STREETS.filter((st) => !st.serves), 'exactly one spine').to.have
        .length(1)
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

    it('crosses the spine with one straight branch per district', () => {
      for (const [category, field] of races) {
        const plan = BASE_PLAN[category]!
        // The landing zone flanks the spine instead (see its own test above).
        if (plan.front === 'lot' || plan.front === 'flank') continue
        const street = branches.find((st) => st.serves?.includes(category))
        expect(street, `${category} branch`).to.exist
        const pts = street!.points
        const alongM = districtAlongM(plan)

        // Perpendicular to the spine, and crossing at its district's own
        // crossing — so the branch stays on one `along` from end to end.
        for (const pt of pts) {
          expect(
            spineCoords({ east: pt[0], north: pt[1] }).alongM,
            `${category} branch is perpendicular`
          ).to.be.closeTo(alongM, 1e-9)
        }

        // Symmetric about the spine, which is what makes it a CROSSING rather
        // than a spur: the corner lots on both sides are served by one road.
        const across = pts
          .map((pt) => spineCoords({ east: pt[0], north: pt[1] }).acrossM)
          .sort((a, b) => a - b)
        expect(across[0], `${category} branch is symmetric`).to.be.closeTo(
          -across[across.length - 1],
          1e-9
        )

        // And runs the full width of the lots: a branch that stops short leaves
        // the outer corner lots standing on open regolith.
        const outer = districtNeed(category, field).across
        const end = across[across.length - 1]
        expect(end, `${category} branch reach`).to.be.at.least(outer)
        // But not so far past it that it reads as a road to nowhere.
        expect(
          end - outer,
          `${category} branch overshoot`
        ).to.be.lessThan(BRANCH_TAIL_M + 12)
      }
    })

    it('gives no road a bearing the base has no reason to travel', () => {
      // Every road is either the settlement's own frame (the spine) or a branch
      // named for the district it crosses. The rule exists because the failure
      // mode here is decorative roads, which read as tyre marks.
      expect(branches.length, 'a branch per crossroads district').to.equal(
        races.filter(([c]) => !BASE_PLAN[c]!.front).length
      )
      for (const street of branches) {
        expect(street.serves, 'every branch serves a district').to.not.be.empty
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
        // network: a branch's midpoint is its crossing with the spine, so a
        // point offset from there is legitimately right on another road.
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
      expect(
        Math.abs(local(plan, slot).acrossM),
        'breach lot setback off the spine'
      ).to.be.closeTo(ROAD_HALF_M + SETBACK_M + BREACH_LOT_RADIUS_M, 1e-9)
    })
  })
})
