// What each patch of ground can see of the sky, and of the terrain around it.
//
// This is the second thing derived from the height field at load rather than
// shipped (the first is the normal field in southpole.ts), and it answers the two
// questions the BRDF cannot: is this point in the shadow of terrain kilometres
// away, and how much sky is open above it. Payload cost is zero — the heights are
// already downloaded — so the whole cost is compute and a few MB of GPU memory.
//
// WHY A HORIZON MAP RATHER THAN A SHADOW MAP. A shadow map lit by a 2° sun across
// a 16 km patch is the worst case that technique has: the light frustum is 16 km
// long and metres deep, depth precision collapses along the grazing axis, and the
// terrain would have to render itself into it finely enough to resolve a ridge
// 8 km away. A horizon map inverts the problem. For each point it precomputes the
// elevation angle of the skyline in a fixed set of compass directions, once, and
// then any sun position is one lookup and one compare: the sun is blocked exactly
// when it sits below the skyline in its own direction. O(1) per fragment for any
// sun, which is what makes a moving sun affordable at all.
//
// WHAT IT BUYS AT TODAY'S SUN: measured on the real DEM, nothing at all.
//
// Terrain only shadows itself where the skyline is higher than the sun, and this
// scene's sun sits at 45° for legibility (see SUN_MAP_EL_DEG) while the patch's
// skyline reaches 27° at its 99.9th percentile. So the shadowed fraction of the
// patch at the current sun is 0.00% — not "small", zero — and it goes to 57% at the
// ~1.8° the real sun never rises above:
//
//   sun elevation   45°     20°     10°      5°      2°    1.8°      1°
//   patch shadowed  0.00%   6.5%   27.5%   41.8%   56.1%   57.3%   62.5%
//
// That is the whole argument for this module and also the reason it is useless on
// its own. It is built before the sun that needs it because the other order does
// not work: dropping the sun to 2° without this would light 57% of the patch that
// should be black, which is a worse picture than the one we have now.
//
// The sky-visibility half was expected to pay off immediately and does not, which
// is worth writing down so nobody spends the effort again. Cosine-weighted open sky
// over this patch runs 0.92 at its darkest texel against a mean of 0.978, because
// terrain sampled every 62.5 m simply is not a shadowing environment. The occlusion
// a viewer would actually notice — the dark ring where a habitat meets the ground,
// the inside of a metre-wide craterlet — lives entirely below this map's resolution
// and has to come from somewhere else.
import { MOON_RADIUS_M } from './geo'
import { CAP_EXTENT_M, HEIGHT_EXAGGERATION, type PolarHeightField } from './southpole'

// Texels per side of the horizon field. 256 over 16 km is 62.5 m, which is what
// bounds how sharp a terrain shadow edge can be — the angle is interpolated
// between texels, so a terminator is smooth over roughly that distance rather
// than blocky. Near-field sharpness is the hardware shadow map's job; this is for
// the skyline.
export const HORIZON_SIZE = 256

// Compass directions sampled per texel. The horizon as a function of azimuth is
// smooth for real terrain and the shader tents between neighbouring bins, so 16
// (22.5° apart) resolves a ridge without resolving noise. It is also exactly four
// RGBA textures, which is what lets the shader read it without dynamically
// indexing a sampler — see the packing note in SouthPoleTerrain.
export const HORIZON_AZIMUTHS = 16

// Resolution the sweep runs at. 512 over 16 km is 31.25 m per cell, half the
// horizon field's own pitch, so four sweep cells average into each output texel
// and the sweep cannot miss structure the output could have represented.
export const SWEEP_SIZE = 512

export type HorizonField = {
  size: number
  azimuths: number
  // TANGENT of the skyline elevation, as [(y * size + x) * azimuths + a].
  //
  // Tangent rather than the angle because that is the form the comparison wants:
  // a point is lit when tan(sun elevation) > this, and both sides are then a
  // height over a distance with no trig in the shader.
  //
  // Signed, and the sign carries real information: on a crest the skyline in the
  // downhill direction is BELOW local horizontal, so a sun at half a degree still
  // reaches it. Flooring these at zero would put every summit in shadow at dawn,
  // which is exactly backwards.
  horizonTan: Float32Array
  // Cosine-weighted fraction of the sky hemisphere that is open, per texel, in
  // (0, 1]. 1 is a plain under a level skyline; a crater floor is much lower.
  skyView: Float32Array
}

