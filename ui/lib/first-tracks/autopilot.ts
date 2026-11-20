/**
 * Scripted drivers for the headless bot (scripts/first-tracks-bot.ts). They
 * play through the real sim and the real signal delay, so tuning changes can
 * be checked automatically.
 *
 *   perfect  sees where the rover will be once every command in flight has
 *            landed (the Easy ghost), follows the par route, never spins on the
 *            spot unless it must. The yardstick: it must clear Easy.
 *   average  sees the delayed picture, anticipates most of the lag, follows a
 *            planned route at a sensible speed.
 *   careful  drive, wait for the picture, look, repeat. Never surprised, but
 *            slow, and every restart costs battery.
 *   sloppy   sees the delayed picture, barely anticipates, drives flat out
 *            straight at the next target.
 *
 * Not part of the replay: this file may use Math.sin and friends. Its output
 * is whole-number inputs, which is all the tape records.
 */
import type { ModeConfig } from './modes'
import { parPath, type Path } from './par'
import { ghostOf, STEP_HZ, toInput, TURN, VMAX, type Sim } from './sim'
import { RAMP, shortestTour, TARGET_RING, type Site } from './site'

export type DriverKind = 'perfect' | 'average' | 'careful' | 'sloppy'
export const DRIVER_KINDS: DriverKind[] = ['perfect', 'average', 'careful', 'sloppy']

type Obs = { x: number; z: number; h: number; v: number; off: boolean; imaged: number }

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const snap = (s: Sim): Obs => {
  let imaged = 0
  for (let i = 0; i < s.imaged.length; i++) if (s.imaged[i]) imaged |= 1 << i
  return { x: s.x, z: s.z, h: s.h, v: s.v, off: s.off, imaged }
}

const TUNING: Record<DriverKind, { anticipate: number; cruise: number; margin: number; plan: boolean; order: boolean; gain: number }> = {
  perfect: { anticipate: 0, cruise: 1, margin: 0.03, plan: true, order: true, gain: 3 },
  average: { anticipate: 0.75, cruise: 0.85, margin: 0.35, plan: true, order: true, gain: 2 },
  careful: { anticipate: 0, cruise: 1, margin: 0.2, plan: true, order: false, gain: 3 },
  sloppy: { anticipate: 0.5, cruise: 1, margin: 0.1, plan: false, order: false, gain: 1.2 },
}

export type Driver = {
  /** The input to give on this step, as whole numbers -127..127. */
  input: (sim: Sim) => [number, number]
}

