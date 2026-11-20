/**
 * Plot-and-send (prototype): the rover drives a plotted path by itself.
 *
 * The player drops waypoints on the ground and sends them. The rover then
 * follows them by dead reckoning: it knows how far its wheels have turned and
 * how it has steered, but not how the regolith has slipped under it (sim.ts,
 * mode.plan). So it ends up where it believes the last waypoint is, which is
 * off the plotted line by however much the ground carried it. Long plans drift
 * further; short ones cost an uplink each.
 *
 * This runs on the player's side only. What it produces is ordinary input,
 * recorded on the tape like a joystick's, so nothing here has to be
 * deterministic across engines.
 */
import { STEP_HZ, STILL_SPEED, toInput, type Sim } from './sim'
import { TARGET_RING, type Site } from './site'

export type Pt = { x: number; z: number }

/** Waypoints in one uplink, and the furthest one plan may reach. */
export const PLAN_MAX_POINTS = 8
export const PLAN_MAX_METRES = 45

/** How near (believed) counts as reaching a waypoint: passing ones, and the last. */
const PASS_R = 0.45
const STOP_R = 0.12
/** Steps without progress before the rover gives up on a plan. */
const STALL_STEPS = STEP_HZ * 3

/** Steps the rover waits at a science stop for its instrument to start before moving on. */
const WORK_WAIT = 24

export type PlanEnd = 'done' | 'blocked' | 'bogged'

/**
 * The job a waypoint asks for: the index of the unfinished target whose ring
 * it lies in, or -1. A waypoint inside a ring is a science stop: the rover
 * halts there, does the job, and then carries on with the rest of the plan.
 */
export function stopTarget(site: Site, p: Pt, imaged: boolean[]): number {
  let best = -1
  let bestD = TARGET_RING * 0.85
  for (let i = 0; i < site.targets.length; i++) {
    if (imaged[i]) continue
    const d = Math.hypot(site.targets[i].x - p.x, site.targets[i].z - p.z)
    if (d < bestD) {
      best = i
      bestD = d
    }
  }
  return best
}

export class PlanRun {
  readonly pts: Pt[]
  /** Where the rover believes it is. */
  bx: number
  bz: number
  bh: number
  ended: PlanEnd | null = null
  private idx = 0
  private wait: number
  private lastX: number
  private lastZ: number
  private lastH: number
  private lastSlipH: number
  private stall = 0
  /** Bumps the sim had counted when the plan was sent: one more and the rover halts. */
  private bumps0: number
  private stopping = false
  /** Backing out of loose regolith the wheels were digging into. */
  private digging = false
  /** The target each waypoint stops for, or -1. */
  private stops: number[]
  /** The target being worked on at a science stop, and steps spent still there. */
  private work = -1
  private workStill = 0

  constructor(sim: Sim, pts: Pt[], waitSteps: number) {
    this.pts = pts
    this.wait = waitSteps
    this.stops = pts.map((p) => stopTarget(sim.site, p, sim.imaged))
    // A fresh picture from the rover fixes its position: belief starts true.
    this.bx = this.lastX = sim.x
    this.bz = this.lastZ = sim.z
    this.bh = this.lastH = sim.h
    this.lastSlipH = sim.slipH
    this.bumps0 = sim.bumps
  }

  /** True while the uplink is still on its way. */
  get inTransit(): boolean {
    return this.wait > 0
  }

