/**
 * Headless Catch autopilot. Flies the bot through the real physics in each
 * day's conditions and prints what happened, so fuel and difficulty can be
 * re-tuned after any physics change and Easy stays catchable. It also re-flies
 * each recorded tape to prove the replay reproduces the score.
 *
 *   yarn catch:bot                    # missions 1..10, both modes
 *   yarn catch:bot --missions 60      # more days
 *   yarn catch:bot --mode easy --strict   # exit 1 unless every Easy flight is caught
 */
import { botInput } from '../lib/catch/autopilot'
import { conditionsFor } from '../lib/catch/conditions'
import { MODES, type ModeId } from '../lib/catch/modes'
import { createSim, stepSim, SUBSTEP_DT, type SimInput } from '../lib/catch/physics'
import { quantise, recordTape, replayFlight } from '../lib/catch/replay'
import { scoreFlight } from '../lib/catch/scoring'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const missions = Number(flag('missions') ?? 10)
const only = flag('mode') as ModeId | undefined
const strict = args.includes('--strict')
const skill = Number(flag('skill') ?? 1)

let failed = false
for (const modeId of ['easy', 'pro'] as ModeId[]) {
  if (only && only !== modeId) continue
  const mode = MODES[modeId]
  let caught = 0
  let hard = 0
  let scoreSum = 0
  let replayBad = 0
  console.log(`\n${mode.label.toUpperCase()}`)
  for (let mission = 1; mission <= missions; mission++) {
    const c = conditionsFor(mission)
    const sim = createSim(mode, c)
    const input: SimInput = { x: 0, y: 0, burn: false, arms: false }
    const tape: number[] = []
    let steps = 0
    // The bot "presses keys" at 60 Hz like a person's display would allow.
    while (!sim.outcome) {
      if (steps % 4 === 0) {
        botInput(sim, input, { skill })
        input.x = quantise(input.x)
        input.y = quantise(input.y)
      }
      stepSim(sim, input, SUBSTEP_DT)
      recordTape(tape, 1, input.x, input.y, input.burn, input.arms)
      steps++
    }
    const r = scoreFlight(sim)
    const again = replayFlight(mission, modeId, Uint8Array.from(tape))
    if (!again || again.score !== r.score || again.outcome !== r.outcome) replayBad++
    if (r.outcome === 'caught' && !r.hard) caught++
    if (r.hard) hard++
    scoreSum += r.score
    console.log(
      `  #${String(mission).padStart(2)} wind ${c.windFrom.padEnd(3)} ${c.windSpeed.toFixed(1).padStart(4)} m/s  off ${String(c.lateral).padStart(3)} m  ` +
        `${((r.hard ? 'hard catch' : r.outcome) + (r.cause ? ':' + r.cause : '')).padEnd(16)} score ${String(r.score).padStart(5)}  ` +
        `${r.closingSpeed.toFixed(1).padStart(5)} m/s  across ${r.across.toFixed(1).padStart(5)}  along ${r.along.toFixed(1).padStart(5)}  ` +
        `tilt ${r.tiltDeg.toFixed(1).padStart(4)}  margin ${r.armMargin.toFixed(1).padStart(4)}  fuel ${(r.fuelLeft * 100).toFixed(0).padStart(2)}%  ${r.flightSeconds.toFixed(0)} s` +
        (r.damage.length ? `  damage ${r.damage.join(',')}` : '')
    )
  }
  console.log(`  => ${caught}/${missions} caught on the pins, ${hard} on the flaps, mean score ${(scoreSum / missions).toFixed(0)}, replay mismatches ${replayBad}`)
  if (strict && (replayBad > 0 || (modeId === 'easy' && caught < missions))) failed = true
}
if (failed) {
  console.error('\nEasy is not reliably catchable by the bot, or a replay did not match.')
  process.exit(1)
}
