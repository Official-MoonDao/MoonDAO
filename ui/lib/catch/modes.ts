/**
 * Easy / Pro tuning for Catch. The headless bot (scripts/catch-bot.ts) is the
 * check that Easy stays catchable after any change here or in physics.ts.
 *
 * How it flies, following real tower catches:
 *
 *  - After the flip the engines stay lit all the way down. Released, they idle
 *    at part throttle and the ship keeps sinking at about the speed it has;
 *    holding BURN takes them to full thrust and slows it.
 *  - The ship stays upright. Steering swivels the engines: the flame swings
 *    out to one side and pushes the ship the other way, so it slides across
 *    without tipping over.
 *  - The ship arrives leaning on its engines the whole way: about fifteen to
 *    twenty seconds from the flip to the arms.
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
  /** Share of full thrust the engines idle at when BURN is released. */
  idleThrottle: number
  /** Seconds of full-thrust burn aboard; idling uses it more slowly. */
  fuelSeconds: number
  /** degrees the engines swivel at full stick */
  maxGimbalDeg: number
  /** true: the flight computer goes to full thrust by itself at the last point the ship can still stop */
  brakeAssist: boolean
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
    startAltitude: 620,
    startDistance: 230,
    startHorizontalSpeed: 27,
    startVerticalSpeed: -48,
    engineAccel: 20,
    idleThrottle: 0.5,
    fuelSeconds: 20,
    maxGimbalDeg: 18,
    brakeAssist: true,
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
    startAltitude: 700,
    startDistance: 300,
    startHorizontalSpeed: 33,
    startVerticalSpeed: -62,
    engineAccel: 16,
    idleThrottle: 0.45,
    fuelSeconds: 20,
    maxGimbalDeg: 16,
    brakeAssist: false,
    autoArms: false,
    armCloseSeconds: 1.3,
    pinLimit: 9,
    windFactor: 1,
    coaching: false,
    scoreMultiplier: 1.25,
  },
}

export const EARTH_G = 9.81
