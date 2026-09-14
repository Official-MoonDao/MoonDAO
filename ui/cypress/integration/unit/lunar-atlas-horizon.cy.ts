/**
 * Moon Base Zero — skyline and sky visibility (headless, mocha + chai).
 *
 * The horizon field decides which 57% of the patch is in shadow once the sun comes
 * down to its real elevation, and it does so from an amortized-linear recurrence
 * over a DDA-quantised line with a change of variables folded in for the Moon's
 * curvature. Every one of those words is a place to be quietly wrong by a degree,
 * and a degree is half the real sun's elevation.
 *
 * It is also the kind of wrong that does not look like a bug. The first version of
 * this module marched each point over a max-pooled mip pyramid and was off by 1.9°
 * on average with a 10° worst case; it rendered plausible-looking shadows in
 * plausible-looking places. What caught it was a comparison against a stupider
 * implementation, so that comparison is the centre of this file rather than an
 * afterthought.
 */
import { expect } from 'chai'
import {
  HORIZON_AZIMUTHS,
  HORIZON_SIZE,
  SWEEP_SIZE,
  bruteForceHorizonTan,
  buildHorizonField,
} from '../../../lib/lunar-atlas/horizon'
import { MOON_RADIUS_M } from '../../../lib/lunar-atlas/geo'
import { CAP_EXTENT_M, type PolarHeightField } from '../../../lib/lunar-atlas/southpole'

const RAD2DEG = 180 / Math.PI
const SWEEP_CELL_M = CAP_EXTENT_M / SWEEP_SIZE
const OUT_RATIO = SWEEP_SIZE / HORIZON_SIZE

// Height fields are quoted in meters and encoded the way the baked PNG encodes
// them, so the tests exercise the same raw-to-meters path the renderer does.
const MIN_M = 0
const MAX_M = 2000

function fieldFrom(size: number, meters: (x: number, y: number) => number): PolarHeightField {
  const data = new Uint16Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const raw = Math.round(((meters(x, y) - MIN_M) / (MAX_M - MIN_M)) * 65535)
      data[y * size + x] = Math.max(0, Math.min(65535, raw))
    }
  }
  return { size, minM: MIN_M, maxM: MAX_M, data }
}

// A field at exactly the sweep resolution, so a test can name a sweep cell without
// reasoning about the max-pool downsample at the same time.
function sweepResField(meters: (cx: number, cy: number) => number): PolarHeightField {
  return fieldFrom(SWEEP_SIZE, meters)
}

const horizonDeg = (tan: number) => Math.atan(tan) * RAD2DEG

function outputTan(
  hz: { horizonTan: Float32Array },
  hx: number,
  hy: number,
  azimuth: number
): number {
  return hz.horizonTan[(hy * HORIZON_SIZE + hx) * HORIZON_AZIMUTHS + azimuth]
}

// Azimuth bin 0 points along map +X, which is image right. Bin 4 is map north,
// which is DECREASING row index. Several tests below depend on that and would pass
// against a 180°-rotated field if they did not say so out loud.
const EAST = 0
const NORTH = HORIZON_AZIMUTHS / 4
const WEST = HORIZON_AZIMUTHS / 2
const SOUTH = (3 * HORIZON_AZIMUTHS) / 4

describe('lunar skyline: the reference implementation itself', () => {
  // Everything else in this file is checked against bruteForceHorizonTan, so if it
  // is wrong the whole suite is decorative. It gets its own analytic check first.
  //
  // This is not hypothetical. An earlier draft of that function used the ray
  // PARAMETER as the distance while nearest-neighbour rounding sampled a cell up to
  // half a step further out, which overstates the tangent by t/(t-0.5) — a factor of
  // two at the first cell. It reported skylines 1.7° too high and very nearly got
  // the correct sweep rewritten to agree with it.
  const WALL_X = 400
  const WALL_H = 500
  const wall = sweepResField((cx) => (cx === WALL_X ? WALL_H : 0))

  for (const cellX of [100, 200, 300, 380]) {
    const distM = (WALL_X - cellX) * SWEEP_CELL_M
    it(`matches the closed form for a wall ${(distM / 1000).toFixed(2)} km away`, () => {
      const drop = (distM * distM) / (2 * MOON_RADIUS_M)
      const exact = Math.atan((WALL_H - drop) / distM) * RAD2DEG
      const got = horizonDeg(bruteForceHorizonTan(wall, cellX, 256, EAST))
      expect(got).to.be.closeTo(exact, 0.005)
    })
  }

  it('includes the curvature of the Moon rather than assuming a flat plane', () => {
    // On a dead-level plain the skyline is BELOW the local horizontal, because the
    // sphere falls away as d^2/2R. It is a small number — 0.13° at the patch rim —
    // but it is a seventh of the real sun's elevation, so a flat-plane version of
    // this module would light ground that should be dark.
    const flat = sweepResField(() => 100)
    const tan = bruteForceHorizonTan(flat, 256, 256, EAST)
    expect(tan).to.be.lessThan(0)
    // The nearest cell wins, since the drop grows faster than the distance.
    const expected = -SWEEP_CELL_M / (2 * MOON_RADIUS_M)
    expect(tan).to.be.closeTo(expected, Math.abs(expected) * 0.02)
  })
})

