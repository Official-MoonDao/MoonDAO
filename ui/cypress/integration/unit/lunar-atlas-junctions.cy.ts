/**
 * Where the roads of Moon Base Zero meet each other (headless, mocha + chai).
 *
 * This is the half of the road network that nothing on screen will tell you has
 * broken, in the specific sense that when it IS broken it still looks like
 * scenery. A road's windrow of pushed-aside rock is built by sweeping a
 * cross-section along a centreline, which is a job each street can do alone —
 * and done alone, main street drives a half-meter wall of rubble and a line of
 * boulders straight through all seven of the junctions it crosses in the middle
 * of its own run. That shipped, because a junction full of rock reads as a
 * junction full of rock rather than as a bug.
 *
 * So the invariants are asserted here instead: every avenue meets both loops
 * exactly once, at the district's own bearing; no road carries any windrow at
 * all across another road's graded width; and the windrow comes back between
 * the crossings, because a network that swept itself flat everywhere would pass
 * every check above and have no edges left.
 */

import { expect } from 'chai'
import {
  BASE_PLAN,
  BASE_STREETS,
  HARDSTAND,
  MAIN_LOOP_M,
  RING_RADIUS_M,
  ROAD_HALF_M,
  districtBearingDeg,
  type SitePlan,
} from '../../../lib/lunar-atlas/baseplan'
import {
  BED_HALF_M,
  JUNCTION_FILLET_M,
  JUNCTION_MERGE_M,
  SPOIL_OPAQUE_OFF_M,
  SPOIL_TOE_OFF_M,
  centreline,
  distToCentreline,
  findJunctions,
  junctionBedCover,
  junctionBedCut,
  junctionBermLevel,
  junctionCutsOn,
  junctionsOn,
  type Centreline,
} from '../../../lib/lunar-atlas/junctions'
import type { ProjectType } from '../../../lib/lunar-atlas/types'

const lines = BASE_STREETS.map(centreline)
const junctions = findJunctions(lines)

const loops = BASE_STREETS.map((s, i) => (s.closed ? i : -1)).filter(
  (i) => i >= 0
)
const avenues = BASE_STREETS.map((s, i) => (s.closed ? -1 : i)).filter(
  (i) => i >= 0
)

const at = (i: number) => lines[i] as Centreline
const radiusOf = (p: { east: number; north: number }) =>
  Math.hypot(p.east, p.north)
const bearingOf = (p: { east: number; north: number }) =>
  ((Math.atan2(p.north, p.east) * 180) / Math.PI + 360) % 360

// The district an avenue serves, which is also the bearing it runs on.
const districtOf = (streetIdx: number): SitePlan => {
  const serves = BASE_STREETS[streetIdx].serves as ProjectType[]
  return BASE_PLAN[serves[0]]!
}

