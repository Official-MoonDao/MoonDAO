/**
 * Catch flight tapes: a recording of the stick, BURN and arms inputs, and a
 * way to re-fly it. Same scheme as Touchdown: the leaderboard never trusts a
 * score from the browser; it re-flies the tape through the same physics.
 *
 * Tape format: 4 bytes per record, run-length encoded.
 *   [ substeps (1..255), stick x + 127, stick y + 127, flags ]
 * Flags: bit 0 burn, bit 1 arms. The stick is quantised to 1/127 steps and
 * the game feeds the sim those same values, so the replay is exact.
 */
import { base64ToTape, quantise, tapeToBase64 } from '@/lib/touchdown/replay'
import { conditionsFor } from './conditions'
import { MODES, type ModeId } from './modes'
import { createSim, stepSim, SUBSTEP_DT, SUBSTEP_HZ, type SimInput } from './physics'
import { scoreFlight, type FlightResult } from './scoring'

export { base64ToTape, quantise, tapeToBase64 }

/** Longest flight a tape may hold. */
export const MAX_TAPE_STEPS = SUBSTEP_HZ * 160

export function recordTape(tape: number[], steps: number, x: number, y: number, burn: boolean, arms: boolean): void {
  if (steps <= 0) return
  const bx = Math.round(quantise(x) * 127) + 127
  const by = Math.round(quantise(y) * 127) + 127
  const bb = (burn ? 1 : 0) | (arms ? 2 : 0)
  let left = steps
  const n = tape.length
  if (n >= 4 && tape[n - 3] === bx && tape[n - 2] === by && tape[n - 1] === bb && tape[n - 4] < 255) {
    const add = Math.min(left, 255 - tape[n - 4])
    tape[n - 4] += add
    left -= add
  }
  while (left > 0) {
    const chunk = Math.min(255, left)
    tape.push(chunk, bx, by, bb)
    left -= chunk
  }
}

/** Re-fly a tape. Null when it is malformed, too long, or ends before the flight does. */
export function replayFlight(mission: number, mode: ModeId, tape: Uint8Array): FlightResult | null {
  const sim = createSim(MODES[mode], conditionsFor(mission))
  const input: SimInput = { x: 0, y: 0, burn: false, arms: false }
  let total = 0
  for (let i = 0; i + 3 < tape.length && !sim.outcome; i += 4) {
    const steps = tape[i]
    if (steps === 0 || tape[i + 1] > 254 || tape[i + 2] > 254 || tape[i + 3] > 3) return null
    total += steps
    if (total > MAX_TAPE_STEPS) return null
    input.x = (tape[i + 1] - 127) / 127
    input.y = (tape[i + 2] - 127) / 127
    input.burn = (tape[i + 3] & 1) === 1
    input.arms = (tape[i + 3] & 2) === 2
    for (let s = 0; s < steps && !sim.outcome; s++) stepSim(sim, input, SUBSTEP_DT)
  }
  if (!sim.outcome) return null
  return scoreFlight(sim)
}
