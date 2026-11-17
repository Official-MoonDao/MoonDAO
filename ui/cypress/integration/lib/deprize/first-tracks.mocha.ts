/// <reference types="node" />
/**
 * First Tracks pure logic: the daily site, the sim, par, scoring and replay.
 * The game's leaderboard re-drives recorded inputs on the server, so the
 * properties that matter most are determinism and replay agreement.
 */
import { siteFor } from '@/lib/first-tracks/day'
import { createDriver } from '@/lib/first-tracks/autopilot'
import { MODES } from '@/lib/first-tracks/modes'
import { parEnergy, parPath, pathLength } from '@/lib/first-tracks/par'
import { base64ToTape, MAX_TAPE_STEPS, recordTape, replayRun, tapeToBase64 } from '@/lib/first-tracks/replay'
import { CONDITION, KIND_POINTS, maxScore, scoreRun } from '@/lib/first-tracks/scoring'
import { createSim, EGRESS_LIMIT_STEPS, ghostOf, holdSteps, stepSim, windowSecondsFor, type Sim } from '@/lib/first-tracks/sim'
import { BUMP_MIN, CLEAR, DECK_Y, dist, generateSite, KIND_COUNT, MAX_TOUR, N_TARGETS, RAMP_FOOT, shortestTour, TARGET_RING } from '@/lib/first-tracks/site'

function drive(mission: number, modeId: 'easy' | 'pro', kind: 'perfect' | 'average' | 'careful' | 'sloppy') {
  const site = siteFor(mission)
  const mode = MODES[modeId]
  const sim = createSim(site, mode)
  const driver = createDriver(kind, site, mode)
  const tape: number[] = []
  while (!sim.outcome && sim.steps < MAX_TAPE_STEPS) {
    const [th, st] = driver.input(sim)
    stepSim(sim, th, st)
    recordTape(tape, 1, th, st)
  }
  return { sim, tape, result: scoreRun(sim) }
}

describe('first tracks: daily site', () => {
  it('builds the same site twice for one mission', () => {
    const a = generateSite(7)
    const b = generateSite(7)
    expect(a.targets).to.deep.equal(b.targets)
    expect(a.craters).to.deep.equal(b.craters)
    expect(a.rocks.length).to.equal(b.rocks.length)
    expect(a.rocks[40]).to.deep.equal(b.rocks[40])
    expect(a.startHeading).to.equal(b.startHeading)
    expect(a.ground(12.3, -4.5)).to.equal(b.ground(12.3, -4.5))
  })

  it('changes the craters, rocks and science targets from day to day', () => {
    const a = generateSite(3)
    const b = generateSite(4)
    expect(a.targets).to.not.deep.equal(b.targets)
    expect(a.craters).to.not.deep.equal(b.craters)
    expect(a.rocks[0]).to.not.deep.equal(b.rocks[0])
  })

  it('gives every day eight targets in a web a driver can finish', () => {
    for (let mission = 1; mission <= 60; mission++) {
      const site = generateSite(mission)
      expect(site.targets.length, `mission ${mission}`).to.equal(N_TARGETS)
      expect(shortestTour(site.targets, RAMP_FOOT[0], RAMP_FOOT[1]).length <= MAX_TOUR, `mission ${mission} tour`).to.equal(true)
      for (const t of site.targets) {
        // No rock tall enough to stop the rover sits inside a target's ring.
        site.hazards.forEach((list) => {
          for (const r of list) expect(dist(r.x, r.z, t.x, t.z) >= TARGET_RING, `mission ${mission} rock in ring`).to.equal(true)
        })
      }
    }
  })

  it('keeps the lander on level ground and parks the rover across the deck', () => {
    for (let mission = 1; mission <= 20; mission++) {
      const site = generateSite(mission)
      expect(Math.abs(site.ground(0, 0)) < 1e-9).to.equal(true)
      expect(Math.abs(site.ground(0, 3.2)) < 0.05).to.equal(true)
      expect(Math.abs(site.startHeading) >= 1).to.equal(true)
      for (const r of site.rocks) if (r.h > CLEAR) expect(dist(r.x, r.z, 0, -1.2) >= 7.5).to.equal(true)
    }
  })

  it('finds the shortest visiting order', () => {
    const line = [0, 1, 2, 3].map((i) => ({ x: 0, z: 10 * (i + 1), kind: 'image' as const }))
    const shuffled = [line[2], line[0], line[3], line[1]]
    const tour = shortestTour(shuffled, 0, 0)
    expect(tour.length).to.equal(40)
    expect(tour.order).to.deep.equal([1, 3, 0, 2])
  })
})