describe('moon base zero road junctions', () => {
  describe('the crossings themselves', () => {
    it('meets every avenue to both loop roads, once each', () => {
      // Seven districts on a bearing, two loops to cross on the way out. The
      // count is asserted whole rather than per-avenue because the failure this
      // exists to catch is a crossing that stops being FOUND — a plan change
      // that moves main street or an avenue's start by a meter would drop one
      // silently, and a dropped crossing is a wall of rubble through a junction.
      expect(junctions).to.have.length(avenues.length * loops.length)
      for (const i of avenues) {
        expect(junctionsOn(junctions, i), `street ${i}`).to.have.length(
          loops.length
        )
      }
      for (const i of loops) {
        expect(junctionsOn(junctions, i), `loop ${i}`).to.have.length(
          avenues.length
        )
      }
    })

    it('crosses an avenue with a loop and never one road with its own kind', () => {
      // The two loops are concentric and the avenues all radiate from the same
      // centre at 45° or more apart, so any junction between two of either is a
      // false positive from the search window rather than a road on this plan.
      for (const j of junctions) {
        const pair = [...j.clear.keys()]
        expect(pair, 'a junction joins exactly two roads').to.have.length(2)
        const closed = pair.filter((i) => BASE_STREETS[i].closed)
        expect(closed, `junction at ${bearingOf(j)}°`).to.have.length(1)
      }
    })

    it('puts each crossing on the road it crosses, at its district bearing', () => {
      for (const i of avenues) {
        const plan = districtOf(i)
        const want = (districtBearingDeg(plan) + 360) % 360
        const radii = junctionsOn(junctions, i)
          .map((m) => Math.hypot(m.x, m.y))
          .sort((a, b) => a - b)
        // Located off the rendered centrelines rather than from the plan's own
        // numbers, so this is the check that the two agree. A tenth of a meter
        // on roads whose spoil is swept back by nine.
        expect(radii[0], `street ${i} at the perimeter road`).to.be.closeTo(
          RING_RADIUS_M,
          0.1
        )
        expect(radii[1], `street ${i} at main street`).to.be.closeTo(
          MAIN_LOOP_M,
          0.1
        )
        for (const m of junctionsOn(junctions, i)) {
          const got = ((Math.atan2(m.y, m.x) * 180) / Math.PI + 360) % 360
          expect(got, `street ${i} bearing`).to.be.closeTo(want, 0.1)
        }
      }
    })
  })

  describe('the windrow through a crossing', () => {
    it('grades both roads flat at the crossing itself', () => {
      for (const j of junctions) {
        for (const i of j.clear.keys()) {
          expect(
            junctionBermLevel(j.east, j.north, junctionsOn(junctions, i)),
            `street ${i} at ${bearingOf(j)}°`
          ).to.equal(0)
        }
      }
    })

    it('leaves no road any windrow at all across another road', () => {
      // The invariant that actually matters, and it is deliberately NOT phrased
      // against the junction points: every station of every road that lies
      // anywhere within another road's full graded width — its lane, its verge
      // and its spoil — must have been swept flat there. A fillet trimmed back
      // far enough to leave rubble standing on somebody's driving surface fails
      // here even though every junction is still found in the right place.
      //
      // The boulders ride the same figure (see the rock loop in BaseRoads,
      // which skips any span whose windrow is not at full height), so this is
      // also what keeps loose rock out of the crossings.
      for (const a of BASE_STREETS.keys()) {
        const la = at(a)
        const meets = junctionsOn(junctions, a)
        for (const b of BASE_STREETS.keys()) {
          if (a === b) continue
          const lb = at(b)
          for (const p of la.plan) {
            if (distToCentreline(p, lb) > lb.toeHalfM) continue
            expect(
              junctionBermLevel(p.x, p.y, meets),
              `street ${a} keeps spoil on street ${b} at ${p.x.toFixed(1)}, ${p.y.toFixed(1)}`
            ).to.equal(0)
          }
        }
      }
    })

    it('sweeps each road back for the other road width, not its own', () => {
      // A rover-width avenue does not need main street swept as far back as a
      // haul road does, and main street's own width is what the avenue has to
      // clear either way. Getting this backwards is invisible on screen and
      // leaves the narrow junctions over-graded and the wide ones under.
      for (const j of junctions) {
        const [x, y] = [...j.clear.keys()]
        expect(j.clear.get(x)).to.be.closeTo(
          at(y).bedHalfM + JUNCTION_FILLET_M,
          1e-9
        )
        expect(j.clear.get(y)).to.be.closeTo(
          at(x).bedHalfM + JUNCTION_FILLET_M,
          1e-9
        )
      }
    })
  })

  describe('the windrow everywhere else', () => {
    it('gives every road its edge back between the crossings', () => {
      // The one check that stops all of the above being satisfied by a network
      // with no windrows on it anywhere. Main street crosses seven avenues and
      // the perimeter road takes seven more, so these two are the roads with
      // the least edge left; if they still carry one over most of their length,
      // nothing else on the plan is over-graded either.
      for (const i of loops) {
        const levels = at(i).plan.map((p) =>
          junctionBermLevel(p.x, p.y, junctionsOn(junctions, i))
        )
        const full = levels.filter((l) => l > 0.999).length
        expect(full / levels.length, `loop ${i} at full windrow`).to.be.above(
          0.4
        )
      }
      for (const i of avenues) {
        const levels = at(i).plan.map((p) =>
          junctionBermLevel(p.x, p.y, junctionsOn(junctions, i))
        )
        expect(
          Math.max(...levels),
          `street ${i} has some windrow somewhere`
        ).to.equal(1)
      }
    })
  })

  describe('the bed through a crossing', () => {
    it('runs an avenue into the road it starts on rather than fading out', () => {
      // Every avenue begins on the perimeter road, and an open end fades its bed
      // out over the first few meters so a road stops instead of dissolving.
      // At a junction that is exactly wrong — it would put a notch in the
      // surface at the one point the two roads are supposed to become one — so
      // the crossing carries the bed at full strength.
      for (const i of avenues) {
        const start = at(i).plan[0]
        expect(
          junctionBedCover(start.x, start.y, junctionsOn(junctions, i)),
          `street ${i} start`
        ).to.be.above(0.99)
      }
    })

    it('still lets an avenue stop at the far end of its own district', () => {
      // The other end has no junction on it, so it keeps the fade. An avenue
      // that ran to a hard edge out past the last lot would read as a road
      // sawn off rather than as one that ends.
      for (const i of avenues) {
        const end = at(i).plan[at(i).plan.length - 1]
        expect(
          junctionBedCover(end.x, end.y, junctionsOn(junctions, i)),
          `street ${i} end`
        ).to.equal(0)
      }
    })
  })

  describe('who owns the ground in the middle of a crossing', () => {
    // Sweeping the rubble out is not enough to make a junction, because both
    // roads are still a full-width surface swept along their own centreline and
    // both still cover the middle. Two lit, textured, cambered surfaces stacked
    // on one patch of ground do not average into one — the second drawn wins,
    // and because its grain and its camber run the other way it wins as a
    // hard-edged rectangle a shade off everything around it. That rectangle is
    // the tell that the roads are lying on each other, and matching their
    // colours cannot remove it, because the difference is in the lighting.
    //
    // So exactly one road paves each patch. These are the checks that it is one
    // and not two, and not none.
    const cutsOf = (i: number) => junctionCutsOn(junctions, i, lines)

    it('hands every crossing to the loop road that runs through it', () => {
      for (const j of junctions) {
        expect([...j.clear.keys()], `junction at ${bearingOf(j)}°`).to.include(
          j.through
        )
        expect(
          BASE_STREETS[j.through].closed,
          `junction at ${bearingOf(j)}° is carried by a loop`
        ).to.equal(true)
      }
    })

    it('never breaks a loop road for an avenue', () => {
      // The corollary, and the reason the loops win: main street is continuous
      // by construction, and cutting it at all seven of its crossings so an
      // avenue could lie across it is the same artefact the other way round.
      for (const i of loops) {
        expect(cutsOf(i), `loop ${i} is cut`).to.have.length(0)
      }
    })

    it('stops the giving-way road dead at the through road lane', () => {
      for (const j of junctions) {
        const gives = [...j.clear.keys()].find((i) => i !== j.through)!
        const cuts = cutsOf(gives)
        expect(
          junctionBedCut(j.east, j.north, cuts),
          `street ${gives} paves over street ${j.through} at ${bearingOf(j)}°`
        ).to.equal(0)
        // Not just at the centre point: anywhere on the other road's lane.
        for (const p of at(gives).plan) {
          if (distToCentreline(p, at(j.through)) > at(j.through).bedHalfM) {
            continue
          }
          expect(
            junctionBedCut(p.x, p.y, cuts),
            `street ${gives} paves street ${j.through} at ${p.x.toFixed(1)}, ${p.y.toFixed(1)}`
          ).to.equal(0)
        }
      }
    })

    it('leaves no ring of unpaved ground around a crossing', () => {
      // The failure mode of the cut, and the one worth a test of its own: a
      // giving-way road that comes back too slowly is still transparent by the
      // time the through road's own outer flank has started to feather, so a
      // thin band around every junction gets paved by neither of them and the
      // terrain shows through as a halo. The merge has to finish while the
      // through road is still solid, with the windrow's lateral jitter — three
      // percent either way, see `crest` in BaseRoads — allowed for.
      for (const j of junctions) {
        const through = at(j.through)
        expect(
          through.bedHalfM + JUNCTION_MERGE_M,
          `merge into street ${j.through}`
        ).to.be.lessThan(SPOIL_OPAQUE_OFF_M * through.widthScale * 0.97)
      }
    })

    it('gives the giving-way road all of its own surface back', () => {
      // Which is what stops every check above being satisfied by simply not
      // drawing the avenues at all. An avenue gives way over the corridors of
      // the two loops it crosses and over NOTHING else: every station clear of
      // both is at full strength, which bounds the cut from above as tightly as
      // the checks above bound it from below. Asserted station by station
      // rather than as a fraction of the road, because the avenues run from
      // 32 m to 300 m and a fraction that passes for the pad road says nothing
      // about the short one into the core.
      for (const i of avenues) {
        const cuts = cutsOf(i)
        expect(cuts, `street ${i} gives way twice`).to.have.length(loops.length)
        let clear = 0
        for (const p of at(i).plan) {
          const inside = cuts.some(
            (c) => distToCentreline(p, c.line) < c.halfM + JUNCTION_MERGE_M
          )
          if (inside) continue
          clear++
          expect(
            junctionBedCut(p.x, p.y, cuts),
            `street ${i} withheld at ${p.x.toFixed(1)}, ${p.y.toFixed(1)}`
          ).to.equal(1)
        }
        expect(clear, `street ${i} runs clear of both loops somewhere`).to.be
          .above(0)
      }
    })
  })

  describe('the cross-section these are measured against', () => {
    it('nests the lane inside the spoil inside the plan own half-width', () => {
      // ROAD_HALF_M is what every plot on the base keeps its setback from, so a
      // profile that quietly reached past it would eat the setback on all eight
      // districts at once.
      expect(BED_HALF_M).to.be.lessThan(SPOIL_TOE_OFF_M)
      expect(SPOIL_TOE_OFF_M).to.be.lessThan(ROAD_HALF_M)
    })

    it('runs the hardstand out to the perimeter road without paving over it', () => {
      // The yard is laid to the windrow's inner toe rather than to
      // HARDSTAND.radius, which is the figure the core district's PLOTS are
      // packed inside — see PLAZA_RADIUS_M in BaseRoads. Both ends of that have
      // to hold: far enough out that no ring of untouched regolith is left
      // between the yard and the road, and not so far that the paving swallows
      // the road's own lane.
      const paving = RING_RADIUS_M - SPOIL_TOE_OFF_M
      expect(paving, 'the yard covers the ground its own plots stand on').to.be
        .greaterThan(HARDSTAND.radius)
      expect(paving, 'the yard stops short of the lane').to.be.lessThan(
        RING_RADIUS_M - BED_HALF_M
      )
    })
  })
})