describe('lunar skyline: the sweep against the reference', () => {
  // Terrain rough enough that the recurrence has a real convex hull to walk. A
  // smooth field would let a broken implementation pass by luck.
  let s = 1234
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
  const cells = 64
  const lattice = new Float32Array(cells * cells)
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand() * 900
  const rough = sweepResField(
    (cx, cy) =>
      lattice[(Math.floor((cy / SWEEP_SIZE) * cells) % cells) * cells + (Math.floor((cx / SWEEP_SIZE) * cells) % cells)]
  )
  const hz = buildHorizonField(rough)

  const probes: [number, number][] = [
    [64, 64],
    [100, 30],
    [30, 100],
    [200, 200],
    [128, 128],
  ]

  // The mean over the sweep cells inside one output texel, which is what the build
  // writes, so this compares like with like.
  function referenceFor(hx: number, hy: number, azimuth: number): number {
    let acc = 0
    for (let dy = 0; dy < OUT_RATIO; dy++) {
      for (let dx = 0; dx < OUT_RATIO; dx++) {
        acc += bruteForceHorizonTan(rough, hx * OUT_RATIO + dx, hy * OUT_RATIO + dy, azimuth)
      }
    }
    return acc / (OUT_RATIO * OUT_RATIO)
  }

  // Axis-aligned and exactly-diagonal directions quantise to nothing: the DDA line
  // IS the true ray. So on these the sweep has no excuse and must match the dumb
  // version to floating point. This is the assertion that would have caught the mip
  // pyramid, and it is tight on purpose.
  for (const [azimuth, name] of [
    [EAST, 'east'],
    [NORTH, 'north'],
    [WEST, 'west'],
    [SOUTH, 'south'],
    [2, 'north-east diagonal'],
    [6, 'north-west diagonal'],
  ] as [number, string][]) {
    it(`is exact looking ${name}, where the line is not quantised`, () => {
      for (const [hx, hy] of probes) {
        const got = horizonDeg(outputTan(hz, hx, hy, azimuth))
        const want = horizonDeg(referenceFor(hx, hy, azimuth))
        expect(got, `texel ${hx},${hy}`).to.be.closeTo(want, 1e-3)
      }
    })
  }

  it('stays within the DDA drift bound on off-axis directions', () => {
    // Off-axis lines wander up to half a cell sideways from the true ray, so they
    // sample slightly different ground. That is a real limitation of sweeping rather
    // than marching, and it is asserted rather than hidden so that a regression which
    // makes it WORSE is caught — and so nobody reads the exact cases above and
    // assumes this holds everywhere.
    //
    // The bound is generous because this test terrain is deliberately vicious: 900 m
    // of relief on a 250 m lattice, where half a cell sideways can be a different
    // cliff entirely. Real terrain is far smoother than this.
    for (const azimuth of [1, 3, 5, 7]) {
      for (const [hx, hy] of probes) {
        const got = horizonDeg(outputTan(hz, hx, hy, azimuth))
        const want = horizonDeg(referenceFor(hx, hy, azimuth))
        expect(Math.abs(got - want), `bin ${azimuth} at ${hx},${hy}`).to.be.lessThan(12)
      }
    }
  })
})

describe('lunar skyline: shape and sign', () => {
  const WALL_X = 400
  const WALL_H = 500
  const wall = sweepResField((cx) => (cx === WALL_X ? WALL_H : 0))
  const hz = buildHorizonField(wall)

  it('rises steadily as the obstacle gets closer', () => {
    // Monotonic in distance, which is the one property a reader can check by eye and
    // therefore the one worth pinning: nothing about the hull walk or the curvature
    // change of variables should be able to produce a bump.
    let prev = -Infinity
    for (let hx = 20; hx < WALL_X / OUT_RATIO - 4; hx += 10) {
      const tan = outputTan(hz, hx, 128, EAST)
      expect(tan, `texel ${hx} is nearer the wall than ${hx - 10}`).to.be.greaterThan(prev)
      prev = tan
    }
  })

  it('sees nothing looking away from the wall', () => {
    // West of the wall, looking west, is flat ground for kilometres. The skyline is
    // then slightly NEGATIVE from curvature, never positive.
    expect(outputTan(hz, 100, 128, WEST)).to.be.lessThan(0)
  })

  it('reports a skyline below horizontal when the ground falls away', () => {
    // The sign matters more than it looks. Ground that slopes away has a skyline
    // genuinely BELOW its own horizontal, so a sun at half a degree still reaches it.
    // Clamping these at zero — the natural thing to do if you think of a horizon as
    // an occluder — would put every slope into shadow at dawn.
    //
    // Probed on the flank rather than at the summit on purpose. An output texel is
    // the mean of four sweep cells, so the apex texel includes three cells that look
    // UP at the one containing the peak, and its skyline is legitimately positive.
    const cone = sweepResField((cx, cy) => {
      const r = Math.hypot(cx - 256, cy - 256)
      return Math.max(0, 300 - r * 3)
    })
    const peak = buildHorizonField(cone)
    const mid = HORIZON_SIZE / 2
    const onFlank = mid + 20 // 40 sweep cells out, well inside the 100-cell radius
    expect(outputTan(peak, onFlank, mid, EAST), 'downhill, away from the summit').to.be.lessThan(0)
    expect(outputTan(peak, onFlank, mid, WEST), 'uphill, toward the summit').to.be.greaterThan(0)
  })

  it('orients azimuth bins against the map frame, not the image', () => {
    // Row 0 of the height field is map NORTH, so a wall placed in low rows must be
    // found by the north bin. Getting this backwards flips every shadow 180°, which
    // no other test here would notice because the terrain would still be lit
    // plausibly — just from the wrong side.
    const ridgeNorth = sweepResField((_cx, cy) => (cy === 100 ? 500 : 0))
    const h = buildHorizonField(ridgeNorth)
    const mid = HORIZON_SIZE / 2
    expect(outputTan(h, mid, mid, NORTH), 'north bin must see it').to.be.greaterThan(0.02)
    expect(outputTan(h, mid, mid, SOUTH), 'south bin must not').to.be.lessThan(0)
  })
})