describe('first tracks: sim', () => {
  it('starts parked on the deck with the clock stopped', () => {
    const sim = createSim(siteFor(1), MODES.easy)
    expect(sim.y).to.equal(DECK_Y)
    expect(sim.off).to.equal(false)
    for (let i = 0; i < 600; i++) stepSim(sim, 0, 0)
    expect(sim.outcome).to.equal(null)
    expect(sim.off).to.equal(false)
    expect(sim.energy).to.equal(0)
  })

  it('applies a command only after the uplink delay', () => {
    for (const mode of [MODES.easy, MODES.pro]) {
      const sim = createSim(siteFor(1), mode)
      const h0 = sim.h
      for (let i = 0; i < sim.delay; i++) stepSim(sim, 0, 127)
      expect(sim.h, mode.id).to.equal(h0)
      stepSim(sim, 0, 127)
      expect(sim.h, mode.id).to.not.equal(h0)
    }
  })

  it('ends the run when the rover drives off the side of the deck', () => {
    const sim = createSim(siteFor(1), MODES.easy)
    while (!sim.outcome && sim.steps < 3000) stepSim(sim, 127, 0)
    expect(sim.outcome).to.equal('fell')
    expect(scoreRun(sim).score).to.equal(0)
  })

  it('ends a run that never leaves the lander', () => {
    const sim = createSim(siteFor(1), MODES.pro)
    while (!sim.outcome && sim.steps < EGRESS_LIMIT_STEPS + 10) stepSim(sim, 0, 0)
    expect(sim.outcome).to.equal('parked')
    expect(sim.steps).to.equal(EGRESS_LIMIT_STEPS)
  })

  it('shows the ghost where the queued commands will leave the rover', () => {
    const sim = createSim(siteFor(2), MODES.easy)
    for (let i = 0; i < 20; i++) stepSim(sim, 0, -127)
    const ghost = ghostOf(sim)
    const before = { x: sim.x, h: sim.h, steps: sim.steps }
    // The ghost is a copy: the real rover has not moved.
    expect({ x: sim.x, h: sim.h, steps: sim.steps }).to.deep.equal(before)
    for (let i = 0; i < sim.delay; i++) stepSim(sim, 0, 0)
    expect(sim.h).to.equal(ghost.h)
    expect(sim.x).to.equal(ghost.x)
  })

  it('starts the clock and the 10 m count only once all four wheels are on the regolith', () => {
    const { sim } = drive(1, 'easy', 'perfect')
    const egress = sim.events.find((e) => e.kind === 'egress')
    expect(!!egress).to.equal(true)
    expect(sim.clockStart).to.equal(egress!.step)
    const ten = sim.events.find((e) => e.kind === 'ten')
    expect(!!ten && ten.step > egress!.step).to.equal(true)
  })
})

