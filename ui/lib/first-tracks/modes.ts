/**
 * Easy / Pro tuning for First Tracks. The headless bot
 * (scripts/first-tracks-bot.ts) is the check that Easy stays completable
 * after any change here, in site.ts or in sim.ts.
 *
 * The core mechanic is signal delay: a command reaches the rover `uplink`
 * seconds after it is given, and the picture on screen is `downlink` seconds
 * old. Easy halves the real delay and shows a ghost of where the rover will be
 * when the newest command lands. Pro is the real Earth-Moon light time.
 */

export type ModeId = 'easy' | 'pro'

export type ModeConfig = {
  id: ModeId
  label: string
  /** Seconds a command takes to reach the rover. */
  uplink: number
  /** Seconds the picture takes to come back. */
  downlink: number
  /** Show the translucent rover at the pose the newest command will produce. */
  ghost: boolean
  /** Degrees added to the day's sun elevation: Easy gets shorter shadows. */
  sunBonusDeg: number
  /**
   * The comms window as a share of the day's par time (site.parSeconds): how
   * long a flawless driver with no delay would take to visit every target.
   * Well under 1, so nobody reaches them all and the player has to choose. A
   * hard site gets more time and an easy one less.
   */
  clockFactor: number
  /** Seconds that come off the clock each time the rover hits a rock, a boulder or the lander. */
  hitSeconds: number
  /** Seconds on the clock for a site with no par time worked out (tests only). */
  windowSeconds: number
  scoreMultiplier: number
}

export const MODES: Record<ModeId, ModeConfig> = {
  easy: { id: 'easy', label: 'Easy', uplink: 0.5, downlink: 0.5, ghost: true, sunBonusDeg: 5, clockFactor: 0.62, hitSeconds: 4, windowSeconds: 50, scoreMultiplier: 1 },
  pro: { id: 'pro', label: 'Pro', uplink: 1.3, downlink: 1.3, ghost: false, sunBonusDeg: 0, clockFactor: 0.68, hitSeconds: 4, windowSeconds: 80, scoreMultiplier: 1.25 },
}

export function modeOf(v: unknown): ModeId {
  return v === 'pro' ? 'pro' : 'easy'
}