describe('lunar sky view factor', () => {
  it('is 1 on an open plain and never leaves (0, 1]', () => {
    const flat = sweepResField(() => 500)
    const hz = buildHorizonField(flat)
    for (const v of hz.skyView) {
      expect(v).to.be.greaterThan(0)
      expect(v).to.be.lessThan(1.0000001)
    }
    // A level skyline blocks nothing, and the curvature term only ever puts the
    // skyline BELOW horizontal, which the clamp discards. So this is exactly 1 — not
    // approximately. If it drifts, the clamp is gone and a hilltop is about to report
    // less sky than a plain.
    expect(hz.skyView[HORIZON_SIZE * 128 + 128]).to.equal(1)
  })

  it('closes down inside a bowl and opens up at its rim', () => {
    // A crater 4 km across and 400 m deep: walls above the floor's horizontal on
    // every side, nothing above the rim's.
    const crater = sweepResField((cx, cy) => {
      const r = Math.hypot(cx - 256, cy - 256) / 64
      return 1000 + (r < 1 ? -400 * (1 - r * r) : 0)
    })
    const hz = buildHorizonField(crater)
    const floor = hz.skyView[HORIZON_SIZE * 128 + 128]
    const outside = hz.skyView[HORIZON_SIZE * 128 + 20]
    expect(floor).to.be.lessThan(outside)
    expect(outside).to.be.closeTo(1, 0.02)
  })

  it('is the mean of cos^2 over the bins, which is what makes it cosine-weighted', () => {
    // Restated as an independent computation from the stored skyline, because the
    // formula is the part most likely to be quietly replaced with something that
    // "looks like an occlusion factor" — a mean of (1 - sin h), say, which is a
    // different and wrong integral.
    const ridge = sweepResField((cx) => (cx === 300 ? 800 : 400))
    const hz = buildHorizonField(ridge)
    for (const [hx, hy] of [
      [60, 60],
      [140, 100],
    ] as [number, number][]) {
      let acc = 0
      for (let a = 0; a < HORIZON_AZIMUTHS; a++) {
        const c = Math.cos(Math.atan(Math.max(0, outputTan(hz, hx, hy, a))))
        acc += c * c
      }
      expect(hz.skyView[hy * HORIZON_SIZE + hx]).to.be.closeTo(acc / HORIZON_AZIMUTHS, 1e-6)
    }
  })
})

describe('lunar skyline: field shape', () => {
  it('fills every texel and every azimuth', () => {
    // A sweep that missed lines would leave zeroes behind, and a zero is a perfectly
    // legal skyline value — it reads as "level" and shadows nothing — so a coverage
    // hole would show up as a stripe of wrongly-lit ground rather than as an error.
    const rough = sweepResField((cx, cy) => 500 + 200 * Math.sin(cx / 17) * Math.cos(cy / 23))
    const hz = buildHorizonField(rough)
    expect(hz.horizonTan.length).to.equal(HORIZON_SIZE * HORIZON_SIZE * HORIZON_AZIMUTHS)
    let exactlyZero = 0
    for (const v of hz.horizonTan) if (v === 0) exactlyZero++
    // The patch rim genuinely has nothing ahead of it in outward directions and is
    // recorded as level, so a handful of exact zeroes is expected; a stripe is not.
    expect(exactlyZero).to.be.lessThan(hz.horizonTan.length * 0.02)
  })

  it('downsamples the sweep grid by a whole number', () => {
    // The accumulate step divides by ratio^2 and indexes with a truncation, both of
    // which silently mis-weight the average if these ever stop dividing evenly.
    expect(SWEEP_SIZE % HORIZON_SIZE).to.equal(0)
  })
})
