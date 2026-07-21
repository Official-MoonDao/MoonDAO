// Geo helpers for the Lunar Atlas globe.
//
// Converts selenographic lat/lon <-> positions on a three.js sphere, and
// provides great-circle utilities used for marker placement, clustering, and
// camera drill-in. Pure math (no three import) so it is unit-testable in the
// headless Cypress/mocha suite. Returned positions are plain [x, y, z] tuples
// the scene wraps in THREE.Vector3.
//
// Convention (matches a standard equirectangular texture on THREE.SphereGeometry
// whose seam sits at lon = ±180 and whose texture center column is lon = 0):
//
//   phi   = (90 - lat) * DEG2RAD   // polar angle from the +Y (north) pole
//   theta = (lon + 180) * DEG2RAD
//   x = -R * sin(phi) * cos(theta)
//   y =  R * cos(phi)
//   z =  R * sin(phi) * sin(theta)

// Mean lunar radius in meters (IAU). Used for real-world distance conversions.
export const MOON_RADIUS_M = 1737400

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

export type Vec3 = [number, number, number]

// Normalize a longitude into [-180, 180).
export function normalizeLon(lon: number): number {
  let l = ((lon + 180) % 360 + 360) % 360 - 180
  // Map an exact +180 back to -180 for a single canonical seam value.
  if (l === 180) l = -180
  return l
}

// Clamp a latitude to the valid [-90, 90] range.
export function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat))
}

// lat/lon (degrees) -> position on a sphere of the given radius (default unit).
export function latLonToVector3(
  lat: number,
  lon: number,
  radius = 1
): Vec3 {
  const phi = (90 - clampLat(lat)) * DEG2RAD
  const theta = (normalizeLon(lon) + 180) * DEG2RAD
  const sinPhi = Math.sin(phi)
  return [
    -radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta),
  ]
}

// Inverse of latLonToVector3. Radius is inferred from the vector length, so
// this round-trips for any sphere radius.
export function vector3ToLatLon(v: Vec3): { lat: number; lon: number } {
  const [x, y, z] = v
  const r = Math.sqrt(x * x + y * y + z * z)
  if (r === 0) return { lat: 0, lon: 0 }
  const phi = Math.acos(Math.max(-1, Math.min(1, y / r)))
  const theta = Math.atan2(z, -x) // == (lon + 180) in radians
  return {
    lat: 90 - phi * RAD2DEG,
    lon: normalizeLon(theta * RAD2DEG - 180),
  }
}

// Outward surface normal (unit vector) at a lat/lon — the "up" direction used
// to orient markers and seat 3D models flush on the surface.
export function surfaceNormal(lat: number, lon: number): Vec3 {
  const v = latLonToVector3(lat, lon, 1)
  return v // already unit length on a unit sphere
}

// Great-circle central angle (radians) between two lat/lon points.
export function centralAngle(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const lat1 = a.lat * DEG2RAD
  const lat2 = b.lat * DEG2RAD
  const dLat = (b.lat - a.lat) * DEG2RAD
  const dLon = (b.lon - a.lon) * DEG2RAD
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * Math.asin(Math.min(1, Math.sqrt(s)))
}

// Great-circle surface distance between two lat/lon points, in meters.
export function surfaceDistanceM(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  return centralAngle(a, b) * MOON_RADIUS_M
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function norm3(a: Vec3): Vec3 {
  const l = Math.sqrt(dot3(a, a)) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

// Spread overlapping points apart for legibility. Points whose pairwise angular
// separation is below `thresholdRad` are treated as a cluster and arranged on a
// small ring (angular radius ~`spreadRad`) around the cluster centroid. Returns
// unit direction vectors keyed by id. Single points are returned unchanged.
// Used to fan out the tightly-packed South-Pole projects so their markers don't
// overlap, without meaningfully misrepresenting their (already approximate)
// locations.
export function declusterDirections(
  points: { id: string; lat: number; lon: number }[],
  spreadRad = 0.05,
  thresholdRad = 0.11
): Map<string, Vec3> {
  const dirs = points.map((p) => ({
    id: p.id,
    dir: norm3(latLonToVector3(p.lat, p.lon, 1)),
  }))

  // Union-find clustering by angular proximity.
  const parent = dirs.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const cosThreshold = Math.cos(thresholdRad)
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      if (dot3(dirs[i].dir, dirs[j].dir) > cosThreshold) {
        parent[find(i)] = find(j)
      }
    }
  }

  const clusters = new Map<number, number[]>()
  for (let i = 0; i < dirs.length; i++) {
    const root = find(i)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root)!.push(i)
  }

  const result = new Map<string, Vec3>()
  clusters.forEach((members) => {
    if (members.length === 1) {
      const d = dirs[members[0]]
      result.set(d.id, d.dir)
      return
    }
    // Centroid direction.
    let cx = 0
    let cy = 0
    let cz = 0
    for (const m of members) {
      cx += dirs[m].dir[0]
      cy += dirs[m].dir[1]
      cz += dirs[m].dir[2]
    }
    const centroid = norm3([cx, cy, cz])
    // Tangent basis at the centroid.
    const seed: Vec3 =
      Math.abs(centroid[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0]
    const u = norm3(cross3(seed, centroid))
    const v = cross3(centroid, u)
    // Grow the ring slightly for larger clusters so dots keep clear, but cap
    // the growth: a big cluster must not fan markers so far from the pole
    // that their displayed positions misrepresent the (already approximate)
    // real locations. At the cap, ring circumference still separates ~a dozen
    // markers comfortably.
    const spread = Math.min(
      spreadRad * (1 + (members.length - 2) * 0.12),
      spreadRad * 1.6
    )
    const cosS = Math.cos(spread)
    const sinS = Math.sin(spread)
    members.forEach((m, k) => {
      const theta = (k / members.length) * Math.PI * 2
      const tangent: Vec3 = [
        u[0] * Math.cos(theta) + v[0] * Math.sin(theta),
        u[1] * Math.cos(theta) + v[1] * Math.sin(theta),
        u[2] * Math.cos(theta) + v[2] * Math.sin(theta),
      ]
      result.set(
        dirs[m].id,
        norm3([
          centroid[0] * cosS + tangent[0] * sinS,
          centroid[1] * cosS + tangent[1] * sinS,
          centroid[2] * cosS + tangent[2] * sinS,
        ])
      )
    })
  })

  return result
}

