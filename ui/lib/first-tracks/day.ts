/**
 * The day's site, ready to play: the generated site (site.ts) with one fairness
 * pass over it.
 *
 * Rocks are scattered and laid in belts without regard to each other, and now
 * and then they wall a target in: the only route with room to spare becomes a
 * long loop round the whole field. A tight gap is a fair risk; a wall is not.
 * So each leg of the day's short tour is checked with a comfortable route (one
 * that gives every rock a wide berth), and where that route is far longer than
 * the straight line, the rocks crowding the straight line are cleared away.
 *
 * Deterministic, like everything the leaderboard replay touches.
 */
import { parPath, PAR_SOFT_COST, pathLength, resetGrids } from './par'
import { cellKey, cellOf, CLEAR, dist, generateSite, HOLD_SECONDS, RAMP_FOOT, shortestTour, type Rock, type Site } from './site'

/** Berth the comfortable route gives rocks, beyond the rover's own radius, m. */
const COMFORT = 0.3
/** A leg is walled in when its comfortable route is this many times the straight line, or more. */
const WALLED_RATIO = 1.45
/** Half-width of the lane cleared along a walled-in leg, m. */
const LANE = 1.7

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax
  const dz = bz - az
  const l2 = dx * dx + dz * dz
  let f = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0
  f = f < 0 ? 0 : f > 1 ? 1 : f
  return dist(px, pz, ax + dx * f, az + dz * f)
}

function openWalledLegs(site: Site): void {
  const order = shortestTour(site.targets, RAMP_FOOT[0], RAMP_FOOT[1]).order
  const stops: [number, number][] = [[RAMP_FOOT[0], RAMP_FOOT[1]]]
  for (const i of order) stops.push([site.targets[i].x, site.targets[i].z])
  for (let pass = 0; pass < 3; pass++) {
    const doomed = new Set<Rock>()
    for (let i = 1; i < stops.length; i++) {
      const [ax, az] = stops[i - 1]
      const [bx, bz] = stops[i]
      const straight = dist(ax, az, bx, bz)
      const path = parPath(site, ax, az, bx, bz, PAR_SOFT_COST, COMFORT)
      // A two-point path longer than a cell is the planner's "no way through".
      const blocked = path.length === 2 && straight > 1
      if (!blocked && pathLength(path) < straight * WALLED_RATIO) continue
      site.hazards.forEach((list) => {
        for (const r of list) if (!r.anchor && distToSegment(r.x, r.z, ax, az, bx, bz) < LANE + r.r) doomed.add(r)
      })
    }
    if (!doomed.size) return
    site.rocks = site.rocks.filter((r) => !doomed.has(r))
    site.hazards.clear()
    for (const r of site.rocks) {
      if (r.h <= CLEAR) continue
      const key = cellKey(cellOf(r.x), cellOf(r.z))
      const list = site.hazards.get(key)
      if (list) list.push(r)
      else site.hazards.set(key, [r])
    }
    resetGrids(site)
  }
}

/** Seconds allowed per target, on top of its hold, for braking to a stop and pulling away again. */
const STOP_SECONDS = 2

/**
 * How long the day's short tour takes when driven along par at whatever speed
 * the ground allows: flat out on firm level ground, slower through soft
 * regolith and up a slope, by the same factors the sim applies.
 */
function parTourSeconds(site: Site): number {
  const order = shortestTour(site.targets, RAMP_FOOT[0], RAMP_FOOT[1]).order
  let x = RAMP_FOOT[0]
  let z = RAMP_FOOT[1]
  let seconds = 0
  for (const i of order) {
    const t = site.targets[i]
    const path = parPath(site, x, z, t.x, t.z)
    for (let k = 1; k < path.length; k++) {
      const ax = path[k - 1][0]
      const az = path[k - 1][1]
      const bx = path[k][0]
      const bz = path[k][1]
      const len = dist(ax, az, bx, bz)
      const n = Math.max(1, Math.ceil(len / 0.25))
      for (let j = 0; j < n; j++) {
        const x0 = ax + ((bx - ax) * j) / n
        const z0 = az + ((bz - az) * j) / n
        const x1 = ax + ((bx - ax) * (j + 1)) / n
        const z1 = az + ((bz - az) * (j + 1)) / n
        const ds = len / n
        const grade = ds > 0 ? (site.ground(x1, z1) - site.ground(x0, z0)) / ds : 0
        const climb = grade > 0 ? Math.max(0.2, Math.min(1, 1 - grade * 1.6)) : 1
        const soft = site.softAt((x0 + x1) / 2, (z0 + z1) / 2)
        seconds += ds / (climb * (1 - 0.5 * soft))
      }
    }
    seconds += STOP_SECONDS + HOLD_SECONDS[t.kind]
    x = t.x
    z = t.z
  }
  return seconds
}

// Building a site costs tens of milliseconds; keep the last few days.
const cache = new Map<number, Site>()
export function siteFor(mission: number): Site {
  let s = cache.get(mission)
  if (!s) {
    s = generateSite(mission)
    openWalledLegs(s)
    s.parSeconds = parTourSeconds(s)
    cache.set(mission, s)
    if (cache.size > 4) cache.delete(cache.keys().next().value as number)
  }
  return s
}
