/**
 * Par: the best safe route for a leg, and the energy a perfect driver would
 * spend on it. Scoring measures every leg against these; the player is never
 * shown them.
 *
 * A par route is the shortest path from where the leg started to the target's
 * centre that keeps clear of rocks taller than the wheels (inflated by the
 * rover's radius), the lander, and slopes steep enough to tip on. It is found
 * by A* over a half-metre grid and then string-pulled, so the line is about as
 * short as a perfect driver could make it.
 *
 * Runs in the leaderboard replay as well as the browser, so it is deterministic
 * (plain arithmetic and Math.sqrt) and cheap: the grid is built once per site
 * and a leg costs well under a millisecond.
 */
import { datan2 } from '@/lib/touchdown/detmath'
import { E_CLIMB, E_IDLE, E_METRE, E_ROLL_TURN, E_START, TURN, VMAX } from './sim'
import { BODY, clamp, COLL_R, DECK, inRect, RAMP, type Site } from './site'

/** Grid pitch and half-extent, m. */
const PG = 0.5
const PH = 50
const PN = Math.round((2 * PH) / PG)
/** Ground gradient par will not cross: gentler than the rover's tipping roll, with a margin. */
const MAX_GRADIENT = 0.42
/** Inside a science crater the wall is the only way to the target: par may take it, up to just short of the tipping pitch. */
const MAX_CRATER_GRADIENT = 0.62

type ParGrid = { block: Uint8Array; soft: Float32Array }

const cellX = (i: number) => -PH + (i + 0.5) * PG
const toCell = (v: number) => clamp(Math.floor((v + PH) / PG), 0, PN - 1)

const grids = new WeakMap<Site, Map<number, ParGrid>>()

/** Forget a site's grids: call after its rocks change. */
export function resetGrids(site: Site): void {
  grids.delete(site)
}

/** `clearance` widens the berth given to rocks: 0 for par itself, more for the bot's own planner. */
function gridFor(site: Site, clearance: number): ParGrid {
  let bySite = grids.get(site)
  if (!bySite) {
    bySite = new Map()
    grids.set(site, bySite)
  }
  const cached = bySite.get(clearance)
  if (cached) return cached
  const block = new Uint8Array(PN * PN)
  const soft = new Float32Array(PN * PN)
  const e = 0.3
  for (let j = 0; j < PN; j++) {
    for (let i = 0; i < PN; i++) {
      const x = cellX(i)
      const z = cellX(j)
      const k = i + j * PN
      const gx = (site.ground(x + e, z) - site.ground(x - e, z)) / (2 * e)
      const gz = (site.ground(x, z + e) - site.ground(x, z - e)) / (2 * e)
      // A planner that asks for a wider berth round rocks also keeps further off steep ground.
      let limit = clearance > 0 ? MAX_GRADIENT * 0.8 : MAX_GRADIENT
      for (const c of site.craters) {
        if (c.science && (x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < c.r * 1.3 * (c.r * 1.3)) limit = MAX_CRATER_GRADIENT
      }
      if (gx * gx + gz * gz > limit * limit) block[k] = 1
      if (inRect(DECK, x, z, 0.6) || inRect(BODY, x, z, 0.6) || inRect(RAMP, x, z, 0.6)) block[k] = 1
      soft[k] = site.softAt(x, z)
    }
  }
  site.hazards.forEach((list) => {
    for (const r of list) {
      const m = COLL_R + r.r * 0.8 + 0.05 + clearance
      const i0 = Math.max(0, Math.floor((r.x - m + PH) / PG))
      const i1 = Math.min(PN - 1, Math.floor((r.x + m + PH) / PG))
      const j0 = Math.max(0, Math.floor((r.z - m + PH) / PG))
      const j1 = Math.min(PN - 1, Math.floor((r.z + m + PH) / PG))
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dx = cellX(i) - r.x
          const dz = cellX(j) - r.z
          if (dx * dx + dz * dz < m * m) block[i + j * PN] = 1
        }
      }
    }
  })
  const grid = { block, soft }
  bySite.set(clearance, grid)
  return grid
}

function clearLine(g: ParGrid, ax: number, az: number, bx: number, bz: number, softLimit: number): boolean {
  const d = Math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az))
  const n = Math.ceil(d / 0.2)
  for (let i = 1; i < n; i++) {
    const f = i / n
    const k = toCell(ax + (bx - ax) * f) + toCell(az + (bz - az) * f) * PN
    if (g.block[k] === 1 || g.soft[k] > softLimit) return false
  }
  return true
}

export type Path = [number, number][]

export function pathLength(path: Path): number {
  let len = 0
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i - 1][0]
    const dz = path[i][1] - path[i - 1][1]
    len += Math.sqrt(dx * dx + dz * dz)
  }
  return len
}

/** How much dearer par counts a metre of fully soft ground. The bot's own planner passes a higher figure to steer round it. */
export const PAR_SOFT_COST = 1.2

