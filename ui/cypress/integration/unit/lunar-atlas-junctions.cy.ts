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
 * So the invariants are asserted here instead: every road meets the road above
 * it in the hierarchy exactly once, where the plan says it does; no road carries
 * any windrow at all across another road's graded width; and the windrow comes
 * back between the crossings, because a network that swept itself flat
 * everywhere would pass every check above and have no edges left.
 *
 * Every junction on this plan is a T, and it is a T at the FIRST station of the
 * road that gives way: a branch starts on the spine and runs away to its
 * district, and a spur starts on its parent branch and does the same. That is
 * the third shape this file has been written against — an avenue used to T into
 * a perimeter road, then a branch crossed the spine at its own midpoint and
 * carried on out the far side — and the junction search has needed no edit for
 * any of them, which is the point of locating crossings by distance minimum
 * rather than by segment intersection.
 *
 * It does mean the fade at an open end and the junction now coincide, where on
 * the previous plan they were half a branch apart. Two checks below exist for
 * exactly that: a road must NOT fade into the junction it starts on, and must
 * still fade at the dead end it finishes on.
 */

import { expect } from 'chai'
import * as THREE from 'three'
import {
  BASE_PLAN,
  BASE_STREETS,
  RANK_BRANCH,
  RANK_SPINE,
  RANK_SPUR,
  ROAD_HALF_M,
  districtAlongM,
  districtRoads,
  spineCoords,
  type SitePlan,
} from '../../../lib/lunar-atlas/baseplan'
import {
  BED_HALF_M,
  JUNCTION_FILLET_M,
  JUNCTION_SHALLOW_MARGIN_M,
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

// The three tiers, by street index.
const byRank = (rank: number) =>
  BASE_STREETS.map((s, i) => (s.rank === rank ? i : -1)).filter((i) => i >= 0)
const spines = byRank(RANK_SPINE)
const branches = byRank(RANK_BRANCH)
const spurs = byRank(RANK_SPUR)
// Every road that gives way to something: all of them but the spine.
const subordinate = [...branches, ...spurs]

const at = (i: number) => lines[i] as Centreline
const rankOf = (i: number) => BASE_STREETS[i].rank!
// A road's unit direction, end to end, which is its bearing everywhere because
// every road on this plan is straight.
const headingOf = (line: Centreline) => {
  const a = line.plan[0]
  const b = line.plan[line.plan.length - 1]
  return new THREE.Vector2(b.x - a.x, b.y - a.y).normalize()
}
// Where a point is along the spine, which is still the coordinate that orders
// the whole plan even though nothing but the pads stands on it.
const alongOf = (p: { east: number; north: number }) => spineCoords(p).alongM
const whereOf = (p: { east: number; north: number }) =>
  `along ${spineCoords(p).alongM.toFixed(1)} m`

// The district a road serves, which is also what decides where it starts.
const districtOf = (streetIdx: number): SitePlan => {
  const serves = BASE_STREETS[streetIdx].serves as ProjectType[]
  return BASE_PLAN[serves[0]]!
}

// The road a given road is supposed to join: the spine for a branch, its own
// parent branch for a spur.
const parentOf = (streetIdx: number): number => {
  if (rankOf(streetIdx) === RANK_BRANCH) return spines[0]
  const serves = BASE_STREETS[streetIdx].serves![0]
  return branches.find((b) => BASE_STREETS[b].serves?.includes(serves))!
}
// The roads that hang off a given one, which is the other half of how many
// junctions it is entitled to.
const childrenOf = (streetIdx: number): number[] =>
  subordinate.filter((i) => parentOf(i) === streetIdx)
// The one junction where a road gives way, as against the ones it carries for
// the roads hanging off it.
const parentJunction = (streetIdx: number) =>
  junctions.find(
    (j) => j.clear.has(streetIdx) && j.clear.has(parentOf(streetIdx))
  )!

describe('moon base zero road junctions', () => {
  describe('the crossings themselves', () => {
    it('joins every road to the one above it, exactly once each', () => {
      // One spine, a branch per district, a spur off some of those — a tree. So
      // every road but the spine joins exactly one road ABOVE it, there are as
      // many junctions as there are roads that give way, and the junctions on
      // any one road are its own plus one per road hanging off it.
      //
      // The count is asserted whole rather than only per-road because the
      // failure this exists to catch is a junction that stops being FOUND. A
      // plan change that moved a road a meter off the one it joins would drop
      // one silently, and a dropped junction is a wall of rubble through a
      // junction.
      expect(spines, 'exactly one through route').to.have.length(1)
      expect(branches.length, 'a branch per district that has one').to.equal(
        Object.values(BASE_PLAN).filter((p) => !!p?.branch).length
      )
      expect(junctions).to.have.length(subordinate.length)
      for (const i of BASE_STREETS.keys()) {
        const own = rankOf(i) === RANK_SPINE ? 0 : 1
        expect(junctionsOn(junctions, i), `street ${i}`).to.have.length(
          own + childrenOf(i).length
        )
      }
      expect(
        junctionsOn(junctions, spines[0]),
        'the spine takes every branch'
      ).to.have.length(branches.length)
    })

    it('joins each road to its own parent and to nothing else', () => {
      // A branch meets the spine; a spur meets the branch it hangs off. What
      // must never appear is a junction between two roads that have no business
      // meeting — two branches, or a spur and somebody else's branch. Those
      // would be false positives out of the search window rather than roads on
      // this plan, and the plan is checked to keep unrelated roads 14 m apart
      // precisely so they cannot arise.
      for (const j of junctions) {
        const pair = [...j.clear.keys()]
        expect(pair, 'a junction joins exactly two roads').to.have.length(2)
        const gives = pair.find((i) => i !== j.through)!
        expect(
          parentOf(gives),
          `street ${gives} meets a road that is not its parent at ${whereOf(j)}`
        ).to.equal(pair.find((i) => i !== gives))
      }
    })

    it('puts each junction at the first station of the road that gives way', () => {
      // Where the plan says, and at the START of the giving-way road rather than
      // partway along it: that is what a T is, and it is what distinguishes this
      // plan from the one where a branch straddled the spine at its midpoint.
      //
      // Located off the rendered centrelines rather than from the plan's own
      // numbers, so this is the check that the two agree — to a tenth of a meter,
      // on roads whose spoil is swept back by nine.
      for (const i of subordinate) {
        const j = parentJunction(i)
        const m = { x: j.east, y: j.north }
        const line = at(i)
        const start = line.plan[0]
        expect(
          Math.hypot(start.x - m.x, start.y - m.y),
          `street ${i} joins away from its own start`
        ).to.be.lessThan(0.1)

        if (rankOf(i) === RANK_BRANCH) {
          // On the spine, at its district's own crossing.
          const plan = districtOf(i)
          expect(
            alongOf({ east: m.x, north: m.y }),
            `street ${i} leaves the spine at its district`
          ).to.be.closeTo(districtAlongM(plan), 0.1)
          expect(
            spineCoords({ east: m.x, north: m.y }).acrossM,
            `street ${i} leaves the spine off the spine`
          ).to.be.closeTo(0, 0.1)
        } else {
          // On its parent branch, `atM` out from the crossing.
          const plan = districtOf(i)
          const spur = districtRoads(plan)[1]
          expect(
            Math.hypot(spur.from.east - m.x, spur.from.north - m.y),
            `street ${i} leaves its branch away from atM`
          ).to.be.lessThan(0.1)
        }

        // And the whole rest of the road is clear of its parent: a road that
        // wandered back toward the one it left would make a second junction with
        // it, or worse, run alongside it inside its windrow.
        const parent = at(parentOf(i))
        const far = line.plan[line.plan.length - 1]
        expect(
          distToCentreline(far, parent),
          `street ${i} ends back on its parent`
        ).to.be.greaterThan(parent.toeHalfM)
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

    it('sweeps each road back for the other road width and the angle between them', () => {
      // Two things set the sweep, and both are the OTHER road's business rather
      // than this one's.
      //
      // Its width, first: a rover-width branch does not need the spine swept as
      // far back as a haul road does, and the spine's own width is what the
      // branch has to clear either way. Getting that backwards is invisible on
      // screen and leaves the narrow junctions over-graded and the wide ones
      // under. The plan runs three widths now — haul, rover and spur — so it
      // really does differ from crossing to crossing.
      //
      // And the angle they meet at, which only started to matter when the
      // branches stopped leaving the spine square. A road crossing another's
      // graded width SQUARELY is inside it for that width; at an angle it is
      // inside it for width/sin, and construction's branch leaves at 35 degrees,
      // so it lies in the spine's windrow for 11 m of its own length where the
      // flat fillet sweeps 8.6. That last 2 m had a windrow standing on the
      // spine's shoulder — which is what the check above catches, and this is
      // the check that says the fix is the angle and not a bigger constant.
      for (const j of junctions) {
        const [x, y] = [...j.clear.keys()]
        // Both roads are straight, so their end-to-end bearings are their
        // tangents at the crossing.
        const sin = Math.abs(headingOf(at(x)).cross(headingOf(at(y))))
        const want = (other: Centreline) =>
          Math.max(
            other.bedHalfM + JUNCTION_FILLET_M,
            other.toeHalfM / sin + JUNCTION_SHALLOW_MARGIN_M
          )
        expect(j.clear.get(x), `sweep on street ${x} at ${whereOf(j)}`).to.be.closeTo(
          want(at(y)),
          1e-9
        )
        expect(j.clear.get(y), `sweep on street ${y} at ${whereOf(j)}`).to.be.closeTo(
          want(at(x)),
          1e-9
          )
      }
      // And the angle term is not a dead branch of the formula: on this plan
      // some junctions are oblique enough that it is the binding one.
      const oblique = junctions.filter((j) => {
        const [x, y] = [...j.clear.keys()]
        const sin = Math.abs(headingOf(at(x)).cross(headingOf(at(y))))
        return at(x).toeHalfM / sin + JUNCTION_SHALLOW_MARGIN_M >
          at(x).bedHalfM + JUNCTION_FILLET_M
      })
      expect(
        oblique.length,
        'the angle term binds at some junction, or this is untested'
      ).to.be.above(0)
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
      for (const i of subordinate) {
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
    it('carries a bed through the junction a road STARTS on', () => {
      // An open end fades a road's bed out over the first few meters so it stops
      // instead of dissolving. At a junction that is exactly wrong — it would put
      // a notch in the surface at the one point the two roads are supposed to
      // become one.
      //
      // This matters far more than it used to. On the plan before this, a branch
      // crossed the spine at its own midpoint, so the fade and the junction were
      // half a branch apart and this check was nearly free. Now every road but
      // the spine BEGINS on the road it joins, so the fade and the junction are
      // at the same station and `junctionBedCover` is the only thing holding the
      // surface together there.
      for (const i of subordinate) {
        const meets = junctionsOn(junctions, i)
        const m = parentJunction(i)
        expect(
          junctionBedCover(m.east, m.north, meets),
          `street ${i} fades into the junction it starts on`
        ).to.be.above(0.99)
        // And its own first station too, which is the one the fade is measured
        // from and where a notch would actually appear.
        const start = at(i).plan[0]
        expect(
          junctionBedCover(start.x, start.y, meets),
          `street ${i} fades at its own start`
        ).to.be.above(0.99)
      }
    })

    it('still lets a road stop at the dead end it finishes on', () => {
      // The corollary, and the reason the check above is not simply "cover
      // everything": a road has one open end now — the turning circle at its
      // far end — and that one has to fade, or the pavement stops at a hard
      // sawn-off edge in open regolith.
      //
      // One end, where the previous plan's branches had two. That is the whole
      // difference between a road that crosses something and a road that goes
      // somewhere.
      for (const i of subordinate) {
        const line = at(i)
        const end = line.plan[line.plan.length - 1]
        expect(
          junctionBedCover(end.x, end.y, junctionsOn(junctions, i)),
          `street ${i} dead end`
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

    it('hands every junction to the higher tier', () => {
      // The spine carries its junctions with the branches; a branch carries its
      // junction with its own spur. Asserted as the RANK winning, not merely as
      // one of the two winning, because neither of the obvious fallbacks can
      // decide these on its own:
      //
      //   - Three branches are full haul width, so "the wider road wins" cannot
      //     pick the spine out of a spine-and-branch pair.
      //   - A 0.55-width spur off a 0.72-width branch does break that way, but a
      //     spur off a full-width branch does not, and the widths are free to
      //     change — they are a visual hierarchy, not a structural one.
      //
      // Without the rank both fall through to "whichever road BASE_STREETS
      // listed first", which is a correct answer for exactly as long as nobody
      // reorders it.
      for (const j of junctions) {
        const pair = [...j.clear.keys()]
        expect(pair, `junction at ${whereOf(j)}`).to.include(j.through)
        const gives = pair.find((i) => i !== j.through)!
        expect(
          rankOf(j.through),
          `junction at ${whereOf(j)} is carried by the higher tier`
        ).to.be.greaterThan(rankOf(gives))
      }
      // Which, on this plan, means the spine takes every one of its own and each
      // spur gives way to the branch it hangs off.
      for (const i of subordinate) {
        expect(
          parentJunction(i).through,
          `street ${i} against its parent`
        ).to.equal(parentOf(i))
      }
    })

    it('never breaks a road for something below it', () => {
      // The corollary, and the reason the higher tier wins: the spine is the one
      // road that runs the length of the settlement, and cutting it at all seven
      // of its junctions so a branch could lie across it is the same artefact the
      // other way round. The same argument holds one tier down — a branch is the
      // only road out to its district, and breaking it for a driveway is worse
      // than breaking the driveway.
      for (const i of spines) {
        expect(cutsOf(i), `spine ${i} is cut`).to.have.length(0)
      }
      for (const i of branches) {
        for (const cut of cutsOf(i)) {
          expect(
            cut.line.rank,
            `branch ${i} gives way to something at or below its own tier`
          ).to.be.greaterThan(RANK_BRANCH)
        }
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
      //
      // Asserted against the merge the CUT actually uses rather than against
      // the bare constant, because the gap it has to fit into scales with the
      // road's width and so must the merge. The plan runs three widths now, and
      // an absolute 1.1 m merge fits inside a full-width road's gap of 1.5 m and
      // overruns a 0.72-width branch's gap of 1.1 m — which is the halo, on the
      // three junctions where a spur meets a narrowed branch.
      for (const j of junctions) {
        const through = at(j.through)
        const gives = [...j.clear.keys()].find((i) => i !== j.through)!
        const [cut] = cutsOf(gives)
        expect(
          cut.halfM + cut.mergeM,
          `merge into street ${j.through}`
        ).to.be.lessThan(SPOIL_OPAQUE_OFF_M * through.widthScale * 0.97)
      }
    })

    it('cuts a road only where it actually meets its parent', () => {
      // Each road joins exactly one other, so it gives way in exactly one place
      // and keeps the whole rest of itself. This is the check that the cut is
      // LOCAL: on the concentric plan an avenue gave way twice and the two
      // corridors were most of a short avenue's length, so a cut that leaked was
      // hard to see. Here every road has a long clear run past its junction and
      // a leak shows up immediately.
      for (const i of subordinate) {
        const cuts = cutsOf(i)
        expect(cuts, `street ${i} gives way once`).to.have.length(1)
        expect(cuts[0].line, `street ${i} gives way to its parent`).to.equal(
          at(parentOf(i))
        )
      }
    })

    it('gives the giving-way road all of its own surface back', () => {
      // Which is what stops every check above being satisfied by simply not
      // drawing the branches at all. A road gives way over its parent's own
      // corridor and over NOTHING else: every station clear of it is at full
      // strength, which bounds the cut from above as tightly as the checks above
      // bound it from below. Asserted station by station rather than as a
      // fraction of the road, because the roads run from 32 m to 152 m and a
      // fraction that passes for the comms branch says nothing about a spur.
      for (const i of subordinate) {
        const cuts = cutsOf(i)
        let clear = 0
        for (const p of at(i).plan) {
          const inside = cuts.some(
            (c) => distToCentreline(p, c.line) < c.halfM + c.mergeM
          )
          if (inside) continue
          clear++
          expect(
            junctionBedCut(p.x, p.y, cuts),
            `street ${i} withheld at ${p.x.toFixed(1)}, ${p.y.toFixed(1)}`
          ).to.equal(1)
        }
        // The overwhelming majority of it, not merely some: the junction is at
        // one end now, so a "runs clear somewhere" check would pass a road that
        // gave way over most of its length. The cut corridor is a couple of
        // meters of a road tens of meters long.
        expect(
          clear / at(i).plan.length,
          `street ${i} keeps its own surface`
        ).to.be.above(0.8)
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
      // The plan runs three widths — haul, rover and spur — and the lane, the
      // windrow's toe and the merge all have to shrink together: a road whose
      // lane narrowed but whose spoil did not would have its own rubble standing
      // on its driving surface, everywhere, not just at a junction.
      for (const i of subordinate) {
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
