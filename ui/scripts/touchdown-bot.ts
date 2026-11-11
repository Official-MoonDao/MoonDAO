/**
 * Headless Touchdown autopilot. Flies the bot through real physics on real
 * daily maps and prints what happened, so fuel and difficulty can be re-tuned
 * after any physics change and Easy stays landable.
 *
 *   yarn touchdown:bot                 # missions 1..8, both modes
 *   yarn touchdown:bot --missions 30   # more maps
 *   yarn touchdown:bot --mode easy --strict   # exit 1 unless every Easy flight lands upright
 */
import { botInput } from '../lib/touchdown/autopilot'
import { missionSeed } from '../lib/touchdown/mission'
import { MODES, type ModeId } from '../lib/touchdown/modes'
import { createSim, stepSim, SUBSTEP_DT, type SimInput } from '../lib/touchdown/physics'
import { isUpright, scoreFlight } from '../lib/touchdown/scoring'
import { lateralOffsetFor } from '../lib/touchdown/setup'
import { generateTerrain } from '../lib/touchdown/terrain'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const missions = Number(flag('missions') ?? 8)
const only = flag('mode') as ModeId | undefined
const strict = args.includes('--strict')

let failed = false
for (const modeId of ['easy', 'pro'] as ModeId[]) {
  if (only && only !== modeId) continue
  const mode = MODES[modeId]
  let upright = 0
  let scoreSum = 0
  console.log(`\n${mode.label.toUpperCase()}`)
  for (let mission = 1; mission <= missions; mission++) {
    const t0 = Date.now()
    const seed = missionSeed(mission)
    const terrain = generateTerrain(seed)
    const genMs = Date.now() - t0
    const sim = createSim(terrain, mode, lateralOffsetFor(seed))
    const input: SimInput = { x: 0, y: 0, burn: false }
    let steps = 0
    // The bot "presses keys" at 60 Hz like a person's display would allow.
    while (!sim.outcome && sim.t < 400) {
      if (steps % 8 === 0) botInput(sim, input)
      stepSim(sim, input, SUBSTEP_DT)
      steps++
    }
    const r = scoreFlight(sim)
    if (isUpright(r.outcome)) upright++
    scoreSum += r.score
    console.log(
      `  #${String(mission).padStart(2)} ${r.outcome.padEnd(8)} score ${String(r.score).padStart(4)}  ` +
        `${r.distance.toFixed(1).padStart(6)} m off  ${r.touchdownSpeed.toFixed(2)} m/s  ` +
        `fuel ${(r.fuelLeft * 100).toFixed(0).padStart(2)}%  tilt ${r.tiltDeg.toFixed(1)}°  ` +
        `${r.flightSeconds.toFixed(0)} s  (terrain ${genMs} ms)`
    )
  }
  console.log(`  => ${upright}/${missions} upright, mean score ${(scoreSum / missions).toFixed(0)}`)
  if (strict && modeId === 'easy' && upright < missions) failed = true
}
if (failed) {
  console.error('\nEasy is not reliably landable by the bot.')
  process.exit(1)
}
