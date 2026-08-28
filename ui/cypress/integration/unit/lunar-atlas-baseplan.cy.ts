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
  onLoopRoad,
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
  // roster has to be recomputed rather than nudged. It is also why the core
  // ring did NOT have to grow to take them: the ring's radius is solved off
  // the two LARGEST plots (see the 'ring' case in districtSlots), and Artemis
  // Base Camp at 19 m plus ILRS at 12.86 m still set it.
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
  // same generic paving footprint, and the only district on main street that
  // fields more than four. It is therefore the only one that exercises the
  // second lane in districtSlots' crossroads case, so this roster has to stay
  // at the real count: at four it silently stopped covering that branch, which
  // is how a fifth lot came to be placed off the end of its own avenue.
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
      //
      // Both hold exactly for the four CORNER lots. A fifth and beyond continue
      // along main street on the corners' own sides, so they keep the radial
      // setback exactly and stand FURTHER off the avenue than it, never nearer.
      for (const [category, field] of races) {
        const plan = BASE_PLAN[category]!
        if (plan.front) continue
        const bearing = (districtBearingDeg(plan) * Math.PI) / 180
        const slots = districtSlots(plan, field)
        // districtSlots fills the corners largest first, so the lot's place in
        // that order is what decides whether it is a corner or a later block.
        const order = [...field].sort(
          (a, b) => b.radiusM - a.radiusM || a.id.localeCompare(b.id)
        )
        order.forEach((plot, i) => {
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
          const label = `${category}/${plot.id} off its avenue`
          if (i < 4) expect(across, label).to.be.closeTo(want, 1e-6)
          else expect(across, label).to.be.at.least(want - 1e-6)
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
          // (see the `lot` case in districtSlots — nothing in BASE_PLAN uses
          // it today, but the mechanism is still exact), so this is a
          // floating-point tie rather than real slack there — allow the
          // same 1e-6 the rest of this file uses for exact geometric
          // identities. 'ring' districts (the core) pack with real margin
          // on top of the gap by construction, so they clear this with room
          // to spare rather than by a hair.
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

  describe('the buried habitats', () => {
    it('reserves the cover mound rather than the module', () => {
      // The roster above mirrors these by hand, and the whole core ring is
      // solved against those figures — so if a vault's dimensions move and this
      // roster doesn't, every packing assertion in this file starts testing a
      // colony that no longer exists.
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
        if (plan.front === 'lot' || plan.front === 'ring') continue
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
      const pts: { d: number; radius: number; bearing: number }[] = []
      for (let d = 0; d <= TRACK_LENGTH_M; d += 1) {
        for (const off of [-TRACK_CORRIDOR_HALF_M, 0, TRACK_CORRIDOR_HALF_M]) {
          const east = slot.east + ce * d - cn * off
          const north = slot.north + cn * d + ce * off
          pts.push({
            d,
            radius: Math.hypot(east, north),
            bearing:
              ((Math.atan2(north, east) * 180) / Math.PI + 360) % 360,
          })
        }
      }
      return pts
    }

    it('runs the whole way without touching a road', () => {
      for (const p of corridor()) {
        expect(
          onLoopRoad(p.radius),
          `guideway on a loop road at ${p.d} m (r=${p.radius.toFixed(1)})`
        ).to.equal(false)
      }
    })

    it('runs the whole way without crossing another district', () => {
      // The breach works stand on this district's own ground on purpose, so the
      // first stations are exempt — that lot is where they belong.
      const exempt = BREACH_LOT_RADIUS_M + TRACK_CORRIDOR_HALF_M
      for (const p of corridor()) {
        if (p.d <= exempt) continue
        expect(
          withinDistrictGround(p.radius, p.bearing, 10),
          `guideway on district ground at ${p.d} m ` +
            `(r=${p.radius.toFixed(1)}, bearing=${p.bearing.toFixed(1)})`
        ).to.equal(false)
      }
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
      // drifts back toward the model's own length, the junction gets shoved out
      // and this district stops matching the ring.
      expect(ROSTERS.mass_driver![0].radiusM).to.equal(BREACH_LOT_RADIUS_M)
      const radius = Math.hypot(slot.east, slot.north)
      expect(radius - MAIN_LOOP_M, 'breach lot setback off main street').to.be
        .closeTo(ROAD_HALF_M + SETBACK_M + BREACH_LOT_RADIUS_M, 1e-6)
    })
  })
})