describe('first tracks: par and scoring', function () {
  // Whole drives are simulated here; a CI runner takes several times longer
  // than a laptop, and the suite default is 10 s.
  this.timeout(60000)

  it('routes par round rocks and never shorter than the straight line', () => {
    const site = siteFor(5)
    for (let i = 0; i + 1 < site.targets.length; i++) {
      const a = site.targets[i]
      const b = site.targets[i + 1]
      const path = parPath(site, a.x, a.z, b.x, b.z)
      expect(path[0]).to.deep.equal([a.x, a.z])
      expect(path[path.length - 1]).to.deep.equal([b.x, b.z])
      expect(pathLength(path) >= dist(a.x, a.z, b.x, b.z) - 1e-9).to.equal(true)
      expect(parEnergy(site, path, null).energy > pathLength(path)).to.equal(true)
    }
  })

  it('is deterministic: the same leg gives the same par every time', () => {
    const site = siteFor(9)
    const [a, b] = site.targets
    expect(parPath(site, a.x, a.z, b.x, b.z)).to.deep.equal(parPath(generateSite(9), a.x, a.z, b.x, b.z))
  })

  it('never pays a full figure, even to the perfect driver', () => {
    for (let mission = 1; mission <= 3; mission++) {
      const { result } = drive(mission, 'pro', 'perfect')
      expect(result.outcome, `mission ${mission}`).to.equal('complete')
      expect(result.imaged).to.equal(N_TARGETS)
      expect(result.firstTracks).to.equal(true)
      expect(result.parts.targets < 400).to.equal(true)
      expect(result.parts.route < 300).to.equal(true)
      expect(result.parts.battery < 300).to.equal(true)
      expect(result.parts.time > 0).to.equal(true)
      expect(result.score <= maxScore(1.25)).to.equal(true)
      expect(result.done).to.deep.equal(KIND_COUNT)
    }
  })

  it('scores legs never driven at nothing and applies the condition multiplier', () => {
    const sim: Sim = createSim(siteFor(1), MODES.easy)
    sim.outcome = 'tipped'
    sim.off = true
    const r = scoreRun(sim)
    expect(r.score).to.equal(0)
    expect(r.grades.route).to.equal('')
    expect(CONDITION.tipped).to.equal(0.25)
    expect(CONDITION.fell).to.equal(0.1)
    expect(CONDITION.stuck).to.equal(0.6)
    expect(CONDITION.flat).to.equal(0.8)
  })

  it('multiplies Pro by 1.25', () => {
    expect(maxScore(1.25)).to.equal(Math.ceil(maxScore(1) * 1.25))
  })
})

describe('first tracks: replay', function () {
  // Whole drives are simulated here; a CI runner takes several times longer
  // than a laptop, and the suite default is 10 s.
  this.timeout(60000)

  it('re-drives a tape to the same score, outcome and breakdown', () => {
    for (const [mission, mode, kind] of [
      [1, 'easy', 'perfect'],
      [2, 'pro', 'average'],
      [3, 'easy', 'sloppy'],
      [4, 'pro', 'careful'],
    ] as const) {
      const { tape, result } = drive(mission, mode, kind)
      const again = replayRun(mission, mode, base64ToTape(tapeToBase64(tape))!)
      expect(again, `${mission} ${mode} ${kind}`).to.deep.equal(result)
    }
  })

  it('rejects a tape that stops before the run ends, or is malformed', () => {
    const { tape } = drive(1, 'easy', 'perfect')
    expect(replayRun(1, 'easy', Uint8Array.from(tape.slice(0, 40)))).to.equal(null)
    expect(replayRun(1, 'easy', Uint8Array.from([0, 127, 127, 0]))).to.equal(null)
    expect(replayRun(1, 'easy', Uint8Array.from([10, 255, 127, 0]))).to.equal(null)
    expect(replayRun(1, 'easy', Uint8Array.from([10, 127, 127, 1]))).to.equal(null)
  })

  it('scores a tape against the day it was driven on, not another', () => {
    const { tape, result } = drive(1, 'easy', 'perfect')
    const other = replayRun(2, 'easy', Uint8Array.from(tape))
    expect(other === null || other.score !== result.score).to.equal(true)
  })
})

