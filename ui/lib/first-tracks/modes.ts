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

import type { TargetKind } from './site'

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
   * The whole comms window, bonuses included, as a multiple of the day's par
   * time (site.parSeconds): how long a flawless driver with no delay would
   * take. The clock that shows at the start is this less every bonus, so a
   * hard site gets more time and an easy one less.
   */
  clockFactor: number
  /** Seconds on the clock for a site with no par time worked out (tests only). */
  windowSeconds: number
  /** Seconds each finished job adds, by kind. */
  bonusSeconds: Record<TargetKind, number>
  scoreMultiplier: number
  /**
   * Plot-and-send (prototype, /rover?plan=1): the player plots waypoints and
   * the rover drives them itself by wheel odometry. `slip` scales how far loose
   * regolith and cross-slopes carry it off the plotted line, which its
   * odometry cannot see. `sendSeconds` is how long each uplink takes to reach
   * the rover. `hitSeconds` comes off the clock each time it hits a rock, a
   * boulder or the lander.
   */
  plan?: { slip: number; sendSeconds: number; hitSeconds: number }
}

const BONUS: Record<TargetKind, number> = { image: 10, rock: 14, ice: 20 }

export const MODES: Record<ModeId, ModeConfig> = {
  easy: { id: 'easy', label: 'Easy', uplink: 0.5, downlink: 0.5, ghost: true, sunBonusDeg: 5, clockFactor: 1.25, windowSeconds: 50, bonusSeconds: BONUS, scoreMultiplier: 1 },
  pro: { id: 'pro', label: 'Pro', uplink: 1.3, downlink: 1.3, ghost: false, sunBonusDeg: 0, clockFactor: 1.35, windowSeconds: 80, bonusSeconds: BONUS, scoreMultiplier: 1.25 },
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
  // The clock never stops once the rover is off the ramp, thinking included,
  // and jobs pay no time back: the window is too short for every target, so
  // the player has to choose which ones to go for.
  clockFactor: 1.15,
  bonusSeconds: { image: 0, rock: 0, ice: 0 },
  plan: { slip: 1, sendSeconds: 2.6, hitSeconds: 8 },
}

export function modeOf(v: unknown): ModeId {
  return v === 'pro' ? 'pro' : 'easy'
}
