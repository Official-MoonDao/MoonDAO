/// <reference types="node" />
/**
 * Acceptance: a tap on Predict is the write, not a local highlight.
 *
 * The panel used to flip "Your call" on click and wait for a footer Save.
 * That is a false-completion trap. tapPlan decides what the tap means;
 * undoPlan decides how to take it back. Neither one re-prompts the wallet
 * for the already-saved row, and neither one stacks a second signature
 * while a write is in flight.
 */
import fs from 'fs'
import path from 'path'

const REQUEST = '@/lib/forecasts/forecastPick'
const WRITE_REQUEST = '@/lib/deprize/writeForecastVote'
const UI_ROOT = path.resolve(__dirname, '../../../../')

function loadModule(request: string): any {
  try {
    return require(request)
  } catch (err: any) {
    throw new Error(
      `[not implemented] Could not load "${request}". Create it as described in the plan. ` +
        `Underlying error: ${err?.message ?? String(err)}`
    )
  }
}

function requireExports(mod: any, request: string, names: string[]): void {
  const missing = names.filter((name) => typeof mod?.[name] === 'undefined')
  if (missing.length > 0) {
    throw new Error(`[not implemented] "${request}" must export: ${missing.join(', ')}`)
  }
}

function readUi(...parts: string[]): string {
  return fs.readFileSync(path.join(UI_ROOT, ...parts), 'utf8')
}

const READY = {
  index: 1,
  savedPick: null as number | null,
  writing: false,
  connected: true,
  isCitizen: true,
  locked: false,
}

describe('deprize forecast pick', () => {
  let mod: any

  before(() => {
    mod = loadModule(REQUEST)
    requireExports(mod, REQUEST, [
      'tapPlan',
      'undoPlan',
      'canUndo',
      'pickLabel',
      'allocationForPick',
      'pickFromAllocation',
    ])
  })

  it('writes the tapped index when the Citizen is ready', () => {
    expect(mod.tapPlan({ ...READY, index: 2 })).to.deep.equal({ action: 'write', index: 2 })
    expect(mod.tapPlan({ ...READY, index: 0, savedPick: 2 })).to.deep.equal({
      action: 'write',
      index: 0,
    })
  })

  it('ignores a tap on the already-saved row instead of re-signing', () => {
    expect(mod.tapPlan({ ...READY, index: 1, savedPick: 1 })).to.deep.equal({
      action: 'ignore',
      reason: 'already-saved',
    })
  })

  it('ignores a tap while a write is in flight so two signatures cannot stack', () => {
    expect(mod.tapPlan({ ...READY, writing: true })).to.deep.equal({
      action: 'ignore',
      reason: 'writing',
    })
    expect(mod.tapPlan({ ...READY, writing: true, connected: false })).to.deep.equal({
      action: 'ignore',
      reason: 'writing',
    })
  })

  it('ignores a tap when the book is locked, ahead of every other branch', () => {
    expect(
      mod.tapPlan({ ...READY, locked: true, writing: true, connected: false, isCitizen: false })
    ).to.deep.equal({ action: 'ignore', reason: 'locked' })
  })

  it('asks a disconnected wallet to connect before it asks for a Citizen', () => {
    expect(mod.tapPlan({ ...READY, connected: false, isCitizen: false })).to.deep.equal({
      action: 'connect',
    })
  })

  it('sends a connected non-Citizen to mint instead of writing', () => {
    expect(mod.tapPlan({ ...READY, isCitizen: false })).to.deep.equal({
      action: 'need-citizen',
    })
  })

  it('undo writes the previous pick when there is one to restore', () => {
    expect(
      mod.undoPlan({ savedPick: 2, previousPick: 0, writing: false, locked: false })
    ).to.deep.equal({ action: 'write', index: 0 })
  })

  it('undo clears the row when the saved pick is the first one', () => {
    expect(
      mod.undoPlan({ savedPick: 2, previousPick: null, writing: false, locked: false })
    ).to.deep.equal({ action: 'clear' })
    expect(
      mod.undoPlan({ savedPick: 2, previousPick: 2, writing: false, locked: false })
    ).to.deep.equal({ action: 'clear' })
  })

  it('undo is a no-op when locked, writing, or there is nothing saved', () => {
    expect(
      mod.undoPlan({ savedPick: 2, previousPick: 0, writing: false, locked: true })
    ).to.deep.equal({ action: 'ignore', reason: 'locked' })
    expect(
      mod.undoPlan({ savedPick: 2, previousPick: 0, writing: true, locked: false })
    ).to.deep.equal({ action: 'ignore', reason: 'writing' })
    expect(
      mod.undoPlan({ savedPick: null, previousPick: 0, writing: false, locked: false })
    ).to.deep.equal({ action: 'ignore', reason: 'nothing-to-undo' })
  })

  it('canUndo only when a saved pick exists and the book is idle', () => {
    expect(mod.canUndo({ savedPick: 1, writing: false, locked: false })).to.equal(true)
    expect(mod.canUndo({ savedPick: null, writing: false, locked: false })).to.equal(false)
    expect(mod.canUndo({ savedPick: 1, writing: true, locked: false })).to.equal(false)
    expect(mod.canUndo({ savedPick: 1, writing: false, locked: true })).to.equal(false)
  })

  it('pickLabel never returns Your call', () => {
    const idle = mod.pickLabel({ picked: false, saved: false })
    const pending = mod.pickLabel({ picked: true, saved: false })
    const saved = mod.pickLabel({ picked: true, saved: true })
    for (const label of [idle, pending, saved]) {
      expect(label, 'pickLabel must be a visible string').to.be.a('string').and.not.equal('')
      expect(label).to.not.match(/your call/i)
    }
  })

  it('builds a one-hot allocation and reads the pick back out', () => {
    expect(mod.allocationForPick(1, 3)).to.deep.equal([0, 100, 0])
    expect(mod.allocationForPick(null, 3)).to.deep.equal([0, 0, 0])
    expect(mod.pickFromAllocation([0, 100, 0])).to.equal(1)
    expect(mod.pickFromAllocation([0, 0, 0])).to.equal(null)
  })
})

describe('deprize forecast pick write helpers', () => {
  it('exports clearForecastVote that deletes the Forecasts row', () => {
    const writeMod = loadModule(WRITE_REQUEST)
    requireExports(writeMod, WRITE_REQUEST, ['writeForecastVote', 'clearForecastVote'])
    const src = readUi('lib/deprize/writeForecastVote.ts')
    if (!src.includes('deleteFromTable')) {
      throw new Error(
        '[not implemented] "@/lib/deprize/writeForecastVote" clearForecastVote must call deleteFromTable'
      )
    }
  })

  it('ForecastPanel decides the tap through tapPlan instead of local state', () => {
    const src = readUi('components/deprize/ForecastPanel.tsx')
    if (!src.includes('tapPlan')) {
      throw new Error(
        '[not implemented] ForecastPanel must import tapPlan from @/lib/forecasts/forecastPick'
      )
    }
    if (!src.includes('undoPlan') || !src.includes('canUndo')) {
      throw new Error(
        '[not implemented] ForecastPanel must import undoPlan and canUndo from @/lib/forecasts/forecastPick'
      )
    }
  })
})

export {}
