/**
 * Where the roads of Moon Base Zero meet each other (headless, mocha + chai).
 *
 * This is the half of the road network that nothing on screen will tell you has
 * broken, in the specific sense that when it IS broken it still looks like
 * scenery. A road's windrow of pushed-aside rock is built by sweeping a
 * cross-section along a centreline, which is a job each street can do alone —
 * and done alone, Main Avenue drives a half-meter wall of rubble and a line of
 * boulders straight through every cross street it meets. That shipped once,
 * because a junction full of rock reads as a junction full of rock rather than
 * as a bug.
 *
 * So the invariants are asserted here instead: a junction is found wherever two
 * roads meet and nowhere else; no road carries any windrow at all across another
 * road's graded width; the higher road carries every crossing; and the windrow
 * comes back between the crossings, because a network that swept itself flat
 * everywhere would pass every check above and have no edges left.
 *
 * The plan is a grid, so it has both shapes of junction at once: Ts, where a
 * cross street ends on an avenue, and full crossings, where one runs on through
 * Main Avenue. The junction search needs no edit for either, which is the point
 * of locating crossings by distance minimum rather than by segment
 * intersection — and segment intersection is therefore what this file checks
 * it against, as an oracle that shares none of its code.
 */

import { expect } from 'chai'
import * as THREE from 'three'
import {
  BASE_STREETS,
  RANK_MAIN,
  RANK_STREET,
  ROAD_HALF_M,
  spineCoords,
  type Street,
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

const lines = BASE_STREETS.map(centreline)
const junctions = findJunctions(lines)

const at = (i: number) => lines[i] as Centreline
const rankOf = (i: number) => BASE_STREETS[i].rank!
const streets = [...BASE_STREETS.keys()]
const spines = streets.filter((i) => rankOf(i) === RANK_MAIN)
// A road's unit direction, end to end, which is its bearing everywhere because
// every road on this plan is straight.
const headingOf = (line: Centreline) => {
  const a = line.plan[0]
  const b = line.plan[line.plan.length - 1]
  return new THREE.Vector2(b.x - a.x, b.y - a.y).normalize()
}
const whereOf = (p: { east: number; north: number }) => {
  const c = spineCoords(p)
  return `along ${c.alongM.toFixed(1)} m, across ${c.acrossM.toFixed(1)} m`
}

// Where two streets' segments touch, straight from the plan's own waypoints.
// Every road here is one straight segment, so this is exact: a proper
// crossing, or one road's end lying on the other (a T).
type Meet = { a: number; b: number; east: number; north: number }
function meetOf(a: number, b: number): Meet | null {
  const [p, q] = BASE_STREETS[a].points
  const [r, s] = BASE_STREETS[b].points
  const d1 = [q[0] - p[0], q[1] - p[1]]
  const d2 = [s[0] - r[0], s[1] - r[1]]
  const den = d1[0] * d2[1] - d1[1] * d2[0]
  if (Math.abs(den) < 1e-9) return null
  const t = ((r[0] - p[0]) * d2[1] - (r[1] - p[1]) * d2[0]) / den
  const u = ((r[0] - p[0]) * d1[1] - (r[1] - p[1]) * d1[0]) / den
  const eps = 1e-6
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return null
  return { a, b, east: p[0] + d1[0] * t, north: p[1] + d1[1] * t }
}
const meets: Meet[] = []
for (let a = 0; a < BASE_STREETS.length; a++) {
  for (let b = a + 1; b < BASE_STREETS.length; b++) {
    const m = meetOf(a, b)
    if (m) meets.push(m)
  }
}
// Every road that gives way somewhere.
const subordinate = streets.filter((i) =>
  junctions.some((j) => j.clear.has(i) && j.through !== i)
)

describe('moon base zero road junctions', () => {
  describe('the crossings themselves', () => {
    it('finds a junction wherever two roads meet, and nowhere else', () => {
      // The count is asserted whole as well as per junction, because the
      // failure this exists to catch is a junction that stops being FOUND. A
      // plan change that moved a road a meter off the one it joins would drop
      // one silently, and a dropped junction is a wall of rubble through a
      // junction.
      expect(meets.length, 'the grid has crossings at all').to.be.at.least(12)
      expect(junctions, 'one junction per meeting').to.have.length(meets.length)
      for (const m of meets) {
        const j = junctions.find((x) => x.clear.has(m.a) && x.clear.has(m.b))
        expect(j, `streets ${m.a} and ${m.b} at ${whereOf(m)}`).to.exist
        // Located off the rendered centrelines rather than from the plan's own
        // numbers, so this is the check that the two agree — to a tenth of a
        // meter, on roads whose spoil is swept back by nine.
        expect(
          Math.hypot(j!.east - m.east, j!.north - m.north),
          `junction of ${m.a} and ${m.b} found away from where they meet`
        ).to.be.lessThan(0.1)
      }
      for (const j of junctions) {
        expect([...j.clear.keys()], 'a junction joins exactly two roads').to.have.length(2)
      }
    })

    it('has both Ts and crossings, all of them square', () => {
      // The grid's own claim about itself: a cross street either ends on an
      // avenue or runs on through Main Avenue, and nothing meets at an angle.
      const isEnd = (i: number, m: Meet) =>
        BASE_STREETS[i].points.some(
          ([e, n]) => Math.hypot(e - m.east, n - m.north) < 1e-6
        )
      const ts = meets.filter((m) => isEnd(m.a, m) || isEnd(m.b, m))
      const crossings = meets.filter((m) => !isEnd(m.a, m) && !isEnd(m.b, m))
      expect(ts.length, 'Ts').to.be.above(0)
      expect(crossings.length, 'crossings').to.be.above(0)
      for (const m of meets) {
        expect(
          Math.abs(headingOf(at(m.a)).cross(headingOf(at(m.b)))),
          `streets ${m.a} and ${m.b} meet square`
        ).to.be.closeTo(1, 1e-9)
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
        const on = junctionsOn(junctions, a)
        for (const b of BASE_STREETS.keys()) {
          if (a === b) continue
          const lb = at(b)
          for (const p of la.plan) {
            if (distToCentreline(p, lb) > lb.toeHalfM) continue
            expect(
              junctionBermLevel(p.x, p.y, on),
              `street ${a} keeps spoil on street ${b} at ${p.x.toFixed(1)}, ${p.y.toFixed(1)}`
            ).to.equal(0)
          }
        }
      }
    })

    it('sweeps each road back for the other road width and the angle between them', () => {
      // Two things set the sweep, and both are the OTHER road's business rather
      // than this one's: its width, because a narrow cross street does not need
      // Main Avenue swept as far back as a haul road does; and the angle they
      // meet at, because a road crossing another's graded width at an angle is
      // inside it for width/sin rather than width.
      const want = (other: Centreline, sin: number) =>
        Math.max(
          other.bedHalfM + JUNCTION_FILLET_M,
          other.toeHalfM / sin + JUNCTION_SHALLOW_MARGIN_M
        )
      for (const j of junctions) {
        const [x, y] = [...j.clear.keys()]
        const sin = Math.abs(headingOf(at(x)).cross(headingOf(at(y))))
        expect(j.clear.get(x), `sweep on street ${x} at ${whereOf(j)}`).to.be.closeTo(
          want(at(y), sin),
          1e-9
        )
        expect(j.clear.get(y), `sweep on street ${y} at ${whereOf(j)}`).to.be.closeTo(
          want(at(x), sin),
          1e-9
        )
      }
      // Every junction on the grid is square, so the angle term binds nowhere
      // on the plan. It is exercised here on a pair of roads built for it, at
      // the 35 degrees a branch once left the spine at, rather than left as a
      // branch of the formula nothing tests.
      const oblique: Street[] = [
        { points: [[-60, 0], [60, 0]], rank: RANK_MAIN },
        {
          points: [
            [0, 0],
            [80 * Math.cos((35 * Math.PI) / 180), 80 * Math.sin((35 * Math.PI) / 180)],
          ],
          rank: RANK_STREET,
        },
      ]
      const olines = oblique.map(centreline) as Centreline[]
      const [oj] = findJunctions(olines)
      const sin = Math.sin((35 * Math.PI) / 180)
      expect(oj, 'the oblique pair meets').to.exist
      expect(
        olines[0].toeHalfM / sin + JUNCTION_SHALLOW_MARGIN_M,
        'the angle term binds at 35 degrees'
      ).to.be.greaterThan(olines[0].bedHalfM + JUNCTION_FILLET_M)
      expect(oj.clear.get(1), 'swept for the angle').to.be.closeTo(
        want(olines[0], sin),
        1e-6
      )
    })
  })

  describe('the windrow everywhere else', () => {
    it('gives every road its edge back between the crossings', () => {
      // The one check that stops all of the above being satisfied by a network
      // with no windrows on it anywhere. Main Avenue takes the most crossings,
      // so it is the road with the least edge left; if it still carries one
      // over most of its length, nothing else on the plan is over-graded either.
      for (const i of spines) {
        const levels = at(i).plan.map((p) =>
          junctionBermLevel(p.x, p.y, junctionsOn(junctions, i))
        )
        const full = levels.filter((l) => l > 0.999).length
        expect(full / levels.length, `Main Avenue ${i} at full windrow`).to.be.above(0.4)
      }
      for (const i of BASE_STREETS.keys()) {
        const levels = at(i).plan.map((p) =>
          junctionBermLevel(p.x, p.y, junctionsOn(junctions, i))
        )
        expect(Math.max(...levels), `street ${i} has some windrow somewhere`).to.equal(1)
      }
    })
  })

  describe('the bed through a crossing', () => {
    it('carries a bed through every junction on both roads', () => {
      // An open end fades a road's bed out over the first few meters so it stops
      // instead of dissolving. At a junction that is exactly wrong — it would put
      // a notch in the surface at the one point the two roads are supposed to
      // become one. Every T on the grid is a road ENDING on another, so the fade
      // and the junction are at the same station and `junctionBedCover` is the
      // only thing holding the surface together there.
      for (const j of junctions) {
        for (const i of j.clear.keys()) {
          expect(
            junctionBedCover(j.east, j.north, junctionsOn(junctions, i)),
            `street ${i} fades into the junction at ${whereOf(j)}`
          ).to.be.above(0.99)
        }
      }
      // And a road's own end station, wherever that end is on a junction —
      // the one the fade is measured from and where a notch would appear.
      for (const i of BASE_STREETS.keys()) {
        const on = junctionsOn(junctions, i)
        for (const end of [at(i).plan[0], at(i).plan[at(i).plan.length - 1]]) {
          if (!on.some((j) => Math.hypot(j.x - end.x, j.y - end.y) < 0.1)) continue
          expect(
            junctionBedCover(end.x, end.y, on),
            `street ${i} fades at its end on a junction`
          ).to.be.above(0.99)
        }
      }
    })

    it('still lets a road stop at an open end', () => {
      // The corollary, and the reason the check above is not simply "cover
      // everything": an end that stands on no other road — Main Avenue at
      // either end of town, an avenue's stub past its last block, the
      // launcher's drive — has to fade, or the pavement stops at a hard sawn-off
      // edge in open regolith.
      let open = 0
      for (const i of BASE_STREETS.keys()) {
        const line = at(i)
        for (const end of [line.plan[0], line.plan[line.plan.length - 1]]) {
          const onAnother = [...BASE_STREETS.keys()].some(
            (k) => k !== i && distToCentreline(end, at(k)) < 1
          )
          if (onAnother) continue
          open++
          expect(
            junctionBedCover(end.x, end.y, junctionsOn(junctions, i)),
            `street ${i} open end at ${whereOf({ east: end.x, north: end.y })}`
          ).to.equal(0)
        }
      }
      expect(open, 'the plan has open ends to fade').to.be.at.least(4)
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
      // Main Avenue carries its crossings; an avenue carries the cross streets
      // that end on it. Asserted as the RANK winning, not merely as one of the
      // two winning, because "the wider road wins" cannot pick Main Avenue out
      // of a crossing with a full-width avenue, and without the rank it falls
      // through to "whichever road BASE_STREETS listed first" — a correct
      // answer for exactly as long as nobody reorders it.
      for (const j of junctions) {
        const pair = [...j.clear.keys()]
        expect(pair, `junction at ${whereOf(j)}`).to.include(j.through)
        const gives = pair.find((i) => i !== j.through)!
        expect(
          rankOf(j.through),
          `junction at ${whereOf(j)} is carried by the higher tier`
        ).to.be.greaterThan(rankOf(gives))
      }
    })

    it('never breaks a road for something below it', () => {
      // The corollary, and the reason the higher tier wins: Main Avenue is the
      // one road that runs the length of the settlement, and cutting it at every
      // crossing so a cross street could lie across it is the same artefact the
      // other way round.
      for (const i of spines) {
        expect(cutsOf(i), `Main Avenue ${i} is cut`).to.have.length(0)
      }
      for (const i of BASE_STREETS.keys()) {
        for (const cut of cutsOf(i)) {
          expect(
            cut.line.rank,
            `street ${i} gives way to something at or below its own tier`
          ).to.be.greaterThan(rankOf(i))
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
      for (const j of junctions) {
        const through = at(j.through)
        const gives = [...j.clear.keys()].find((i) => i !== j.through)!
        const cut = cutsOf(gives).find((c) => c.line === through)!
        expect(cut, `street ${gives} gives way to street ${j.through}`).to.exist
        expect(
          cut.halfM + cut.mergeM,
          `merge into street ${j.through}`
        ).to.be.lessThan(SPOIL_OPAQUE_OFF_M * through.widthScale * 0.97)
      }
    })

    it('cuts a road only where it actually meets a higher one', () => {
      // A cross street gives way at every avenue it meets, and nowhere else.
      // This is the check that the cut is LOCAL: one cut per junction the road
      // gives way at, each to the road that carries it.
      for (const i of BASE_STREETS.keys()) {
        const givesAt = junctions.filter((j) => j.clear.has(i) && j.through !== i)
        const cuts = cutsOf(i)
        expect(cuts, `street ${i} cuts`).to.have.length(givesAt.length)
        expect(
          cuts.map((c) => c.line),
          `street ${i} gives way to the roads that carry it`
        ).to.have.members(givesAt.map((j) => at(j.through)))
      }
    })

    it('gives the giving-way road all of its own surface back', () => {
      // Which is what stops every check above being satisfied by simply not
      // drawing the cross streets at all. A road gives way over the corridors
      // of the roads that carry it and over NOTHING else: every station clear
      // of them is at full strength. Asserted station by station rather than as
      // a fraction of the road alone, because the roads run from 60 m to 730 m
      // and a fraction that passes for Main Avenue says nothing about a drive.
      expect(subordinate.length, 'some roads give way').to.be.above(0)
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
        // The overwhelming majority of it, not merely some: the cut corridors
        // are a few meters each on roads tens of meters long.
        expect(clear / at(i).plan.length, `street ${i} keeps its own surface`).to.be.above(
          0.8
        )
      }
    })
  })

  describe('the cross-section these are measured against', () => {
    it('nests the lane inside the spoil inside the plan own half-width', () => {
      // ROAD_HALF_M is what every plot on the base keeps its setback from, so a
      // profile that quietly reached past it would eat the setback on every
      // district at once.
      expect(BED_HALF_M).to.be.lessThan(SPOIL_TOE_OFF_M)
      expect(SPOIL_TOE_OFF_M).to.be.lessThan(ROAD_HALF_M)
    })

    it('scales the whole cross-section together for a narrow road', () => {
      // The plan runs three widths — avenue, cross street and drive — and the
      // lane, the windrow's toe and the merge all have to shrink together: a
      // road whose lane narrowed but whose spoil did not would have its own
      // rubble standing on its driving surface, everywhere, not just at a
      // junction.
      for (const i of BASE_STREETS.keys()) {
        const line = at(i)
        expect(line.bedHalfM, `street ${i} lane`).to.be.closeTo(
          BED_HALF_M * line.widthScale,
          1e-9
        )
        expect(line.toeHalfM, `street ${i} toe`).to.be.closeTo(
          ROAD_HALF_M * line.widthScale,
          1e-9
        )
        expect(line.bedHalfM, `street ${i} lane inside its own toe`).to.be.lessThan(
          line.toeHalfM
        )
      }
    })
  })
})