  /** The input for the next step, or null once the plan is finished. */
  input(sim: Sim): [number, number] | null {
    // Dead reckoning: the wheels' travel along the heading the rover thinks it has.
    const moved = Math.hypot(sim.x - this.lastX, sim.z - this.lastZ) * (sim.v < 0 ? -1 : 1)
    this.bh += sim.h - this.lastH - (sim.slipH - this.lastSlipH)
    this.bx += Math.sin(this.bh) * moved
    this.bz += Math.cos(this.bh) * moved
    this.lastX = sim.x
    this.lastZ = sim.z
    this.lastH = sim.h
    this.lastSlipH = sim.slipH
    if (sim.outcome) return null
    if (this.wait > 0) {
      this.wait--
      return [0, 0]
    }
    const speed = Math.abs(sim.v)
    // Hazard stop: touching a boulder ends the plan there, rather than grinding
    // round it and losing track of where the rover is.
    if (!this.stopping && sim.off && sim.bumps > this.bumps0) {
      this.ended = 'blocked'
      this.stopping = true
    }
    // Wheels digging in: back straight out until they are free, and end the plan there.
    if (!this.stopping && sim.sink > 0.55) this.digging = true
    if (this.digging) {
      if (sim.sink > 0.15) return [toInput(-0.7), 0]
      this.digging = false
      this.ended = 'bogged'
      this.stopping = true
    }
    while (!this.stopping && this.idx < this.pts.length) {
      // At a science stop: hold still until the job is done, then carry on.
      if (this.work >= 0) {
        if (sim.imaged[this.work]) {
          this.work = -1
          this.idx++
          continue
        }
        if (speed >= STILL_SPEED) return [0, 0]
        // Stopped, but the instrument has not started: slip carried the rover outside the ring.
        if (sim.hold[this.work] === 0 && ++this.workStill > WORK_WAIT) {
          this.work = -1
          this.idx++
          continue
        }
        return [0, 0]
      }
      const final = this.idx === this.pts.length - 1
      const job = this.stops[this.idx]
      const science = !final && job >= 0 && !sim.imaged[job]
      // The rover halts at the last waypoint and at every science stop.
      const last = final || science
      const t = this.pts[this.idx]
      const d = Math.hypot(t.x - this.bx, t.z - this.bz)
      if (d < (last ? STOP_R : PASS_R)) {
        if (science) {
          this.work = job
          this.workStill = 0
        } else this.idx++
        continue
      }
      let err = Math.atan2(t.x - this.bx, t.z - this.bz) - this.bh
      while (err > Math.PI) err -= 2 * Math.PI
      while (err < -Math.PI) err += 2 * Math.PI
      // Overshot the last waypoint by a hair: stop rather than turn round for it.
      if (last && d < 0.5 && Math.abs(err) > 1.2) {
        if (science) {
          this.work = job
          this.workStill = 0
        } else this.idx++
        continue
      }
      // Steering positive turns the heading down (sim.ts), so the sign flips.
      const st = Math.max(-1, Math.min(1, -err * 2.4))
      let th = 0
      if (Math.abs(err) < 0.45) {
        th = (1 - Math.abs(err) * 1.2) * (last ? Math.max(0.22, Math.min(1, d * 0.9)) : 1)
      }
      // Stalled against a rock.
      if (speed < 0.03 && th > 0) this.stall++
      else if (th > 0) this.stall = Math.max(0, this.stall - 2)
      if (this.stall > STALL_STEPS) {
        this.ended = 'blocked'
        this.stopping = true
        break
      }
      return [toInput(th), toInput(st)]
    }
    // Brake, then stay put while an instrument is working.
    this.stopping = true
    if (speed >= STILL_SPEED) return [0, 0]
    for (let i = 0; i < sim.hold.length; i++) if (!sim.imaged[i] && sim.hold[i] > 0) return [0, 0]
    this.ended = this.ended ?? 'done'
    return null
  }
}

/**
 * Combo points for one uplink that finished `jobs` science jobs. Nothing for a
 * single job; each extra job in the same uplink is worth more than the last,
 * because slip builds along a plan and the later stops are the hard ones.
 * 2 jobs 30, 3 jobs 90, 4 jobs 180, 5 jobs 300.
 */
export function comboPoints(jobs: number): number {
  return jobs < 2 ? 0 : 15 * jobs * (jobs - 1)
}

export type Find = { factor: number; label: string }

const FINDS: Find[] = [
  { factor: 0.4, label: 'Poor find' },
  { factor: 1, label: 'Fair find' },
  { factor: 1.6, label: 'Good find' },
  { factor: 2.5, label: 'Rich find' },
]

/**
 * What a target turns out to be worth: hidden until the job is done, and the
 * same for everyone on the same day, so it can be learned and passed on.
 */
export function findAt(site: Site, i: number): Find {
  let h = (site.seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  const u = ((h ^ (h >>> 16)) >>> 0) / 4294967296
  return FINDS[u < 0.25 ? 0 : u < 0.6 ? 1 : u < 0.85 ? 2 : 3]
}

/** Length of a path from a start point through its waypoints, m. */
export function planMetres(x: number, z: number, pts: Pt[]): number {
  let m = 0
  for (const p of pts) {
    m += Math.hypot(p.x - x, p.z - z)
    x = p.x
    z = p.z
  }
  return m
}
