/**
 * Where the roads of Moon Base Zero meet each other (headless, mocha + chai).
 *
 * This is the half of the road network that nothing on screen will tell you has
 * broken, in the specific sense that when it IS broken it still looks like
 * scenery. A road's windrow of pushed-aside rock is built by sweeping a
 * cross-section along a centreline, which is a job each street can do alone —
 * and done alone, the spine drives a half-meter wall of rubble and a line of
 * boulders straight through all seven of the crossings it makes in the middle of
 * its own run. That shipped, because a junction full of rock reads as a junction
 * full of rock rather than as a bug.
 *
 * So the invariants are asserted here instead: every branch meets the spine
 * exactly once, at its own district's crossing; no road carries any windrow at
 * all across another road's graded width; and the windrow comes back between
 * the crossings, because a network that swept itself flat everywhere would pass
 * every check above and have no edges left.
 *
 * Every crossing on this plan is a mid-run crossing, both ways, which the
 * concentric plan it replaces never had: a branch crosses the spine at its own
 * midpoint and carries on out the other side, where an avenue used to T into the
 * perimeter road at its own first station. Nothing here ends on anything.
 */

import { expect } from 'chai'
import {
  BASE_PLAN,
  BASE_STREETS,
  ROAD_HALF_M,
  districtAlongM,
  spineCoords,
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

// The one through route and the branches that cross it.
const spines = BASE_STREETS.map((s, i) => (s.through ? i : -1)).filter(
  (i) => i >= 0
)
const branches = BASE_STREETS.map((s, i) => (s.through ? -1 : i)).filter(
  (i) => i >= 0
)

const at = (i: number) => lines[i] as Centreline
// Where a point is in the spine's own frame, which is the frame this whole plan
// is stated in.
const alongOf = (p: { east: number; north: number }) =>
  spineCoords(p).alongM
const whereOf = (p: { east: number; north: number }) =>
  `along ${spineCoords(p).alongM.toFixed(1)} m`

// The district a branch serves, which is also the crossing it makes.
const districtOf = (streetIdx: number): SitePlan => {
  const serves = BASE_STREETS[streetIdx].serves as ProjectType[]
  return BASE_PLAN[serves[0]]!
}

describe('moon base zero road junctions', () => {
  describe('the crossings themselves', () => {
    it('meets every branch to the spine, exactly once each', () => {
      // One spine, one crossing per district. The count is asserted whole
      // rather than per-branch because the failure this exists to catch is a
      // crossing that stops being FOUND — a plan change that moves the spine or
      // a branch by a meter would drop one silently, and a dropped crossing is a
      // wall of rubble through a junction.
      expect(spines, 'exactly one through route').to.have.length(1)
      expect(junctions).to.have.length(branches.length)
      for (const i of branches) {
        expect(junctionsOn(junctions, i), `street ${i}`).to.have.length(1)
      }
      expect(
        junctionsOn(junctions, spines[0]),
        'the spine takes every crossing'
      ).to.have.length(branches.length)
    })

    it('crosses a branch with the spine and never one branch with another', () => {
      // The branches are all perpendicular to the spine and none is longer than
      // 114 m, so no two of them come anywhere near each other: any junction
      // between two branches is a false positive from the search window rather
      // than a road on this plan.
      for (const j of junctions) {
        const pair = [...j.clear.keys()]
        expect(pair, 'a junction joins exactly two roads').to.have.length(2)
        expect(pair, `junction at ${whereOf(j)}`).to.include(spines[0])
      }
    })

    it('puts each crossing on its own district, in the middle of the branch', () => {
      for (const i of branches) {
        const plan = districtOf(i)
        const [m] = junctionsOn(junctions, i)
        // Located off the rendered centrelines rather than from the plan's own
        // numbers, so this is the check that the two agree. A tenth of a meter
        // on roads whose spoil is swept back by nine.
        expect(
          alongOf({ east: m.x, north: m.y }),
          `street ${i} crosses at its district`
        ).to.be.closeTo(districtAlongM(plan), 0.1)
        expect(
          spineCoords({ east: m.x, north: m.y }).acrossM,
          `street ${i} crosses on the spine`
        ).to.be.closeTo(0, 0.1)

        // And it crosses at the branch's own MIDPOINT, which is what makes the
        // district a crossroads rather than a spur with lots down one side. This
        // is the assertion that the branch is symmetric about the road it meets.
        const line = at(i)
        let nearest = 0
        let best = Infinity
        line.plan.forEach((p, k) => {
          const d = Math.hypot(p.x - m.x, p.y - m.y)
          if (d < best) {
            best = d
            nearest = k
          }
        })
        expect(
          nearest / (line.plan.length - 1),
          `street ${i} crosses at its own midpoint`
        ).to.be.closeTo(0.5, 0.06)
      }
    })
  })

  describe('the windrow through a crossing', () => {
    it('grades both roads flat at the crossing itself', () => {
      for (const j of junctions) {
        for (const i of j.clear.keys()) {
          expect(
            junctionBermLevel(j.east, j.north, junctionsOn(junctions, i)),
            `street ${i} at ${whereOf(j)}`
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
      // A rover-width branch does not need the spine swept as far back as a
      // haul road does, and the spine's own width is what the branch has to
      // clear either way. Getting this backwards is invisible on screen and
      // leaves the narrow junctions over-graded and the wide ones under. Four
      // of the seven branches are rover width, so this really does differ from
      // crossing to crossing.
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
      // with no windrows on it anywhere. The spine takes all seven crossings, so
      // it is the road with the least edge left by a wide margin; if it still
      // carries one over most of its length, nothing else on the plan is
      // over-graded either.
      for (const i of spines) {
        const levels = at(i).plan.map((p) =>
          junctionBermLevel(p.x, p.y, junctionsOn(junctions, i))
        )
        const full = levels.filter((l) => l > 0.999).length
        expect(full / levels.length, `spine ${i} at full windrow`).to.be.above(
          0.4
        )
      }
      for (const i of branches) {
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
    it('carries a branch bed through the crossing rather than fading out', () => {
      // An open end fades a road's bed out over the first few meters so it stops
      // instead of dissolving. In a junction that is exactly wrong — it would put
      // a notch in the surface at the one point the two roads are supposed to
      // become one — so the crossing carries the bed at full strength.
      //
      // On this plan the crossing is in the MIDDLE of a branch rather than at
      // its first station, so the fade and the crossing are nowhere near each
      // other and this is easier to satisfy than it used to be. It is kept
      // because the failure it catches has nothing to do with where the junction
      // falls: it catches a fade computed over the whole road instead of over
      // its ends.
      for (const i of branches) {
        const [m] = junctionsOn(junctions, i)
        expect(
          junctionBedCover(m.x, m.y, junctionsOn(junctions, i)),
          `street ${i} crossing`
        ).to.be.above(0.99)
      }
    })

    it('lets a branch stop at BOTH ends of its own district', () => {
      // Both ends now, where an avenue only ever had one: a branch runs out past
      // the corner lots on each side of the spine and stops in open regolith at
      // each. A road that ran to a hard edge past the last lot would read as one
      // sawn off rather than as one that ends.
      for (const i of branches) {
        const line = at(i)
        for (const [label, p] of [
          ['start', line.plan[0]],
          ['end', line.plan[line.plan.length - 1]],
        ] as const) {
          expect(
            junctionBedCover(p.x, p.y, junctionsOn(junctions, i)),
            `street ${i} ${label}`
          ).to.equal(0)
        }
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

    it('hands every crossing to the spine', () => {
      // And to the spine SPECIFICALLY, not merely to one of the two: three of
      // the branches are full haul width, so a rule that picked the wider road
      // could not decide those crossings and would fall back on whichever road
      // BASE_STREETS happened to list first. That is why the spine declares
      // itself the through route (see `through` in Street).
      for (const j of junctions) {
        expect([...j.clear.keys()], `junction at ${whereOf(j)}`).to.include(
          j.through
        )
        expect(
          j.through,
          `junction at ${whereOf(j)} is carried by the spine`
        ).to.equal(spines[0])
      }
    })

    it('never breaks the spine for a branch', () => {
      // The corollary, and the reason the spine wins: it is the one road that
      // runs the length of the settlement, and cutting it at all seven of its
      // crossings so a branch could lie across it is the same artefact the other
      // way round.
      for (const i of spines) {
        expect(cutsOf(i), `spine ${i} is cut`).to.have.length(0)
      }
    })

    it('stops the giving-way road dead at the through road lane', () => {
      for (const j of junctions) {
        const gives = [...j.clear.keys()].find((i) => i !== j.through)!
        const cuts = cutsOf(gives)
        expect(
          junctionBedCut(j.east, j.north, cuts),
          `street ${gives} paves over street ${j.through} at ${whereOf(j)}`
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

    it('cuts a branch only where it actually meets the spine', () => {
      // A branch crosses the spine ONCE, at its own midpoint, so it gives way in
      // exactly one place and keeps both halves of itself. This is the check
      // that the cut is local: on the concentric plan an avenue gave way twice
      // and the two corridors were most of a short avenue's length, so a cut
      // that leaked was hard to see. Here each branch has a long clear run
      // either side of its crossing, and a leak shows up immediately.
      for (const i of branches) {
        const cuts = cutsOf(i)
        expect(cuts, `street ${i} gives way once`).to.have.length(1)
      }
    })

    it('gives the giving-way road all of its own surface back', () => {
      // Which is what stops every check above being satisfied by simply not
      // drawing the branches at all. A branch gives way over the spine's own
      // corridor and over NOTHING else: every station clear of it is at full
      // strength, which bounds the cut from above as tightly as the checks
      // above bound it from below. Asserted station by station rather than as a
      // fraction of the road, because the branches run from 54 m to 114 m and a
      // fraction that passes for the habitat's says nothing about a short one.
      for (const i of branches) {
        const cuts = cutsOf(i)
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
        // Both halves, not just one: the crossing is at the branch's midpoint,
        // so a branch that lost a whole side would still pass a "runs clear
        // somewhere" check.
        const spine = at(spines[0])
        for (const side of [1, -1]) {
          const kept = at(i).plan.filter((p) => {
            const across = spineCoords({ east: p.x, north: p.y }).acrossM
            return (
              Math.sign(across) === side &&
              distToCentreline(p, spine) >= spine.bedHalfM + JUNCTION_MERGE_M
            )
          })
          expect(
            kept.length,
            `street ${i} keeps its ${side > 0 ? 'left' : 'right'} half`
          ).to.be.above(0)
        }
        expect(clear, `street ${i} runs clear of the spine somewhere`).to.be
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

    it('scales the whole cross-section together for a narrow road', () => {
      // Four of the seven branches are rover width, and the lane, the windrow's
      // toe and the merge all have to shrink together: a road whose lane
      // narrowed but whose spoil did not would have its own rubble standing on
      // its driving surface, everywhere, not just at a junction.
      for (const i of branches) {
        const line = at(i)
        expect(line.bedHalfM, `street ${i} lane`).to.be.closeTo(
          BED_HALF_M * line.widthScale,
          1e-9
        )
        expect(line.toeHalfM, `street ${i} toe`).to.be.closeTo(
          ROAD_HALF_M * line.widthScale,
          1e-9
        )
        expect(line.bedHalfM, `street ${i} lane inside its own toe`).to.be
          .lessThan(line.toeHalfM)
      }
    })
  })
})