/** The par route from a to b. Falls back to the straight line if the grid finds no way through. */
export function parPath(site: Site, ax: number, az: number, bx: number, bz: number, softCost = PAR_SOFT_COST, clearance = 0): Path {
  const g = gridFor(site, clearance)
  const s0 = toCell(ax) + toCell(az) * PN
  const g0 = toCell(bx) + toCell(bz) * PN
  if (s0 === g0) return [[ax, az], [bx, bz]]
  const gi = g0 % PN
  const gj = (g0 / PN) | 0
  const H = (k: number) => {
    const di = Math.abs((k % PN) - gi)
    const dj = Math.abs(((k / PN) | 0) - gj)
    return (Math.max(di, dj) + 0.414 * Math.min(di, dj)) * PG
  }
  const cost = new Float64Array(PN * PN).fill(Infinity)
  const came = new Int32Array(PN * PN).fill(-1)
  const closed = new Uint8Array(PN * PN)
  // Binary heap of [f, cell] pairs kept in two parallel arrays.
  const hf: number[] = []
  const hk: number[] = []
  const push = (k: number, f: number) => {
    let i = hf.length
    hf.push(f)
    hk.push(k)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (hf[p] <= hf[i]) break
      const tf = hf[p]
      const tk = hk[p]
      hf[p] = hf[i]
      hk[p] = hk[i]
      hf[i] = tf
      hk[i] = tk
      i = p
    }
  }
  const pop = (): number => {
    const top = hk[0]
    const ef = hf.pop() as number
    const ek = hk.pop() as number
    const n = hf.length
    if (n) {
      hf[0] = ef
      hk[0] = ek
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < n && hf[l] < hf[m]) m = l
        if (r < n && hf[r] < hf[m]) m = r
        if (m === i) break
        const tf = hf[m]
        const tk = hk[m]
        hf[m] = hf[i]
        hk[m] = hk[i]
        hf[i] = tf
        hk[i] = tk
        i = m
      }
    }
    return top
  }
  const free = (k: number) => k === s0 || k === g0 || !g.block[k]
  cost[s0] = 0
  push(s0, H(s0))
  while (hf.length) {
    const k = pop()
    if (closed[k]) continue
    closed[k] = 1
    if (k === g0) break
    const i = k % PN
    const j = (k / PN) | 0
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || nj < 0 || ni >= PN || nj >= PN) continue
        const n = ni + nj * PN
        if (!free(n) || closed[n]) continue
        // No cutting a blocked corner.
        if (di && dj && (!free(i + di + j * PN) || !free(i + (j + dj) * PN))) continue
        const c = cost[k] + (di && dj ? 1.414 : 1) * PG * (1 + softCost * g.soft[n])
        if (c < cost[n]) {
          cost[n] = c
          came[n] = k
          push(n, c + H(n))
        }
      }
    }
  }
  if (came[g0] < 0) return [[ax, az], [bx, bz]]
  const cells: Path = []
  for (let k = g0; k !== -1; k = came[k]) {
    cells.push([cellX(k % PN), cellX((k / PN) | 0)])
    if (k === s0) break
  }
  cells.reverse()
  cells[0] = [ax, az]
  cells[cells.length - 1] = [bx, bz]
  // String-pull: from each kept point, jump to the furthest point in clear sight.
  // Par's straight lines may cross soft ground; a planner that prices soft ground higher keeps off it.
  const softLimit = softCost > PAR_SOFT_COST ? 0.15 : 2
  const out: Path = [cells[0]]
  let a = 0
  while (a < cells.length - 1) {
    let b = cells.length - 1
    while (b > a + 1 && !clearLine(g, cells[a][0], cells[a][1], cells[b][0], cells[b][1], softLimit)) b--
    out.push(cells[b])
    a = b
  }
  return out
}

const PI = 3.141592653589793

/**
 * Energy a perfect driver spends on a par route: one start, rolling turns
 * only, one stop to image. `headingIn` is the heading the rover arrives with
 * (null on a leg with no previous heading); returns the heading it leaves with.
 */
export function parEnergy(site: Site, path: Path, headingIn: number | null, holdSeconds = 1): { energy: number; heading: number | null } {
  let energy = VMAX * E_START + holdSeconds * E_IDLE
  let turn = 0
  let h = headingIn
  for (let i = 1; i < path.length; i++) {
    const ax = path[i - 1][0]
    const az = path[i - 1][1]
    const bx = path[i][0]
    const bz = path[i][1]
    const len = Math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az))
    if (len < 1e-6) continue
    const hd = datan2(bx - ax, bz - az)
    if (h !== null) {
      let d = hd - h
      while (d > PI) d -= 2 * PI
      while (d < -PI) d += 2 * PI
      turn += d < 0 ? -d : d
    }
    h = hd
    const n = Math.max(1, Math.ceil(len / 0.25))
    const ds = len / n
    for (let k = 0; k < n; k++) {
      const f0 = k / n
      const f1 = (k + 1) / n
      const x0 = ax + (bx - ax) * f0
      const z0 = az + (bz - az) * f0
      const x1 = ax + (bx - ax) * f1
      const z1 = az + (bz - az) * f1
      const so = site.softAt((x0 + x1) / 2, (z0 + z1) / 2)
      const rise = site.ground(x1, z1) - site.ground(x0, z0)
      energy += ds * E_METRE * (1 + 2 * so) + (rise > 0 ? rise * E_CLIMB : 0) + (ds / (VMAX * (1 - 0.5 * so))) * E_IDLE
    }
  }
  energy += (turn / TURN) * E_ROLL_TURN
  return { energy, heading: h }
}