// Heights in METERS on the sweep grid, max-pooled down from the source field.
//
// MAX rather than mean, and only here: this feeds a visibility test, and averaging
// a ridge with the ground beside it shortens the ridge and lets the sun through a
// hill. Over-shadowing is the safe direction for a 3x downsample of adjacent
// cells; it is NOT safe over the huge footprints a mip pyramid would use, which is
// why there is no pyramid in this file any more (see the sweep below).
//
// Row order is inherited unchanged from the height field — row 0 at the +Y (map
// north) edge — because every other consumer of that field already agrees on it
// and a flip here would rotate every shadow 180° in a way no test of this module
// alone would catch.
function toSweepGrid(field: PolarHeightField): Float32Array {
  const { size, data, minM, maxM } = field
  const k = ((maxM - minM) / 65535) * HEIGHT_EXAGGERATION
  const out = new Float32Array(SWEEP_SIZE * SWEEP_SIZE)
  const ratio = size / SWEEP_SIZE

  for (let y = 0; y < SWEEP_SIZE; y++) {
    const y0 = Math.floor(y * ratio)
    const y1 = Math.max(y0 + 1, Math.min(size, Math.floor((y + 1) * ratio)))
    for (let x = 0; x < SWEEP_SIZE; x++) {
      const x0 = Math.floor(x * ratio)
      const x1 = Math.max(x0 + 1, Math.min(size, Math.floor((x + 1) * ratio)))
      let hi = -Infinity
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const v = data[yy * size + xx]
          if (v > hi) hi = v
        }
      }
      out[y * SWEEP_SIZE + x] = minM + hi * k
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// The sweep
//
// For one direction, the skyline for EVERY point on a line parallel to it is
// computed in one amortized-linear pass, rather than each point marching its own
// ray. That is the whole reason this is affordable and exact at once: a per-point
// march has to trade accuracy for step count, and the first version of this file
// did exactly that — geometric steps over a max-pooled mip pyramid — and came out
// with a mean error of 1.9° and a worst case of 10°. At a 2° sun an error that
// size is not an approximation, it is noise, so the approximation was replaced
// with the exact algorithm.
//
// THE ALGORITHM. Walking backwards along a line, the skyline seen from point i is
// either the next point ahead of it, or the skyline that point already found —
// never anything else. If the direct slope from i to i+1 is shallower than i+1's
// own skyline slope, then whatever i+1 can see, i can see higher, so the search
// jumps straight there instead of stepping. Each point stores where its own
// skyline was, which makes those jumps a chain along the terrain's upper convex
// hull, and the total number of jumps over a line is linear in its length.
//
// Measured against a continuous bilinear ray on the same grid, this agrees to
// 0.0002° along an unquantised line, so the recurrence itself is exact and the only
// error left is the DDA one below.
//
// DO NOT ADD A MINIMUM SEARCH DISTANCE. It is a tempting thing to reach for — the
// nearest cell dominates the answer on sloped ground, so skipping the first few
// looks like it would isolate the "real" skyline. It breaks the algorithm outright:
// the jump chain is only the upper convex hull if every point ahead is a candidate,
// and excluding the near ones invalidates the hull property. Tried, and it took the
// error from 0.0002° to 0.4° with a 2.1° worst case. The near field belongs here
// anyway; it is what the hardware shadow map cannot reach past.
//
// RESIDUAL ERROR. Lines are walked with integer DDA, so a line drifts up to half a
// cell sideways from the true ray and off-axis azimuths sample slightly different
// ground than they should. Axis-aligned and exactly-diagonal bins are unaffected
// (they quantise to nothing); the worst bins are the 22.5° ones. This is inherent to
// sweeping rather than marching, and it is the price of being exact in the other
// direction, where a per-point march was wrong by 1.9° on average.
//
// CURVATURE. The sphere falls away from the local tangent plane as d^2/2R — 18 m
// at the patch rim, which is 0.13° of skyline. Negligible against a 45° sun and a
// seventh of a 2° one, which is exactly the sun this map exists to serve. It is
// folded in by flattening the heights first: subtracting d^2/2R (with d measured
// from the line's start) makes the transformed slope differ from the true one by
// d_i/R, which is CONSTANT in the point being looked at. So it cannot change which
// point is the skyline, and it is added back once at the end.
// ---------------------------------------------------------------------------

// Scratch buffers, allocated once per build rather than per line.
type Scratch = {
  dist: Float64Array
  flat: Float64Array
  cell: Int32Array
  best: Float64Array
  jump: Int32Array
}

// Runs the skyline recurrence over one line's worth of samples, writing the
// tangent of the skyline elevation for each into `best`.
function sweepLine(n: number, s: Scratch): void {
  const { dist, flat, best, jump } = s
  if (n === 0) return

  // Nothing ahead of the last point inside the patch. A level skyline is the
  // neutral answer — it shadows nothing for any sun above the horizontal — and
  // these are patch-rim cells 8 km from anything anyone looks at.
  best[n - 1] = 0
  jump[n - 1] = -1

  for (let i = n - 2; i >= 0; i--) {
    let j = i + 1
    let slope = (flat[j] - flat[i]) / (dist[j] - dist[i])
    // Follow the hull: while the point we are looking at can itself see something
    // higher, that something is higher from here too.
    while (jump[j] !== -1) {
      const bj = best[j] - dist[j] / MOON_RADIUS_M // j's stored value, back in flattened terms
      if (slope >= bj) break
      j = jump[j]
      slope = (flat[j] - flat[i]) / (dist[j] - dist[i])
    }
    best[i] = slope + dist[i] / MOON_RADIUS_M
    jump[i] = j
  }
}

export function buildHorizonField(field: PolarHeightField): HorizonField {
  const sweep = toSweepGrid(field)
  const cellM = CAP_EXTENT_M / SWEEP_SIZE
  const outSize = HORIZON_SIZE
  const ratio = SWEEP_SIZE / outSize // whole number by construction

  const horizonTan = new Float32Array(outSize * outSize * HORIZON_AZIMUTHS)
  const skyView = new Float32Array(outSize * outSize)

  const cap = SWEEP_SIZE * 2
  const scratch: Scratch = {
    dist: new Float64Array(cap),
    flat: new Float64Array(cap),
    cell: new Int32Array(cap),
    best: new Float64Array(cap),
    jump: new Int32Array(cap),
  }

  for (let a = 0; a < HORIZON_AZIMUTHS; a++) {
    const phi = (a * 2 * Math.PI) / HORIZON_AZIMUTHS
    // Map frame: +X is map east (image right), +Y is map north (image UP, which is
    // DECREASING row index). The row inversion lives here, once.
    const dx = Math.cos(phi)
    const dy = -Math.sin(phi)

    // Walk along whichever axis moves fastest, so every cell lands on exactly one
    // line and no line skips a cell.
    const alongX = Math.abs(dx) >= Math.abs(dy)
    const major = alongX ? dx : dy
    const minor = alongX ? dy : dx
    const slopeMinor = minor / major
    // One step along the major axis advances this far along the ray.
    const stepM = cellM / Math.abs(major)
    const forward = major > 0

    // Lines are indexed by their minor-axis intercept at major = 0. Every cell
    // belongs to exactly one, which is what makes the coverage exact.
    const lo = Math.min(0, -Math.ceil(Math.abs(slopeMinor) * SWEEP_SIZE))
    const hi = SWEEP_SIZE + Math.ceil(Math.abs(slopeMinor) * SWEEP_SIZE)

    for (let line = lo; line <= hi; line++) {
      // Collect the cells of this line in the direction the sun would travel.
      let n = 0
      const first = forward ? 0 : SWEEP_SIZE - 1
      const last = forward ? SWEEP_SIZE - 1 : 0
      const stride = forward ? 1 : -1
      for (let m = first; forward ? m <= last : m >= last; m += stride) {
        const q = line + Math.round(slopeMinor * m)
        if (q < 0 || q >= SWEEP_SIZE) continue
        const x = alongX ? m : q
        const y = alongX ? q : m
        const idx = y * SWEEP_SIZE + x
        const d = n * stepM
        scratch.cell[n] = idx
        scratch.dist[n] = d
        // Flattened height: removing d^2/2R here is what lets the recurrence stay
        // a pure slope comparison. Added back inside sweepLine.
        scratch.flat[n] = sweep[idx] - (d * d) / (2 * MOON_RADIUS_M)
        n++
      }

      sweepLine(n, scratch)

      // Accumulate into the output texel each sweep cell falls in. Averaging the
      // four contributors rather than taking their max: this value is read as a
      // shadow threshold over a 62.5 m footprint, and the max would push every
      // terminator outward by the worst cell in the neighbourhood.
      for (let i = 0; i < n; i++) {
        const idx = scratch.cell[i]
        const sx = idx % SWEEP_SIZE
        const sy = (idx - sx) / SWEEP_SIZE
        const ox = (sx / ratio) | 0
        const oy = (sy / ratio) | 0
        horizonTan[(oy * outSize + ox) * HORIZON_AZIMUTHS + a] += scratch.best[i]
      }
    }
  }

  const perTexel = ratio * ratio
  for (let i = 0; i < horizonTan.length; i++) horizonTan[i] /= perTexel

  // Cosine-weighted open sky. The integral of cos(theta) over the visible cap
  // above elevation e is (1/2)cos^2(e) per radian of azimuth, and pi over a clear
  // hemisphere, so the mean of cos^2 across the bins IS the open fraction.
  //
  // Clamped at zero because a skyline BELOW horizontal adds no sky to the upper
  // hemisphere — it only means nothing blocks it. Without the clamp a hilltop
  // would report less sky than a plain.
  for (let p = 0; p < outSize * outSize; p++) {
    let acc = 0
    for (let a = 0; a < HORIZON_AZIMUTHS; a++) {
      const c = Math.cos(Math.atan(Math.max(0, horizonTan[p * HORIZON_AZIMUTHS + a])))
      acc += c * c
    }
    skyView[p] = acc / HORIZON_AZIMUTHS
  }

  return { size: outSize, azimuths: HORIZON_AZIMUTHS, horizonTan, skyView }
}

// The dumb version: one point, one direction, unit steps along the true ray, no
// hull and no line quantisation.
//
// This exists only so the tests have something independent to check the sweep
// against. The sweep is exact in principle but it walks a DDA-quantised line and
// folds curvature through a change of variables, and neither of those is obviously
// right by inspection. An earlier draft of this file was wrong by up to 10° and
// looked perfectly reasonable.
export function bruteForceHorizonTan(
  field: PolarHeightField,
  cellX: number,
  cellY: number,
  azimuthIndex: number,
  azimuths = HORIZON_AZIMUTHS
): number {
  const sweep = toSweepGrid(field)
  const cellM = CAP_EXTENT_M / SWEEP_SIZE
  const phi = (azimuthIndex * 2 * Math.PI) / azimuths
  const dx = Math.cos(phi)
  const dy = -Math.sin(phi)
  const h0 = sweep[cellY * SWEEP_SIZE + cellX]

  // Signed, like the sweep's own output — a point on a crest has a skyline below
  // its own horizontal and the comparison has to be able to see that.
  //
  // The distance is taken to the CELL that was sampled, not to the ray parameter
  // that found it. Those differ by up to half a step under nearest-neighbour
  // rounding, and using t inflates the tangent by t/(t-0.5) — a factor of two at
  // the first cell. That mistake made this reference overstate the skyline by 1.7°
  // on average and very nearly got the (correct) sweep rewritten to match it.
  let best = -Infinity
  for (let t = 1; t < SWEEP_SIZE * Math.SQRT2; t += 0.25) {
    const sx = Math.round(cellX + dx * t)
    const sy = Math.round(cellY + dy * t)
    if (sx < 0 || sy < 0 || sx >= SWEEP_SIZE || sy >= SWEEP_SIZE) break
    const distM = Math.hypot(sx - cellX, sy - cellY) * cellM
    if (distM === 0) continue
    const drop = (distM * distM) / (2 * MOON_RADIUS_M)
    const tan = (sweep[sy * SWEEP_SIZE + sx] - h0 - drop) / distM
    if (tan > best) best = tan
  }
  return Number.isFinite(best) ? best : 0
}
