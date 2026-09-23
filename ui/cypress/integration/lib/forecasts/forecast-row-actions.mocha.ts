/// <reference types="node" />
/**
 * Acceptance: Back and Predict are one row, and there is no footer Save.
 *
 * When betting is open, Back is primary and Predict is secondary. When the
 * page is geo-restricted, Predict is the only action and it is primary.
 * Predict is disabled with a reason when the prize is locked or the
 * connected wallet is not a Citizen. Order is always bet then predict.
 */
import fs from 'fs'
import path from 'path'

const REQUEST = '@/lib/forecasts/rowActions'
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

function kinds(actions: Array<{ kind: string }>): string[] {
  return actions.map((action) => action.kind)
}

function byKind(actions: any[], kind: string): any {
  return actions.find((action) => action.kind === kind)
}

const OPEN = {
  restricted: false,
  bettingOpen: true,
  locked: false,
  isCitizen: true,
  connected: true,
}

describe('deprize forecast row actions', () => {
  let mod: any

  before(() => {
    mod = loadModule(REQUEST)
    requireExports(mod, REQUEST, ['rowActions'])
  })

  it('makes Back primary and Predict secondary when betting is open', () => {
    const actions = mod.rowActions(OPEN)
    expect(kinds(actions)).to.deep.equal(['bet', 'predict'])
    expect(byKind(actions, 'bet')).to.include({ role: 'primary', enabled: true })
    expect(byKind(actions, 'predict')).to.include({ role: 'secondary', enabled: true })
    expect(byKind(actions, 'predict').reason).to.equal(undefined)
  })

  it('makes Predict the only primary action when the page is restricted', () => {
    const actions = mod.rowActions({ ...OPEN, restricted: true })
    expect(kinds(actions)).to.deep.equal(['predict'])
    expect(actions[0]).to.include({ kind: 'predict', role: 'primary', enabled: true })
  })

  it('omits Back when betting is closed, even if the region is unrestricted', () => {
    const actions = mod.rowActions({ ...OPEN, bettingOpen: false })
    expect(kinds(actions)).to.deep.equal(['predict'])
    expect(actions[0]).to.include({ kind: 'predict', role: 'primary' })
  })

  it('disables Predict with a locked reason when the book is closed', () => {
    const actions = mod.rowActions({ ...OPEN, locked: true })
    expect(byKind(actions, 'predict')).to.include({ enabled: false, reason: 'locked' })
    expect(kinds(actions)[0]).to.equal('bet')
  })

  it('disables Predict with need-citizen when a connected wallet holds no Citizen', () => {
    const actions = mod.rowActions({ ...OPEN, isCitizen: false })
    expect(byKind(actions, 'predict')).to.include({ enabled: false, reason: 'need-citizen' })
  })

  it('keeps Predict enabled for a disconnected wallet so tapPlan can connect', () => {
    const actions = mod.rowActions({ ...OPEN, connected: false, isCitizen: false })
    expect(byKind(actions, 'predict')).to.include({ enabled: true })
    expect(byKind(actions, 'predict').reason).to.equal(undefined)
  })

  it('keeps a stable bet-then-predict order whenever both actions exist', () => {
    const cases = [
      OPEN,
      { ...OPEN, locked: true },
      { ...OPEN, isCitizen: false },
      { ...OPEN, connected: false, isCitizen: false },
    ]
    for (const input of cases) {
      const actions = mod.rowActions(input)
      if (actions.some((action: { kind: string }) => action.kind === 'bet')) {
        expect(kinds(actions)).to.deep.equal(['bet', 'predict'])
      }
    }
  })
})

describe('deprize forecast row action wiring', () => {
  it('ForecastPanel renders rowActions and no longer has Save prediction', () => {
    const src = readUi('components/deprize/ForecastPanel.tsx')
    if (!src.includes('rowActions')) {
      throw new Error(
        '[not implemented] ForecastPanel must import rowActions from @/lib/forecasts/rowActions'
      )
    }
    if (src.includes('Save prediction')) {
      throw new Error(
        '[not implemented] ForecastPanel still renders "Save prediction". Commit on tap and delete the footer.'
      )
    }
  })

  it('opens one prediction window from the competitor card', () => {
    const src = readUi('components/deprize/ForecastPanel.tsx')
    expect(src).to.include('PredictModal')
    expect(src).to.not.include('pickLabel')
    expect(src).to.not.include('Back with ETH')
    expect(src).to.not.include('Citizen prediction')
    const modal = readUi('components/deprize/PredictModal.tsx')
    expect(modal).to.not.include('No bet attached')
    expect(modal).to.include('Attach a bet')
    expect(modal).to.include('aria-expanded={betOpen}')
    expect(modal).to.include('setBetOpen((open) => !open)')
    expect(modal).to.include('Optional. Open to add an ETH bet.')
    expect(modal).to.include('{props.bet}')
    const shell = modal.slice(
      modal.indexOf('data-testid="deprize-predict-bet"'),
      modal.indexOf('id="deprize-predict-bet-panel"')
    )
    expect(shell).to.include('overflow-hidden rounded-xl border border-white/15')
    const attachButton = modal.slice(
      modal.lastIndexOf('<button', modal.indexOf('aria-expanded={betOpen}')),
      modal.indexOf('</button>', modal.indexOf('aria-expanded={betOpen}'))
    )
    expect(attachButton).to.not.include('rounded-xl')
    expect(attachButton).to.not.include('border')
    expect(modal).to.not.include('This spends ETH and changes the odds.')
    expect(modal).to.not.include('Add a bet')
    expect(modal).to.not.include('Save prediction')
  })
})

export {}
