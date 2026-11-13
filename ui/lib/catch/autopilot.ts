/**
 * Key-pressing bot for Catch. It only sees what a player sees (position,
 * velocity, attitude, fuel) and only acts through the same stick, BURN and
 * arms inputs, so it is a fair check that a mode is catchable. Used by
 * scripts/catch-bot.ts and by `?autopilot=1` in the browser.
 *
 * Dependency-free.
 */
import { PAD1 } from './layout'
import { EARTH_G } from './modes'
import { pinX, pinY, pinZ, SWEET_MARGIN, SWEET_X, type Sim, type SimInput } from './physics'

export type BotOptions = {
  /** 0..1: scales how hard it brakes and how late it leaves the burn. */
  skill?: number
}

export function botInput(s: Sim, out: SimInput, opts: BotOptions = {}): SimInput {
  const skill = opts.skill ?? 1
  const mode = s.mode
  const rail = PAD1.railY
  const above = pinY(s) - rail
  // Aim a little short of the sweet spot while still high, so the tail never
  // swings in toward the tower, then slide in for the last few metres.
  const dx = SWEET_X - (above > 14 ? 7 : 0) - pinX(s)
  const dz = PAD1.z - pinZ(s)
  const dist = Math.hypot(dx, dz)
  const hspeed = Math.hypot(s.vx, s.vz)
  const net = mode.engineAccel - EARTH_G

  // Lean hard on the way in, gently between the arms: the tail swings toward the tower.
  const maxTilt = ((above < 16 ? 9 : mode.control === 'angle' ? mode.maxTiltDeg - 2 : 20) * Math.PI) / 180
  // The hand-over is set up so a steady lean back all the way down arrives at rest.
  const cruise = mode.startHorizontalSpeed
  // Between the arms there is only a gentle lean to stop with, so creep in.
  const brake = above < 16 ? 0.9 : ((1.3 * cruise * cruise) / (2 * mode.startDistance)) * skill

  // Horizontal: a constant-deceleration braking curve into the sweet spot.
  const want = (d: number) => {
    const a = Math.abs(d)
    const v = a < 3 ? a * 0.6 : Math.min(cruise, Math.sqrt(2 * brake * a))
    return Math.sign(d) * v
  }
  const axCmd = 2.4 * (want(dx) - s.vx)
  const azCmd = 2.0 * (want(dz) - s.vz)
  // Tilt only moves the ship while it is burning, which is most of the way down.
  const lift = mode.engineAccel * 0.85
  let tiltX = clamp(Math.atan(axCmd / lift), -maxTilt, maxTilt)
  let tiltZ = clamp(Math.atan(azCmd / lift), -maxTilt, maxTilt)
  // One lean to spend: braking toward the tower comes first, lining up second.
  const room = Math.sqrt(Math.max(0, maxTilt * maxTilt - tiltX * tiltX))
  tiltZ = clamp(tiltZ, -room, room)

  // Vertical: one braking burn that ends a little above the arms, then lower in.
  // Lined up and nearly still; once the arms have hold, or propellant is short, commit.
  const held = s.hugN && s.hugS
  const low = s.fuel / mode.fuelSeconds < 0.22
  const settled = held || (dist < (low ? 5 : 3) && hspeed < (low ? 3 : 2.2))
  const hold = 7
  let vyWant: number
  if (settled) vyWant = above > 5 ? -4.5 : -2.6
  else {
    const h = above - hold
    // Plan on most of the net deceleration, leaving some for leaning over.
    vyWant = h > 0 ? -(Math.sqrt(2 * 0.78 * skill * net * h) + 2.2) : Math.min(1.5, -0.5 * h)
  }
  if (above < 4) {
    tiltX *= 0.6
    tiltZ *= 0.6
  }
  if (held) {
    // The arms centre the ship; just hold it still along the rails.
    tiltX = clamp(Math.atan((-1.2 * s.vx) / lift), -0.1, 0.1)
    tiltZ = 0
  }

  const overspeed = hspeed - Math.hypot(want(dx), want(dz))
  out.burn = s.vy < vyWant || (overspeed > 1.5 && s.vy < 4 && !settled)
  // Pro: close the arms so they take hold with the pins at the sweet height.
  const sink = s.vy < 0 ? -s.vy : 0
  out.arms = dist < 4.5 && above > 0.5 && above < SWEET_MARGIN + 0.6 + sink * mode.armCloseSeconds

  if (mode.control === 'angle') {
    const max = (mode.maxTiltDeg * Math.PI) / 180
    out.y = clamp(tiltX / max, -1, 1)
    out.x = clamp(tiltZ / max, -1, 1)
  } else {
    // Rate command toward the wanted attitude.
    const curX = Math.atan2(s.m[1], s.m[4])
    const curZ = Math.atan2(s.m[7], s.m[4])
    const rate = (mode.maxRateDeg * Math.PI) / 180
    out.y = clamp((2.4 * (tiltX - curX) - 0.5 * -s.wz) / rate, -1, 1)
    out.x = clamp((2.4 * (tiltZ - curZ) - 0.5 * s.wx) / rate, -1, 1)
  }
  return out
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}
