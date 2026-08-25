/**
 * Moon Base Zero street plan (headless, mocha + chai).
 *
 * The plan is geometry that nothing on screen will tell you has broken. Add a
 * fourth competitor to a race and two corner lots quietly overlap, and what you
 * see is one reactor standing inside another; nudge main street's radius and the
 * inward lots creep under its windrow. So the invariants are asserted here: no
 * two plots touch, every plot fronts a street at the same setback, every avenue
 * runs the full length of the district it serves, and the districts clear each
 * other on the ground.
 */

import { expect } from 'chai'
import {
  BASE_PLAN,
  BASE_STREETS,
  DISTRICT_GAP_M,
  HARDSTAND,
  MAIN_LOOP_M,
  PATROL,
  RING_RADIUS_M,
  ROAD_HALF_M,
  SETBACK_M,
  districtBearingDeg,
  districtExtentM,
  districtSlots,
  type Plot,
  type SitePlan,
} from '../../../lib/lunar-atlas/baseplan'
import type { ProjectType } from '../../../lib/lunar-atlas/types'

const plots = (...radii: number[]): Plot[] =>
  radii.map((radiusM, i) => ({ id: `p${i}`, radiusM }))

// A crossroads district on main street, which is the default everything else is
// measured against.
const junction = (over: Partial<SitePlan> = {}): SitePlan => ({
  east: MAIN_LOOP_M,
  north: 0,
  turn: 0,
  ...over,
})

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
  // inflatable LIFE habitat (6 m), Thales' MPH module (5.5 m), and Toyota's
  // Lunar Cruiser (3.3 m). A base is not a different kind of thing from a
  // habitat module, just more of them integrated together, so all five
  // compete on the same hardstand.
  habitat: plots(19, 12.86, 6, 5.5, 3.3),
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
  construction: plots(6.3, 6.3, 6.3, 6.3),
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
  // 7 m, not the model's full 35 m schematic half-length — see
  // FOOTPRINT_FRACTION['anthrofuturism-lunar-mass-driver'] in
  // ProjectModel.tsx.
  mass_driver: plots(7),
}

