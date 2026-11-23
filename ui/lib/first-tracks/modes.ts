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
  /**
   * Plot-and-send (prototype, /rover?plan=1): the player plots waypoints and
   * the rover drives them itself by wheel odometry. `slip` scales how far loose
   * regolith and cross-slopes carry it off the plotted line, which its
   * odometry cannot see. `sendSeconds` is how long each uplink takes to reach
   * the rover.
   */
  plan?: { slip: number; sendSeconds: number }
}

export const MODES: Record<ModeId, ModeConfig> = {
  easy: { id: 'easy', label: 'Easy', uplink: 0.5, downlink: 0.5, ghost: true, sunBonusDeg: 5, clockFactor: 0.62, hitSeconds: 4, windowSeconds: 50, scoreMultiplier: 1 },
  pro: { id: 'pro', label: 'Pro', uplink: 1.3, downlink: 1.3, ghost: false, sunBonusDeg: 0, clockFactor: 0.68, hitSeconds: 4, windowSeconds: 80, scoreMultiplier: 1.25 },
}

/**
 * Plot-and-send prototype. No joystick lag: the rover follows the plan on
 * board, so the delay is paid once per uplink instead of on every twitch.
 * Scores are not saved in this mode; the server replays Easy and Pro only.
 */
export const PLAN_MODE: ModeConfig = {
  ...MODES.easy,
  label: 'Plan',
  uplink: 0,
  downlink: 0,
  ghost: false,
  // The clock never stops after the first uplink, thinking included.
  clockFactor: 0.75,
  hitSeconds: 8,
  plan: { slip: 1, sendSeconds: 2.6 },
}

export function modeOf(v: unknown): ModeId {
  return v === 'pro' ? 'pro' : 'easy'
}