// Spherical centroid of a set of lat/lon points: the normalized mean of their
// unit direction vectors. Used to place one tech-tree site marker for a group
// of member projects. Degenerate sets (antipodal points cancelling out) fall
// back to the first point's direction.
export function centroidDirection(
  points: { lat: number; lon: number }[]
): Vec3 {
  let x = 0
  let y = 0
  let z = 0
  for (const p of points) {
    const v = latLonToVector3(p.lat, p.lon, 1)
    x += v[0]
    y += v[1]
    z += v[2]
  }
  const len = Math.sqrt(x * x + y * y + z * z)
  if (len < 1e-9) {
    return points.length
      ? latLonToVector3(points[0].lat, points[0].lon, 1)
      : [0, 1, 0]
  }
  return [x / len, y / len, z / len]
}

// Up vector for an orbit (top-down) camera framing at a lat/lon. An orbit
// camera looks straight down the surface normal, which leaves "up"
// underdetermined — and a raw world-Y up degenerates at the poles (parallel
// to the view axis), making orbit controls erratic there. Project world-Y
// onto the plane perpendicular to the normal so equatorial views keep their
// familiar orientation, and fall back to world-Z near the poles.
export function orbitUpVector(lat: number, lon: number): Vec3 {
  const n = surfaceNormal(lat, lon)
  const project = (ref: Vec3): Vec3 => {
    const d = dot3(ref, n)
    return [ref[0] - n[0] * d, ref[1] - n[1] * d, ref[2] - n[2] * d]
  }
  let up = project([0, 1, 0])
  if (dot3(up, up) < 0.05) up = project([0, 0, 1])
  return norm3(up)
}

// A camera position + look target for drilling into a lat/lon region. The
// camera sits along the surface normal at `distance` sphere-radii out; the
// scene animates toward this framing. `radius` is the globe's render radius.
export function drillInFraming(
  lat: number,
  lon: number,
  radius = 1,
  distanceRadii = 1.9
): { position: Vec3; target: Vec3 } {
  const target = latLonToVector3(lat, lon, radius)
  const n = surfaceNormal(lat, lon)
  return {
    position: [
      target[0] + n[0] * radius * distanceRadii,
      target[1] + n[1] * radius * distanceRadii,
      target[2] + n[2] * radius * distanceRadii,
    ],
    target,
  }
}

// A cinematic, low-angle "from the surface" camera framing for a lat/lon. The
// camera sits just above the ground a short distance away and looks across the
// surface at a point slightly above it (where an on-surface model sits), so the
// lunar horizon falls behind the subject rather than looking straight down.
// All offsets are expressed as fractions of `radius`.
export function surfaceViewFraming(
  lat: number,
  lon: number,
  radius = 1,
  opts?: {
    eyeHeight?: number
    standoff?: number
    targetLift?: number
    bearingRad?: number
  }
): { position: Vec3; target: Vec3 } {
  const eyeHeight = (opts?.eyeHeight ?? 0.06) * radius
  const standoff = (opts?.standoff ?? 0.18) * radius
  const targetLift = (opts?.targetLift ?? 0.028) * radius

  const surface = latLonToVector3(lat, lon, radius)
  const n = surfaceNormal(lat, lon) // unit

  // A stable horizontal (tangent) direction at this point; near the poles the
  // world-Y reference degenerates, so fall back to world-Z.
  const ref: Vec3 = Math.abs(n[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0]
  let t = norm3(cross3(ref, n))
  if (opts?.bearingRad) {
    const b = opts.bearingRad
    const t2 = cross3(n, t) // second tangent, completes the basis
    t = norm3([
      t[0] * Math.cos(b) + t2[0] * Math.sin(b),
      t[1] * Math.cos(b) + t2[1] * Math.sin(b),
      t[2] * Math.cos(b) + t2[2] * Math.sin(b),
    ])
  }

  const target: Vec3 = [
    surface[0] + n[0] * targetLift,
    surface[1] + n[1] * targetLift,
    surface[2] + n[2] * targetLift,
  ]
  const position: Vec3 = [
    surface[0] + n[0] * eyeHeight + t[0] * standoff,
    surface[1] + n[1] * eyeHeight + t[1] * standoff,
    surface[2] + n[2] * eyeHeight + t[2] * standoff,
  ]
  return { position, target }
}
