/**
 * Flight tapes: a recording of the stick and BURN inputs, and a way to re-fly
 * it. The leaderboard never trusts a score from the browser; it re-flies the
 * tape on the server through the same physics and stores what that produces.
 *
 * Tape format: 4 bytes per record, run-length encoded.
 *   [ substeps (1..255), stick x + 127, stick y + 127, burn (0|1) ]
 * The stick is quantised to 1/127 steps, and the game feeds the sim those
 * same quantised values, so the replay is exact.
 *
 * Dependency-free apart from the game core.
 */
import { missionSeed } from './mission'
import { MODES, type ModeId } from './modes'
import { createSim, stepSim, SUBSTEP_DT, SUBSTEP_HZ, type SimInput } from './physics'
import { scoreFlight, type FlightResult } from './scoring'
import { lateralOffsetFor } from './setup'
import { generateTerrain, type Terrain } from './terrain'

/** Longest flight a tape may hold: seven minutes of substeps. */
export const MAX_TAPE_STEPS = SUBSTEP_HZ * 420
export const MAX_TAPE_BYTES = 4 * 60 * 420

/** Quantise a stick axis the way the tape stores it. */
export function quantise(v: number): number {
  const c = v < -1 ? -1 : v > 1 ? 1 : v
  return Math.round(c * 127) / 127
}

/** Append `steps` substeps of one input to a tape, merging with the last record when it matches. */
export function recordTape(tape: number[], steps: number, x: number, y: number, burn: boolean): void {
  if (steps <= 0) return
  const bx = Math.round(quantise(x) * 127) + 127
  const by = Math.round(quantise(y) * 127) + 127
  const bb = burn ? 1 : 0
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

export function tapeToBase64(tape: number[]): string {
  let s = ''
  for (let i = 0; i < tape.length; i++) s += String.fromCharCode(tape[i] & 255)
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')
}

export function base64ToTape(b64: unknown): Uint8Array | null {
  if (typeof b64 !== 'string' || b64.length === 0 || b64.length > MAX_TAPE_BYTES * 1.4) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null
  try {
    const bytes =
      typeof Buffer !== 'undefined'
        ? new Uint8Array(Buffer.from(b64, 'base64'))
        : Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    if (bytes.length === 0 || bytes.length % 4 !== 0 || bytes.length > MAX_TAPE_BYTES) return null
    return bytes
  } catch {
    return null
  }
}

// Terrain is the expensive part (tens of ms); keep the last few days in memory.
const terrainCache = new Map<number, Terrain>()
function terrainFor(mission: number): Terrain {
  let t = terrainCache.get(mission)
  if (!t) {
    t = generateTerrain(missionSeed(mission))
    terrainCache.set(mission, t)
    if (terrainCache.size > 3) terrainCache.delete(terrainCache.keys().next().value as number)
  }
  return t
}

/**
 * Re-fly a tape. Returns the result the physics produces, or null when the
 * tape is malformed, too long, or ends before the flight does.
 */
export function replayFlight(mission: number, mode: ModeId, tape: Uint8Array): FlightResult | null {
  const seed = missionSeed(mission)
  const sim = createSim(terrainFor(mission), MODES[mode], lateralOffsetFor(seed))
  const input: SimInput = { x: 0, y: 0, burn: false }
  let total = 0
  for (let i = 0; i + 3 < tape.length && !sim.outcome; i += 4) {
    const steps = tape[i]
    if (steps === 0 || tape[i + 1] > 254 || tape[i + 2] > 254 || tape[i + 3] > 1) return null
    total += steps
    if (total > MAX_TAPE_STEPS) return null
    input.x = (tape[i + 1] - 127) / 127
    input.y = (tape[i + 2] - 127) / 127
    input.burn = tape[i + 3] === 1
    for (let s = 0; s < steps && !sim.outcome; s++) stepSim(sim, input, SUBSTEP_DT)
  }
  if (!sim.outcome) return null
  return scoreFlight(sim)
}