describe('first tracks: jobs, bumps and the day\'s clock', function () {
  // Whole drives are simulated here; a CI runner takes several times longer
  // than a laptop, and the suite default is 10 s.
  this.timeout(60000)

  it('gives every day three regolith images, two boulder spectra and three ice cores', () => {
    for (let mission = 1; mission <= 40; mission++) {
      const site = siteFor(mission)
      const count = { image: 0, rock: 0, ice: 0 }
      for (const t of site.targets) count[t.kind]++
      expect(count, `mission ${mission}`).to.deep.equal(KIND_COUNT)
      for (const t of site.targets) {
        const here = site.craters.find((c) => c.science && dist(c.x, c.z, t.x, t.z) < 1e-9)
        // An ice target is the floor of its own crater; nothing else is.
        expect(!!here, `mission ${mission}`).to.equal(t.kind === 'ice')
        if (t.kind !== 'rock') continue
        // A rock target has a boulder at its ring, close enough to park beside.
        let nearest = Infinity
        site.hazards.forEach((list) => {
          for (const r of list) if (r.h > 0.8) nearest = Math.min(nearest, dist(r.x, r.z, t.x, t.z))
        })
        expect(nearest < 2.6, `mission ${mission} boulder`).to.equal(true)
      }
    }
  })

  it('makes an ice core take longer than an image, and pay back more clock', () => {
    expect(holdSteps('ice') > holdSteps('rock') && holdSteps('rock') > holdSteps('image')).to.equal(true)
    expect(MODES.easy.bonusSeconds.ice > MODES.easy.bonusSeconds.rock && MODES.easy.bonusSeconds.rock > MODES.easy.bonusSeconds.image).to.equal(true)
    expect(KIND_POINTS.image * KIND_COUNT.image + KIND_POINTS.rock * KIND_COUNT.rock + KIND_POINTS.ice * KIND_COUNT.ice).to.equal(400)
  })

  it('slows and lifts the rover over a small rock, and charges the battery for it', () => {
    const site = siteFor(3)
    let rock: { x: number; z: number; h: number; r: number } | undefined
    site.bumps.forEach((list) => {
      for (const r of list) if (!rock && r.h > 0.15 && site.softAt(r.x, r.z) === 0 && dist(r.x, r.z, 0, 0) > 12) rock = r
    })
    expect(!!rock).to.equal(true)
    expect(rock!.h >= BUMP_MIN && rock!.h <= CLEAR).to.equal(true)
    // Put the rover on the ground a metre short of the rock, front-right wheel lined up with it, and drive.
    const run = (withRock: boolean) => {
      const sim = createSim(site, MODES.easy)
      sim.off = true
      sim.windowEnd = 1e9
      sim.h = 0
      sim.x = rock!.x + 0.45 + (withRock ? 0 : 3)
      sim.z = rock!.z - 1.6
      for (let i = 0; i < 60 * 4; i++) stepSim(sim, 127, 0)
      return sim
    }
    const over = run(true)
    expect(over.jolts >= 1).to.equal(true)
    expect(over.events.some((e) => e.kind === 'jolt')).to.equal(true)
    // It rode over: it was never stopped dead, as a rock taller than the wheels would do.
    expect(over.bumps).to.equal(0)
    expect(over.z > rock!.z).to.equal(true)
  })

  it('never leaves a leg of the day\'s tour walled in', () => {
    for (let mission = 1; mission <= 40; mission++) {
      const site = siteFor(mission)
      const order = shortestTour(site.targets, RAMP_FOOT[0], RAMP_FOOT[1]).order
      let x = RAMP_FOOT[0]
      let z = RAMP_FOOT[1]
      for (const i of order) {
        const t = site.targets[i]
        const comfortable = pathLength(parPath(site, x, z, t.x, t.z, 1.2, 0.3))
        const open = comfortable < dist(x, z, t.x, t.z) * 1.45 + 0.5
        // Where the long way round is the terrain's doing (a crater, a target's own boulder), the
        // straight line at least has no loose rock left standing in it.
        let inLane = 0
        const ax = x
        const az = z
        site.hazards.forEach((list) => {
          for (const r of list) {
            if (r.anchor) continue
            const dx = t.x - ax
            const dz = t.z - az
            const f = Math.max(0, Math.min(1, ((r.x - ax) * dx + (r.z - az) * dz) / (dx * dx + dz * dz)))
            if (dist(r.x, r.z, ax + dx * f, az + dz * f) < 1.7 + r.r) inLane++
          }
        })
        expect(open || inLane === 0, `mission ${mission} leg to ${i}`).to.equal(true)
        x = t.x
        z = t.z
      }
    }
  })

  it('sizes the clock from the day\'s site, and gives Pro more of it', () => {
    for (let mission = 1; mission <= 20; mission++) {
      const site = siteFor(mission)
      expect(site.parSeconds > 60 && site.parSeconds < 220, `mission ${mission}`).to.equal(true)
      const easy = windowSecondsFor(site, MODES.easy)
      const pro = windowSecondsFor(site, MODES.pro)
      expect(easy >= 25 && pro > easy, `mission ${mission}`).to.equal(true)
    }
    // A raw site has no par time yet: the mode's fallback applies.
    expect(windowSecondsFor(generateSite(1), MODES.easy)).to.equal(MODES.easy.windowSeconds)
  })
})
