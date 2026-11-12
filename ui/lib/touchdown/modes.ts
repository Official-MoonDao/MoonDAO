/**
 * Easy / Pro tuning. Numbers start from the prototype's table; the headless
 * bot (yarn touchdown:bot) is the check that Easy stays landable after any
 * change here or in physics.ts.
 */

export type ModeId = 'easy' | 'pro'

export type ModeConfig = {
  id: ModeId
  label: string
  /** m above the target's ground height */
  startAltitude: number
  /** m, horizontal distance to target at start */
  startDistance: number
  /** m/s toward the target */
  startHorizontalSpeed: number
  /** m/s, negative is down */
  startVerticalSpeed: number
  /** degrees pitched back (thrust vector leaning against the direction of travel) */
  startPitchDeg: number
  /** m/s², main engine */
  engineAccel: number
  /** seconds of burn */
  fuelSeconds: number
  /** m/s along the contact normal that collapses a leg */
  legCollapseSpeed: number
  /** m/s on any hull point (or 2× on a pad) that breaks the vehicle apart */
  breakupSpeed: number
  /** 'angle': stick = tilt angle, self-levels. 'rate': stick = rotation rate, attitude hold. */
  control: 'angle' | 'rate'
  /** degrees, Easy stick full deflection */
  maxTiltDeg: number
  /** deg/s, Pro stick full deflection */
  maxRateDeg: number
  coaching: boolean
  scoreMultiplier: number
}

export const MODES: Record<ModeId, ModeConfig> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    startAltitude: 400,
    startDistance: 560,
    startHorizontalSpeed: 22,
    startVerticalSpeed: -4,
    startPitchDeg: 20,
    engineAccel: 2.9,
    fuelSeconds: 50,
    legCollapseSpeed: 5.0,
    breakupSpeed: 11,
    control: 'angle',
    maxTiltDeg: 50,
    maxRateDeg: 0,
    coaching: true,
    scoreMultiplier: 1,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    startAltitude: 620,
    startDistance: 900,
    startHorizontalSpeed: 36,
    startVerticalSpeed: -6,
    startPitchDeg: 49,
    engineAccel: 2.9,
    fuelSeconds: 68,
    legCollapseSpeed: 4.0,
    breakupSpeed: 9,
    control: 'rate',
    maxTiltDeg: 0,
    maxRateDeg: 28,
    coaching: false,
    scoreMultiplier: 1.25,
  },
}

export const LUNAR_G = 1.62
/** A vehicle resting at more than this is "tipped over". */
export const TIPPED_TILT_DEG = 20
