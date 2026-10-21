/// <reference types="node" />
/**
 * Acceptance: Back and Predict are one row, and there is no footer Save.
 *
 * When betting is open, Back is primary and Predict is secondary. When the
 * page is geo-restricted, Add ETH stays visible and disabled, and Predict
 * is the primary action.
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

  it('keeps Add ETH visible but disabled when the page is restricted', () => {
    const actions = mod.rowActions({ ...OPEN, restricted: true })
    expect(kinds(actions)).to.deep.equal(['bet', 'predict'])
    expect(byKind(actions, 'bet')).to.include({
      role: 'secondary',
      enabled: false,
      reason: 'restricted',
    })
    expect(byKind(actions, 'predict')).to.include({ role: 'primary', enabled: true })
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

  it('keeps Predict enabled for a connected wallet with no Citizen', () => {
    const actions = mod.rowActions({ ...OPEN, isCitizen: false })
    expect(byKind(actions, 'predict')).to.include({ enabled: true })
    expect(byKind(actions, 'predict').reason).to.equal(undefined)
  })

  it('keeps Predict enabled for a disconnected wallet so tapPlan can connect', () => {
    const actions = mod.rowActions({ ...OPEN, connected: false, isCitizen: false })
    expect(byKind(actions, 'predict')).to.include({ enabled: true })
    expect(byKind(actions, 'predict').reason).to.equal(undefined)
  })

  it('keeps a stable bet-then-predict order whenever both actions exist', () => {
    const cases = [
      OPEN,
      { ...OPEN, restricted: true },
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

  it('opens one window per market from the competitor card', () => {
    const src = readUi('components/deprize/ForecastPanel.tsx')
    expect(src).to.include('PredictModal')
    expect(src).to.include('mode={mode}')
    expect(src).to.not.include('pickLabel')
    expect(src).to.not.include('Back with ETH')
    expect(src).to.not.include('Citizen prediction')
    // A bet never saves a MOONEY prediction behind the visitor's back.
    expect(src).to.not.include('attachPrediction')
    const modal = readUi('components/deprize/PredictModal.tsx')
    expect(modal).to.include("mode: 'bet' | 'predict'")
    expect(modal).to.include('Predict ${props.teamName}')
    expect(modal).to.not.include('Bet on ${props.teamName}')
    expect(modal).to.include('{props.bet}')
    // The bet form is the whole bet window, not an optional panel inside the prediction.
    expect(modal).to.not.include('Attach a bet')
    expect(modal).to.not.include('setBetOpen')
    expect(modal).to.not.include('No bet attached')
    expect(modal).to.not.include('Add a bet')
    expect(modal).to.not.include('Save prediction')
  })

  it('shows ETH chance with bet, voting power, and prediction count on one list', () => {
    const page = readUi('pages/deprize/[id].tsx')
    expect(page).to.not.include('MarketModeTabs')
    expect(page).to.not.include('viewQuery')
    expect(page).to.include('probabilities={market.outcomes.map((o) => o.probability)}')
    const card = readUi('components/deprize/DePrizeTeamCard.tsx')
    expect(card).to.include('ETH bet')
    expect(card).to.include('Voting power')
    expect(card).to.include('# predictions')
    const panel = readUi('components/deprize/ForecastPanel.tsx')
    expect(panel).to.include('chanceLabel="chance"')
    expect(panel).to.include('marketPercents[modalIndex]')
  })
})

export {}
