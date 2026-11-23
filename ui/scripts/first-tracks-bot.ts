/**
 * Headless First Tracks drivers. Runs scripted drivers through the real sim
 * and signal delay on each day's site and prints what happened, so the clock,
 * battery and scoring can be re-tuned after any change. It also re-drives each
 * recorded tape to prove the replay reproduces the score.
 *
 *   yarn first-tracks:bot                       # missions 1..10, both modes, every driver
 *   yarn first-tracks:bot --missions 60         # more days
 *   yarn first-tracks:bot --driver careful      # one driver
 *   yarn first-tracks:bot --mode easy --strict  # exit 1 unless the perfect driver averages at least 5 jobs a site
 *   yarn first-tracks:bot --verbose             # one line per run
 */
import { siteFor } from '../lib/first-tracks/day'
import { createDriver, DRIVER_KINDS, type DriverKind } from '../lib/first-tracks/autopilot'
import { MODES, type ModeId } from '../lib/first-tracks/modes'
import { MAX_TAPE_STEPS, recordTape, replayRun } from '../lib/first-tracks/replay'
import { scoreRun } from '../lib/first-tracks/scoring'
import { createSim, stepSim } from '../lib/first-tracks/sim'
import { N_TARGETS } from '../lib/first-tracks/site'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const missions = Number(flag('missions') ?? 10)
const from = Number(flag('from') ?? 1)
const onlyMode = flag('mode') as ModeId | undefined
const onlyDriver = flag('driver') as DriverKind | undefined
const strict = args.includes('--strict')
const verbose = args.includes('--verbose')

let failed = false
for (const modeId of ['easy', 'pro'] as ModeId[]) {
  if (onlyMode && onlyMode !== modeId) continue
  const mode = MODES[modeId]
  console.log(`\n${mode.label.toUpperCase()}`)
  for (const kind of DRIVER_KINDS) {
    if (onlyDriver && onlyDriver !== kind) continue
    const scores: number[] = []
    const outcomes: Record<string, number> = {}
    let imaged = 0
    let cleared = 0
    let replayBad = 0
    let short = 0
    let parts = { targets: 0, route: 0, battery: 0, time: 0 }
    let batteryLeft = 0
    for (let mission = from; mission < from + missions; mission++) {
      const site = siteFor(mission)
      if (site.targets.length < N_TARGETS) short++
      const sim = createSim(site, mode)
      const driver = createDriver(kind, site, mode)
      const tape: number[] = []
      while (!sim.outcome && sim.steps < MAX_TAPE_STEPS) {
        const [th, st] = driver.input(sim)
        stepSim(sim, th, st)
        recordTape(tape, 1, th, st)
      }
      const r = scoreRun(sim)
      const again = replayRun(mission, modeId, Uint8Array.from(tape))
      if (!again || again.score !== r.score || again.outcome !== r.outcome) replayBad++
      scores.push(r.score)
      outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1
      imaged += r.imaged
      if (r.outcome === 'complete') cleared++
      parts = { targets: parts.targets + r.parts.targets, route: parts.route + r.parts.route, battery: parts.battery + r.parts.battery, time: parts.time + r.parts.time }
      batteryLeft += r.batteryLeft
      if (verbose) {
        console.log(
          `    #${String(mission).padStart(3)} ${kind.padEnd(8)} ${r.outcome.padEnd(9)} score ${String(r.score).padStart(5)}  ${r.imaged}/${N_TARGETS}  ` +
            `T ${String(r.parts.targets).padStart(3)} R ${String(r.parts.route).padStart(3)} B ${String(r.parts.battery).padStart(3)} +${String(r.parts.time).padStart(3)}  ` +
            `${r.metres.toFixed(0).padStart(4)} m  batt ${(r.batteryLeft * 100).toFixed(0).padStart(3)}%  ${r.driveSeconds.toFixed(0).padStart(3)} s  bumps ${r.bumps}`
        )
      }
    }
    scores.sort((a, b) => a - b)
    const q = (f: number) => scores[Math.min(scores.length - 1, Math.floor(f * scores.length))]
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const n = missions
    console.log(
      `  ${kind.padEnd(8)} mean ${mean.toFixed(0).padStart(5)}  min ${String(scores[0]).padStart(5)}  median ${String(q(0.5)).padStart(5)}  max ${String(scores[scores.length - 1]).padStart(5)}  ` +
        `targets ${(imaged / n).toFixed(1)}/${N_TARGETS}  cleared ${cleared}/${n}  ` +
        `T ${(parts.targets / n).toFixed(0)} R ${(parts.route / n).toFixed(0)} B ${(parts.battery / n).toFixed(0)} +${(parts.time / n).toFixed(0)}  batt left ${((batteryLeft / n) * 100).toFixed(0)}%  ` +
        `${Object.entries(outcomes)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')}` +
        (replayBad ? `  REPLAY MISMATCHES ${replayBad}` : '') +
        (short ? `  SITES SHORT OF TARGETS ${short}` : '')
    )
    if (strict && (replayBad > 0 || short > 0 || (kind === 'perfect' && imaged < n * 5))) failed = true
  }
}
if (failed) {
  console.error('\nThe perfect driver averaged fewer than 5 jobs a site, a site was short of targets, or a replay did not match.')
  process.exit(1)
}
