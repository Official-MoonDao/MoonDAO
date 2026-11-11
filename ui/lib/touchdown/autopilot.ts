/**
 * Key-pressing bot for Touchdown. It only sees what a player sees (position,
 * velocity, attitude, fuel) and only acts through the same stick + BURN input,
 * so it is a fair check that a mode is landable. Used by scripts/touchdown-bot.ts
 * and by `?autopilot=1` in the browser.
 *
 * Dependency-free.
 */
import { LUNAR_G } from './modes'
import { altitudeAGL, PAD_DROP, type Sim, type SimInput } from './physics'

export type BotOptions = {
  /** 0..1 — scales how aggressively it brakes and how fast it descends. */
  skill?: number
}

export function botInput(s: Sim, out: SimInput, opts: BotOptions = {}): SimInput {
  const skill = opts.skill ?? 1
  const mode = s.mode
  const tgt = s.terrain.target
  const dx = tgt.x - s.px
  const dz = tgt.z - s.pz
  const dist = Math.hypot(dx, dz)
  const hspeed = Math.hypot(s.vx, s.vz)
  // Never trust the ground right below when higher ground is ahead.
  const alt = Math.min(altitudeAGL(s), s.py - PAD_DROP - tgt.y)

  const maxTilt = ((mode.control === 'angle' ? Math.min(28, mode.maxTiltDeg - 2) : 46) * Math.PI) / 180
  const brake = (mode.control === 'angle' ? 0.55 : 0.85) * skill
  const cruise = mode.startHorizontalSpeed

  // Horizontal: follow a constant-deceleration braking curve into the target.
  const want = (d: number) => {
    const a = Math.abs(d)
    const v = a < 3 ? a * 0.45 : Math.min(cruise, Math.sqrt(2 * brake * a))
    return Math.sign(d) * v
  }
  let axCmd = 1.3 * (want(dx) - s.vx)
  let azCmd = 1.3 * (want(dz) - s.vz)
  // Tilt only works while burning; assume roughly hover-level thrust.
  const lift = LUNAR_G + 0.2
  let tiltX = clamp(Math.atan(axCmd / lift), -maxTilt, maxTilt)
  let tiltZ = clamp(Math.atan(azCmd / lift), -maxTilt, maxTilt)

  // Vertical: descend on a schedule, hold height until over the target.
  let vyWant: number
  const settled = dist < 4 && hspeed < 1
  if (settled) vyWant = alt > 6 ? -2.2 : -0.85
  else {
    // Glide slope: stay above a floor that shrinks as the target gets closer.
    const floor = 5 + 0.45 * dist
    const schedule = alt > 40 ? Math.min(16 * skill + 2, 0.11 * alt + 2) : Math.max(0.6, 0.09 * alt)
    // Above the floor, never sink faster than the engine can arrest while tilted.
    vyWant =
      alt < floor
        ? Math.min(1.5, 0.5 * (floor - alt))
        : -Math.min(schedule, Math.sqrt(2 * 0.55 * (alt - floor)) + 0.3)
  }

  // Close to the ground, stay level unless there is real distance to cover.
  if (alt < 3) {
    tiltX *= 0.4
    tiltZ *= 0.4
  }

  const upY = s.m[4]
  // Behind the braking curve: burn anyway (tilt does nothing with the engine
  // off), accepting a slow climb.
  const overspeed = hspeed - Math.hypot(want(dx), want(dz))
  out.burn = s.vy < vyWant || (overspeed > 1.5 && s.vy < 2.5) || (upY < 0.75 && alt < 60)

  if (mode.control === 'angle') {
    const max = (mode.maxTiltDeg * Math.PI) / 180
    out.y = clamp(tiltX / max, -1, 1)
    out.x = clamp(tiltZ / max, -1, 1)
  } else {
    // Rate command toward the wanted attitude.
    const curX = Math.atan2(s.m[1], s.m[4])
    const curZ = Math.atan2(s.m[7], s.m[4])
    const rate = (mode.maxRateDeg * Math.PI) / 180
    out.y = clamp((2.2 * (tiltX - curX) - 0.4 * -s.wz) / rate, -1, 1)
    out.x = clamp((2.2 * (tiltZ - curZ) - 0.4 * s.wx) / rate, -1, 1)
  }
  return out
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}