const races = Object.entries(ROSTERS) as [ProjectType, Plot[]][]

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
      // plot is `setback + road half-width + its own radius` from main street's
      // centreline radially, and the same from its avenue perpendicularly — so
      // every asset on the base ends up with an identical strip of clear
      // regolith at its edge.
      for (const [category, field] of races) {
        const plan = BASE_PLAN[category]!
        if (plan.front) continue
        const bearing = (districtBearingDeg(plan) * Math.PI) / 180
        const slots = districtSlots(plan, field)
        for (const plot of field) {
          const slot = slots.get(plot.id)!
          const want = ROAD_HALF_M + SETBACK_M + plot.radiusM
          const radius = Math.hypot(slot.east, slot.north)
          expect(
            Math.abs(radius - MAIN_LOOP_M),
            `${category}/${plot.id} off main street`
          ).to.be.closeTo(want, 1e-6)
          // Perpendicular distance from the avenue, which runs along `bearing`.
          const across = Math.abs(
            -Math.sin(bearing) * slot.east + Math.cos(bearing) * slot.north
          )
          expect(across, `${category}/${plot.id} off its avenue`).to.be.closeTo(
            want,
            1e-6
          )
        }
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
      const bearing = (districtBearingDeg(plan) * Math.PI) / 180
      const side = (s: { east: number; north: number }) =>
        Math.sign(
          -Math.sin(bearing) * (s.east - plan.east) +
            Math.cos(bearing) * (s.north - plan.north)
        )
      // One pad each side of the haul road: it runs BETWEEN them, so a road that
      // dead-ends at the near pad can never leave the bigger vehicle unreachable.
      expect(side(slots.get('p0')!)).to.equal(-side(slots.get('p1')!))
    })
  })

  describe('the colony', () => {
    it('gives every race in the plan a district', () => {
      for (const [category] of races) {
        expect(BASE_PLAN[category], category).to.exist
      }
    })

    it('stands the crossroads districts on main street', () => {
      for (const [category] of races) {
        const plan = BASE_PLAN[category]!
        if (plan.front) continue
        expect(
          Math.hypot(plan.east, plan.north),
          category
        ).to.be.closeTo(MAIN_LOOP_M, 0.05)
      }
    })

    it('spaces the junctions evenly enough to read as surveyed', () => {
      const bearings = races
        .filter(([category]) => !BASE_PLAN[category]!.front)
        .map(
          ([category]) => (districtBearingDeg(BASE_PLAN[category]!) + 360) % 360
        )
        .sort((a, b) => a - b)
      const gaps = bearings.map(
        (b, i) => ((i ? b - bearings[i - 1] : b + 360 - bearings.at(-1)!) + 360) % 360
      )
      // A regular grid is what a viewer reads as a plan. Multiples of 45° with
      // nothing crowded closer than that.
      for (const gap of gaps) expect(gap).to.be.at.least(44)
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
          // (see the `lot` case in districtSlots), so this is a floating-point
          // tie rather than real slack — allow the same 1e-6 the rest of this
          // file uses for exact geometric identities.
          expect(gap, `${a.id} vs ${b.id}`).to.be.at.least(DISTRICT_GAP_M - 1e-6)
        }
      }
    })

    it('keeps the core district on its hardstand, inside the perimeter road', () => {
      const core = BASE_PLAN.habitat!
      const extent = districtExtentM(core, ROSTERS.habitat!)
      expect(extent).to.be.lessThan(HARDSTAND.radius)
      expect(HARDSTAND.radius).to.be.lessThan(RING_RADIUS_M)
    })

    it('leaves the inward corner lots clear of the perimeter road', () => {
      // Main street's radius is set by whichever district reaches deepest, and
      // this is the assertion that says so: pull the loop in and the power
      // district's reactors end up on the ring road.
      for (const [category, field] of races) {
        const plan = BASE_PLAN[category]!
        if (plan.front) continue
        const slots = districtSlots(plan, field)
        for (const plot of field) {
          const slot = slots.get(plot.id)!
          const inner = Math.hypot(slot.east, slot.north) - plot.radiusM
          expect(inner, `${category}/${plot.id}`).to.be.greaterThan(
            RING_RADIUS_M + ROAD_HALF_M + 1
          )
        }
      }
    })

    it('drives the patrol on a road, not on the shoulder of a lot', () => {
      // The lap is a rigid rotation about the patch centre, so the vehicle holds
      // whatever radius it starts from. Naming a road here is what keeps it out
      // of the windrow — reading the radius off its own corner lot would not.
      for (const [category, patrol] of Object.entries(PATROL)) {
        expect(patrol!.radiusM, category).to.be.oneOf([
          RING_RADIUS_M,
          MAIN_LOOP_M,
        ])
        expect(BASE_PLAN[category as ProjectType], category).to.exist
      }
    })

    it('stands the landing zone well clear of anything pressurized', () => {
      // A Starship-class descent throws ejecta on ballistic arcs with no air to
      // stop it. This is already a compromise with keeping the vehicle in frame,
      // so the assertion is a floor, not a target.
      const pad = BASE_PLAN.lander!
      const core = BASE_PLAN.habitat!
      const gap =
        Math.hypot(pad.east - core.east, pad.north - core.north) -
        districtExtentM(pad, ROSTERS.lander!) -
        districtExtentM(core, ROSTERS.habitat!)
      expect(gap).to.be.greaterThan(30)
    })
  })

  describe('the street network', () => {
    const closed = BASE_STREETS.filter((s) => s.closed)
    const radiusOf = (pt: [number, number]) => Math.hypot(pt[0], pt[1])

    it('lays the perimeter road and main street as true circles', () => {
      expect(closed).to.have.length(2)
      for (const [street, want] of [
        [closed[0], RING_RADIUS_M],
        [closed[1], MAIN_LOOP_M],
      ] as const) {
        for (const pt of street.points) {
          expect(radiusOf(pt)).to.be.closeTo(want, 1e-6)
        }
      }
    })

    it('runs an avenue from the perimeter road out through every district', () => {
      for (const [category, field] of races) {
        const plan = BASE_PLAN[category]!
        if (plan.front === 'lot') continue
        const street = BASE_STREETS.find(
          (s) => !s.closed && s.serves?.includes(category)
        )
        expect(street, `${category} avenue`).to.exist
        const pts = street!.points
        // Starts on the perimeter road, on the district's own bearing, so it
        // leaves the junction pointing at where it is going.
        expect(radiusOf(pts[0])).to.be.closeTo(RING_RADIUS_M, 1e-6)
        const bearing = (districtBearingDeg(plan) * Math.PI) / 180
        for (const pt of pts) {
          const across = Math.abs(
            -Math.sin(bearing) * pt[0] + Math.cos(bearing) * pt[1]
          )
          expect(across, `${category} avenue is radial`).to.be.lessThan(1e-6)
        }
        // And runs the full length of the lot: an avenue that stops short leaves
        // the outer corner lots standing on open regolith.
        const slots = districtSlots(plan, field)
        const outer = Math.max(
          ...field.map((p) => {
            const s = slots.get(p.id)!
            return (
              (s.east - plan.east) * Math.cos(bearing) +
              (s.north - plan.north) * Math.sin(bearing) +
              p.radiusM
            )
          })
        )
        const end = radiusOf(pts.at(-1)!) - Math.hypot(plan.east, plan.north)
        expect(end, `${category} avenue reach`).to.be.at.least(outer)
        // But not so far past it that it reads as a road to nowhere.
        expect(end - outer, `${category} avenue overshoot`).to.be.lessThan(12)
      }
    })

    it('gives no road a bearing the base has no reason to travel', () => {
      // Every road is either the settlement's own frame (the two loops) or an
      // avenue named for the district it reaches. The rule exists because the
      // failure mode here is decorative roads, which read as tyre marks.
      for (const street of BASE_STREETS) {
        if (street.closed) {
          expect(street.serves).to.be.undefined
        } else {
          expect(street.serves, 'every open road serves a district').to.not.be
            .empty
        }
      }
    })
  })
})
