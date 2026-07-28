/**
 * Moon Base Zero site plan (headless, mocha + chai).
 *
 * The district packer is geometry that nothing on screen will tell you has
 * broken: add a fourth competitor to a race and two plots quietly overlap, and
 * what you see is one reactor standing inside another. So the invariants are
 * asserted here instead — no two plots in a district touch, the packing is
 * deterministic, and the districts themselves clear each other on the ground.
 */

import { expect } from 'chai'
import {
  BASE_PLAN,
  DISTRICT_GAP_M,
  RING_RADIUS_M,
  districtExtentM,
  districtSlots,
  type Plot,
  type SitePlan,
} from '../../../lib/lunar-atlas/baseplan'
import type { ProjectType } from '../../../lib/lunar-atlas/types'

const plan = (over: Partial<SitePlan> = {}): SitePlan => ({
  east: 0,
  north: 0,
  turn: 0,
  ...over,
})

const plots = (...radii: number[]): Plot[] =>
  radii.map((radiusM, i) => ({ id: `p${i}`, radiusM }))

// Closest approach between the EDGES of every pair of plots, which is the
// number that matters: plots are spaced from their edges, not their centres.
function tightestGap(p: SitePlan, list: Plot[]): number {
  const slots = districtSlots(p, list)
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

describe('moon base zero site plan', () => {
  describe('districtSlots', () => {
    it('places a lone competitor on the district centre', () => {
      const slots = districtSlots(plan({ east: 10, north: -4 }), plots(5))
      const only = slots.get('p0')!
      expect(only.east).to.be.closeTo(10, 1e-9)
      expect(only.north).to.be.closeTo(-4, 1e-9)
      expect(only.offsetM).to.equal(0)
    })

    it('keeps every plot clear of every other, for any size of field', () => {
      // Two is the special case (a pair, not a ring); three and up go on a ring.
      // Mixed radii matter most: equal circles are the easy case.
      const fields = [
        plots(9.5, 9.5),
        plots(31.2, 9.6), // the landing zone: a 62 m pad beside a 19 m one
        plots(11, 11, 4),
        plots(9.5, 9.5, 9.5),
        plots(6.3, 6.3, 6.3, 6.3),
        plots(19, 6, 6, 6, 6),
        plots(2.3, 2.1, 2.2, 8, 15, 3),
      ]
      for (const field of fields) {
        // Jitter is allowed to eat into the gap, but not through it.
        expect(
          tightestGap(plan(), field),
          `field of ${field.length}`
        ).to.be.greaterThan(DISTRICT_GAP_M * 0.75)
      }
    })

    it('centres a pair on its combined frontage, not on its centres', () => {
      // A 31 m plot beside a 10 m one: if the district centre fell midway
      // between the two CENTRES the lot would stick out much further one side
      // than the other, and the district would need a radius set by its worst
      // side rather than its real size.
      const field = plots(31.2, 9.6)
      const slots = districtSlots(plan(), field)
      const big = slots.get('p0')!
      const small = slots.get('p1')!
      expect(big.offsetM + 31.2).to.be.closeTo(small.offsetM + 9.6, 1e-6)
    })

    it('is deterministic — the same field lays out identically', () => {
      const field = plots(9.5, 9.5, 9.5)
      const a = districtSlots(plan({ east: 3, north: 7 }), field)
      const b = districtSlots(plan({ east: 3, north: 7 }), field)
      for (const p of field) {
        expect(a.get(p.id)).to.deep.equal(b.get(p.id))
      }
    })

    it('does not depend on the order the field arrives in', () => {
      // Rosters are sorted by market odds upstream, which changes whenever the
      // odds do. The ground must not move when the leaderboard does.
      const field = plots(11, 4, 11)
      const forward = districtSlots(plan(), field)
      const reversed = districtSlots(plan(), [...field].reverse())
      for (const p of field) {
        expect(forward.get(p.id)).to.deep.equal(reversed.get(p.id))
      }
    })

    it('turns each plot off the district heading without spinning it round', () => {
      const slots = districtSlots(plan({ turn: 22 }), plots(6, 6, 6, 6))
      for (const [, slot] of slots) {
        // Enough to break up a chorus line, never enough to show the camera an
        // asset's back.
        expect(Math.abs(slot.turn - 22)).to.be.lessThan(15)
      }
    })
  })

  describe('the colony', () => {
    // The real rosters, by size of field — see the shared goals in the seed
    // dataset. Radii are footprints in meters (footprintRadiusM).
    const rosters: Partial<Record<ProjectType, Plot[]>> = {
      crewed_base: plots(19, 6),
      lander: plots(31.2, 9.6),
      power: plots(11, 4, 11),
      isru_plant: plots(9.5, 9.5, 9.5),
      rover: plots(2.3, 2.1, 2.2),
      habitat: plots(5.5, 5.5, 3.3),
      construction: plots(6.3, 6.3, 6.3, 6.3),
      comms_pnt: plots(7.5, 7.5, 7.5, 7.5),
    }

    it('gives every race in the plan a district', () => {
      for (const category of Object.keys(rosters)) {
        expect(BASE_PLAN[category as ProjectType], category).to.exist
      }
    })

    it('has no district overlapping another', () => {
      const entries = Object.entries(rosters) as [ProjectType, Plot[]][]
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const [catA, fieldA] = entries[i]
          const [catB, fieldB] = entries[j]
          const a = BASE_PLAN[catA]!
          const b = BASE_PLAN[catB]!
          const d = Math.hypot(a.east - b.east, a.north - b.north)
          const need =
            districtExtentM(a, fieldA) + districtExtentM(b, fieldB)
          expect(d, `${catA} vs ${catB}`).to.be.greaterThan(need)
        }
      }
    })

    it('keeps the core district inside the perimeter road', () => {
      const core = BASE_PLAN.crewed_base!
      const extent = districtExtentM(core, rosters.crewed_base!)
      // The road's inner edge, roughly a windrow's width inside the centreline.
      expect(extent).to.be.lessThan(RING_RADIUS_M - 6)
    })

    it('parks the rover depot ON the perimeter road', () => {
      // Not decoration: the leading vehicle drives laps of the ring from its
      // plot, and a lap is a rotation about the patch centre — so it holds
      // whatever radius the plot has. Put the depot elsewhere and the rover
      // drives across open regolith.
      const depot = BASE_PLAN.rover!
      const r = Math.hypot(depot.east, depot.north)
      expect(r).to.be.closeTo(RING_RADIUS_M, 1)
    })

    it('stands the landing zone well clear of anything pressurized', () => {
      // A Starship-class descent throws ejecta on ballistic arcs with no air to
      // stop it. This is already a compromise with keeping the vehicle in frame,
      // so the assertion is a floor, not a target.
      const pad = BASE_PLAN.lander!
      const core = BASE_PLAN.crewed_base!
      const gap =
        Math.hypot(pad.east - core.east, pad.north - core.north) -
        districtExtentM(pad, rosters.lander!) -
        districtExtentM(core, rosters.crewed_base!)
      expect(gap).to.be.greaterThan(50)
    })
  })
})
