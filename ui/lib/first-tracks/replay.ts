/**
 * First Tracks drive tapes: a recording of the throttle and steering inputs,
 * and a way to re-drive it. Same scheme as Touchdown and Catch: the
 * leaderboard never trusts a score from the browser; it re-drives the tape
 * through the same sim and scores what that produces (par included).
 *
 * Tape format: 4 bytes per record, run-length encoded.
 *   [ steps (1..255), throttle + 127, steer + 127, 0 ]
 * Inputs are whole numbers -127..127 and the game feeds the sim those same
 * values, so the replay is exact. The tape holds the inputs as GIVEN on
 * Earth; the sim applies the signal delay itself.
 */
import { siteFor } from './day'
import { base64ToTape, tapeToBase64 } from '@/lib/touchdown/replay'
import { MODES, type ModeId } from './modes'
import { scoreRun, type RunResult } from './scoring'
import { createSim, stepSim, STEP_HZ } from './sim'

export { base64ToTape, tapeToBase64 }

/** Longest run a tape may hold: seven minutes (the egress limit plus the longest Pro clock, with room). */
export const MAX_TAPE_STEPS = STEP_HZ * 420

export function recordTape(tape: number[], steps: number, th: number, st: number): void {
  if (steps <= 0) return
  const a = th + 127
  const b = st + 127
  let left = steps
  const n = tape.length
  if (n >= 4 && tape[n - 3] === a && tape[n - 2] === b && tape[n - 4] < 255) {
    const add = Math.min(left, 255 - tape[n - 4])
    tape[n - 4] += add
    left -= add
  }
  while (left > 0) {
    const chunk = Math.min(255, left)
    tape.push(chunk, a, b, 0)
    left -= chunk
  }
}

/** Re-drive a tape. Null when it is malformed, too long, or ends before the run does. */
export function replayRun(mission: number, mode: ModeId, tape: Uint8Array): RunResult | null {
  const sim = createSim(siteFor(mission), MODES[mode])
  let total = 0
  for (let i = 0; i + 3 < tape.length && !sim.outcome; i += 4) {
    const steps = tape[i]
    if (steps === 0 || tape[i + 1] > 254 || tape[i + 2] > 254 || tape[i + 3] !== 0) return null
    total += steps
    if (total > MAX_TAPE_STEPS) return null
    const th = tape[i + 1] - 127
    const st = tape[i + 2] - 127
    for (let s = 0; s < steps && !sim.outcome; s++) stepSim(sim, th, st)
  }
  if (!sim.outcome) return null
  return scoreRun(sim)
}
