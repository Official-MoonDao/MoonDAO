/**
 * Easy / Pro tuning for Catch. The headless bot (scripts/catch-bot.ts) is the
 * check that Easy stays catchable after any change here or in physics.ts.
 *
 * How it flies:
 *
 *  - Gravity never stops. The engines stay lit after the flip but only idle:
 *    let go of BURN and the ship still falls.
 *  - BURN takes the engines to full thrust: it is the brake. On Easy the flight
 *    computer eases the throttle back once the ship is down to a crawl, so
 *    holding BURN settles into a slow sink and never sends it back up.
 *  - The ship stays upright. Steering swivels the engines while they burn: the
 *    flame swings out one way and pushes the ship the other.
 *  - It comes in high, fast and at a steep slant over the launch site. Leave
 *    the braking too late and it sails past the tower toward the Gulf.
 */

export type ModeId = 'easy' | 'pro'

export type ModeConfig = {
  id: ModeId
  label: string
  /** m, height of the ship's centre of mass at hand-over */
  startAltitude: number
  /** m west of the catch point at hand-over */
  startDistance: number
  /** m/s toward the tower */
  startHorizontalSpeed: number
  /** m/s, negative is down */
  startVerticalSpeed: number
  /** m/s², landing engines at full thrust */
  engineAccel: number
  /** Share of full thrust the engines idle at when BURN is released: well short of the ship's weight. */
  idleThrottle: number
  /** Seconds of full-thrust burn aboard; idling uses it more slowly. */
  fuelSeconds: number
  /** degrees the engines swivel at full stick */
  maxGimbalDeg: number
  /**
   * m/s. Above zero, holding BURN brakes down to this sink rate and then
   * holds it, so the ship never climbs. Zero: BURN is always full thrust.
   */
  sinkFloor: number
  /** true: the arms close by themselves once the ship is in the catch zone */
  autoArms: boolean
  /** seconds for the arms to swing from open to closed */
  armCloseSeconds: number
  /** m/s onto the rails that shears the catch pins off */
  pinLimit: number
  /** Scales the day's wind. */
  windFactor: number
  coaching: boolean
  scoreMultiplier: number
}

export const MODES: Record<ModeId, ModeConfig> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    startAltitude: 800,
    startDistance: 520,
    startHorizontalSpeed: 44,
    startVerticalSpeed: -58,
    engineAccel: 17,
    idleThrottle: 0.16,
    fuelSeconds: 30,
    maxGimbalDeg: 22,
    sinkFloor: 1.2,
    autoArms: true,
    armCloseSeconds: 1.0,
    pinLimit: 12,
    windFactor: 0.5,
    coaching: true,
    scoreMultiplier: 1,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    startAltitude: 900,
    startDistance: 640,
    startHorizontalSpeed: 52,
    startVerticalSpeed: -68,
    engineAccel: 15.5,
    idleThrottle: 0.16,
    fuelSeconds: 25,
    maxGimbalDeg: 20,
    sinkFloor: 0,
    autoArms: false,
    armCloseSeconds: 1.3,
    pinLimit: 9,
    windFactor: 1,
    coaching: false,
    scoreMultiplier: 1.25,
  },
}

export const EARTH_G = 9.81