export function createDriver(kind: DriverKind, site: Site, mode: ModeConfig): Driver {
  const tune = TUNING[kind]
  const down = Math.round(mode.downlink * STEP_HZ)
  const lagSteps = Math.round((mode.uplink + mode.downlink) * STEP_HZ)
  const lag = mode.uplink + mode.downlink
  const hist: Obs[] = []
  const sent: [number, number][] = []
  let goal = -1
  let path: Path | null = null
  let wp = 1
  let planAge = 0
  let stall = 0
  let backing = 0
  let backSteer = 1
  // The careful driver's burst-and-wait cycle.
  let act = 0
  let actTh = 0
  let actSt = 0
  let wait = 0
  /** Steps of straight driving queued to follow a turn, with no wait between. */
  let thenDrive = 0

  /** What the driver believes the rover's pose is right now. */
  const believe = (o: Obs): Obs => {
    if (!tune.anticipate || !sent.length) return o
    let steer = 0
    let drive = 0
    const n = Math.min(sent.length, lagSteps)
    for (let i = sent.length - n; i < sent.length; i++) {
      drive += sent[i][0]
      steer += sent[i][1]
    }
    const k = tune.anticipate / STEP_HZ
    const h = o.h - steer * TURN * k
    const d = drive * VMAX * k
    return { ...o, h, x: o.x + Math.sin(h) * d, z: o.z + Math.cos(h) * d }
  }

  let order: number[] | null = null
  const pickGoal = (o: Obs) => {
    if (tune.order) {
      if (!order) order = shortestTour(site.targets, o.x, o.z).order
      goal = order.find((i) => !(o.imaged & (1 << i))) ?? -1
      path = null
      return
    }
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < site.targets.length; i++) {
      if (o.imaged & (1 << i)) continue
      const t = site.targets[i]
      const d = Math.hypot(t.x - o.x, t.z - o.z)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    goal = best
    path = null
  }

  const replan = (o: Obs) => {
    const t = site.targets[goal]
    path = tune.plan ? parPath(site, o.x, o.z, t.x, t.z, kind === 'careful' ? 3 : 8, 0.25) : [[o.x, o.z], [t.x, t.z]]
    wp = 1
    planAge = 0
  }

  /** Throttle and steer, -1..1, from a believed pose. */
  const control = (o: Obs): [number, number] => {
    if (!o.off) {
      // Egress: turn to face down the ramp, then drive off it, holding the centre line.
      const onDeck = o.z < RAMP.z0 - 0.4
      const want = -clamp(o.x * 0.7, -0.3, 0.3)
      const err = wrap(want - o.h)
      const st = -clamp(err * tune.gain, -1, 1)
      if (onDeck && Math.abs(err) > 0.07) return [0, st]
      return [kind === 'perfect' ? 1 : 0.7, st]
    }
    if (goal < 0 || o.imaged & (1 << goal)) pickGoal(o)
    if (goal < 0) return [0, 0]
    if (!path) replan(o)
    else if (++planAge > STEP_HZ) {
      // Plan again only when the rover has strayed from its line: replanning
      // on a timer can flip between two ways round the same rock and go nowhere.
      planAge = 0
      const a = (path as Path)[Math.max(0, wp - 1)]
      const b = (path as Path)[wp]
      const dx = b[0] - a[0]
      const dz = b[1] - a[1]
      const l2 = dx * dx + dz * dz || 1
      const f = clamp(((o.x - a[0]) * dx + (o.z - a[1]) * dz) / l2, 0, 1)
      if (Math.hypot(o.x - (a[0] + dx * f), o.z - (a[1] + dz * f)) > 1.5) replan(o)
    }
    const p = path as Path
    const t = site.targets[goal]
    while (wp < p.length - 1 && Math.hypot(p[wp][0] - o.x, p[wp][1] - o.z) < (kind === 'perfect' ? 0.7 : 1.3)) wp++
    const aim = p[wp]
    const dGoal = Math.hypot(t.x - o.x, t.z - o.z)
    const speed = Math.abs(o.v)
    // Close enough that braking now stops on the centre: let go.
    if (dGoal <= (speed * speed) / 3.2 + tune.margin) return [0, 0]
    if (dGoal < TARGET_RING * 0.5 && speed < 0.06 && kind !== 'perfect') return [0, 0]
    const err = wrap(Math.atan2(aim[0] - o.x, aim[1] - o.z) - o.h)
    const st = dGoal < 0.5 ? 0 : -clamp(err * 2.5, -1, 1)
    let th = tune.cruise
    if (Math.abs(err) > 2.4) th = 0
    else if (Math.abs(err) > 1.5) th = 0.5
    else if (Math.abs(err) > 1.0 && kind !== 'perfect') th = 0.35
    // Tighten the turn when the next waypoint is close: swinging wide is how rocks get hit.
    else if (kind === 'perfect' && Math.abs(err) > 0.5 && Math.hypot(aim[0] - o.x, aim[1] - o.z) < 3.5 && wp < p.length - 1) th = 0.45
    if (dGoal < 1.5 && kind !== 'perfect') th = Math.min(th, clamp(dGoal / 1.5, 0.3, 1))
    return [th, st]
  }

  const careful = (o: Obs): [number, number] => {
    if (act > 0) {
      act--
      const out: [number, number] = [actTh, actSt]
      if (act === 0) {
        if (thenDrive > 0) {
          act = thenDrive
          actTh = 1
          actSt = 0
          thenDrive = 0
        } else wait = lagSteps + 42
      }
      return out
    }
    if (wait > 0) {
      wait--
      return [0, 0]
    }
    // Stopped and the picture is current: decide the next burst.
    let aimX: number
    let aimZ: number
    let reach: number
    if (!o.off) {
      aimX = 0
      aimZ = RAMP.z1 + 2
      reach = o.z < RAMP.z0 - 0.4 && Math.abs(wrap(-o.h)) > 0.05 ? 0 : 6
      if (reach === 0) {
        aimX = o.x
        aimZ = o.z + 5
      }
    } else {
      if (goal < 0 || o.imaged & (1 << goal)) pickGoal(o)
      if (goal < 0) return [0, 0]
      replan(o)
      const p = path as Path
      const t = site.targets[goal]
      const dGoal = Math.hypot(t.x - o.x, t.z - o.z)
      if (dGoal < 0.6) {
        wait = 30
        return [0, 0]
      }
      aimX = p[1][0]
      aimZ = p[1][1]
      reach = Math.min(Math.hypot(aimX - o.x, aimZ - o.z), 7)
    }
    const err = wrap(Math.atan2(aimX - o.x, aimZ - o.z) - o.h)
    // Time to cover `reach` metres including the run-up and the roll-out.
    const cruise = Math.max(0, reach - 0.87)
    const drive = reach <= 0 ? 0 : Math.max(6, Math.round((cruise / VMAX + (reach > 0.87 ? 1.11 : Math.sqrt(reach / 0.7))) * STEP_HZ))
    if (Math.abs(err) > 0.04) {
      act = Math.max(1, Math.round((Math.abs(err) / TURN) * STEP_HZ))
      actTh = 0
      actSt = err > 0 ? -1 : 1
      // Off the lander a turn runs straight into the drive. On the deck, look again first.
      thenDrive = o.off ? drive : 0
    } else {
      act = Math.max(1, drive)
      actTh = 1
      actSt = 0
    }
    return careful(o)
  }

  return {
    input(sim) {
      hist.push(snap(sim))
      const seen = kind === 'perfect' ? snap(ghostOf(sim)) : hist[Math.max(0, hist.length - 1 - down)]
      let out: [number, number]
      if (backing > 0) {
        backing--
        out = [-1, backSteer * 0.6]
        if (backing === 0) {
          path = null
          act = 0
          wait = lagSteps
        }
      } else {
        out = kind === 'careful' ? careful(seen) : control(believe(seen))
        // Pushing against something and going nowhere: back off and try another line.
        if (out[0] > 0.3 && Math.abs(seen.v) < 0.04 && seen.off) stall++
        else stall = 0
        if (stall > lagSteps + 90) {
          stall = 0
          backing = 100
          backSteer = -backSteer
        }
      }
      const th = toInput(out[0])
      const st = toInput(out[1])
      sent.push([th / 127, st / 127])
      if (sent.length > lagSteps + 4) sent.shift()
      return [th, st]
    },
  }
}
