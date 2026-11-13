/**
 * Key-pressing bot for Catch. It only sees what a player sees (position,
 * velocity, attitude, fuel) and only acts through the same stick, BURN and
 * arms inputs, so it is a fair check that a mode is catchable. Used by
 * scripts/catch-bot.ts and by `?autopilot=1` in the browser.
 *
 * Dependency-free.
 */
import { PAD1 } from './layout'
import { pinX, pinY, pinZ, type Sim, type SimInput } from './physics'

export type BotOptions = {
  /** 0..1: scales how hard it brakes and how fast it comes down. */
  skill?: number
}

export function botInput(s: Sim, out: SimInput, opts: BotOptions = {}): SimInput {
  const skill = opts.skill ?? 1
  const mode = s.mode
  const rail = PAD1.railY
  // Aim a little toward the tower side of centre: plenty of rail either way.
  const dx = PAD1.x + 3 - pinX(s)
  const dz = PAD1.z - pinZ(s)
  const dist = Math.hypot(dx, dz)
  const hspeed = Math.hypot(s.vx, s.vz)
  const above = pinY(s) - rail

  const maxTilt = ((mode.control === 'angle' ? mode.maxTiltDeg - 2 : 22) * Math.PI) / 180
  const brake = 1.7 * skill
  const cruise = mode.startHorizontalSpeed + 4

  // Horizontal: a constant-deceleration braking curve into the catch point.
  const want = (d: number) => {
    const a = Math.abs(d)
    const v = a < 4 ? a * 0.5 : Math.min(cruise, Math.sqrt(2 * brake * a))
    return Math.sign(d) * v
  }
  const axCmd = 1.4 * (want(dx) - s.vx)
  const azCmd = 1.4 * (want(dz) - s.vz)
  // Tilt only moves the ship while it is burning; assume about hover thrust.
  const lift = mode.engineAccel * 0.75
  let tiltX = clamp(Math.atan(axCmd / lift), -maxTilt, maxTilt)
  let tiltZ = clamp(Math.atan(azCmd / lift), -maxTilt, maxTilt)

  // Vertical: come down to a hold above the arms, line up, then lower in.
  const settled = dist < 2.2 && hspeed < 1.6
  const hold = 20
  let vyWant: number
  if (settled) vyWant = above > 4 ? -3.4 : -2.2
  else {
    const h = above - hold
    // Net upward acceleration at full burn is about 6.7 m/s²; plan on using most of it.
    vyWant = h > 0 ? -Math.min(60, Math.sqrt(2 * 4.6 * skill * h) + 2.5) : Math.min(2, -0.4 * h)
  }
  // Inside the arms, stay level.
  if (above < 8) {
    tiltX *= 0.5
    tiltZ *= 0.5
  }

  const overspeed = hspeed - Math.hypot(want(dx), want(dz))
  out.burn = s.vy < vyWant || (overspeed > 1.5 && s.vy < 6 && !settled)
  // Pro: close the arms once the aft flaps are through and the pins are near the rails.
  out.arms = dist < 5 && above < 7 && above > 0.5

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
