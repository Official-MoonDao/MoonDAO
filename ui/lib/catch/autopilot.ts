/**
 * Key-pressing bot for Catch. It only sees what a player sees (position,
 * velocity, fuel, the arms) and only acts through the same stick, BURN and
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
  // Aim a little short of the sweet spot while still high, then slide in.
  const dx = SWEET_X - (above > 18 ? 5 : 0) - pinX(s)
  const dz = PAD1.z - pinZ(s)
  const dist = Math.hypot(dx, dz)
  const hspeed = Math.hypot(s.vx, s.vz)
  const maxG = (mode.maxGimbalDeg * Math.PI) / 180
  // Swivelled over to brake, the engines give this much sideways and this much up.
  const lateral = mode.engineAccel * Math.sin(maxG * 0.8)
  const netUp = mode.engineAccel * Math.cos(maxG * 0.8) - EARTH_G

  // Horizontal: a constant-deceleration braking curve into the sweet spot.
  const brake = above < 18 ? 0.9 : 0.6 * lateral * skill
  const want = (d: number) => {
    const a = Math.abs(d)
    const v = a < 3 ? a * 0.6 : Math.sqrt(2 * brake * a)
    return Math.sign(d) * v
  }
  // Never speed up toward the tower: only shed speed, or creep when close.
  const wx = dx > 0 && s.vx > 0 ? Math.min(want(dx), Math.max(s.vx, 6)) : want(dx)
  const axCmd = 2.2 * (wx - s.vx)
  const azCmd = 2.0 * (want(dz) - s.vz)
  const thrust = mode.engineAccel * 0.9
  let gx = clamp(Math.atan(axCmd / thrust), -maxG, maxG)
  const room = Math.sqrt(Math.max(0, maxG * maxG - gx * gx))
  let gz = clamp(Math.atan(azCmd / thrust), -room, room)

  // Vertical: fall, then one braking burn that ends a little above the arms.
  const held = s.hugN && s.hugS
  const low = s.fuel / mode.fuelSeconds < 0.2
  const settled = held || (dist < (low ? 5 : 3) && hspeed < (low ? 3 : 2.2))
  // BURN cannot hover or climb in either mode, so stop a little high and use the slow sink to line up.
  const hold = mode.sinkFloor > 0 ? 16 : 13
  let vyWant: number
  if (settled) vyWant = above > 5 ? -4.5 : -2.6
  else {
    const h = above - hold
    vyWant = h > 0 ? -(Math.sqrt(2 * 0.74 * skill * netUp * h) + 2.2) : Math.min(1.5, -0.5 * h)
  }
  if (held) {
    // The arms centre the ship; just hold it still along the rails.
    gx = clamp(Math.atan((-1.2 * s.vx) / thrust), -0.1, 0.1)
    gz = 0
  }
  // The swivel only pushes while the engines burn, so burn for braking too
  // when the ship is behind its braking curve.
  const overspeed = hspeed - Math.hypot(wx, want(dz))
  const needSideways = overspeed > 2.5 && (mode.sinkFloor > 0 ? above < 420 : s.vy < 3)
  out.burn = s.vy < vyWant || needSideways
  // Pro: close the arms so they take hold with the pins at the sweet height.
  const sink = s.vy < 0 ? -s.vy : 0
  out.arms = dist < 4.5 && above > 0.5 && above < SWEET_MARGIN + 0.6 + sink * mode.armCloseSeconds
  out.y = clamp(gx / maxG, -1, 1)
  out.x = clamp(gz / maxG, -1, 1)
  return out
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}
