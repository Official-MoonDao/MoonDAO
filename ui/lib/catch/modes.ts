/**
 * Easy / Pro tuning for Catch. The headless bot (scripts/catch-bot.ts) is the
 * check that Easy stays catchable after any change here or in physics.ts.
 *
 * The numbers follow real tower catches: one committed landing burn at about
 * one and a half times the ship's weight, taking it from roughly 170 km/h to
 * rest in ten to twelve seconds while it leans back and slides in toward the
 * arms. There is only enough propellant for that burn and a few seconds of
 * margin, so there is no hovering to line up: the arrival has to be flown.
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
  /** degrees leaning back against the direction of travel */
  startPitchDeg: number
  /** m/s², landing engines at full thrust */
  engineAccel: number
  /** seconds of burn */
  fuelSeconds: number
  /** 'angle': stick = tilt angle, self-levels. 'rate': stick = rotation rate, attitude hold. */
  control: 'angle' | 'rate'
  /** degrees, Easy stick full deflection */
  maxTiltDeg: number
  /** deg/s, Pro stick full deflection */
  maxRateDeg: number
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
    startAltitude: 365,
    startDistance: 140,
    startHorizontalSpeed: 25,
    startVerticalSpeed: -46,
    startPitchDeg: 12,
    engineAccel: 17,
    fuelSeconds: 14,
    control: 'angle',
    maxTiltDeg: 20,
    maxRateDeg: 0,
    autoArms: true,
    armCloseSeconds: 1.0,
    pinLimit: 12,
    windFactor: 0.6,
    coaching: true,
    scoreMultiplier: 1,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    startAltitude: 430,
    startDistance: 195,
    startHorizontalSpeed: 31,
    startVerticalSpeed: -55,
    startPitchDeg: 14,
    engineAccel: 14.8,
    fuelSeconds: 14.5,
    control: 'rate',
    maxTiltDeg: 0,
    maxRateDeg: 24,
    autoArms: false,
    armCloseSeconds: 1.3,
    pinLimit: 10,
    windFactor: 1,
    coaching: false,
    scoreMultiplier: 1.25,
  },
}

export const EARTH_G = 9.81
