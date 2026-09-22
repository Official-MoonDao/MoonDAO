/// <reference types="node" />
/**
 * Acceptance: labelled odds, honest rounding, a bracket that waits its turn.
 *
 * fmtOddsPct keeps a decimal under 10% and does not invent 0% from 0.4.
 * oddsRowView hides the bracket until the DAO number is revealed, never
 * reports a zero-width bar once it is shown, and only writes a gap caption
 * when the two sides differ by at least ten points, naming the direction.
 */
import fs from 'fs'
import path from 'path'

const FORMAT_REQUEST = '@/lib/deprize/format'
const ROW_REQUEST = '@/lib/forecasts/oddsRow'
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

describe('deprize odds percent formatting', () => {
  let fmtOddsPct: (n: number) => string

  before(() => {
    const mod = loadModule(FORMAT_REQUEST)
    requireExports(mod, FORMAT_REQUEST, ['fmtOddsPct'])
    fmtOddsPct = mod.fmtOddsPct
  })

  it('keeps a decimal under 10% and rounds whole percents at or above 10', () => {
    expect(fmtOddsPct(4.2)).to.equal('4.2%')
    expect(fmtOddsPct(9.4)).to.equal('9.4%')
    expect(fmtOddsPct(0.4)).to.equal('0.4%')
    expect(fmtOddsPct(10)).to.equal('10%')
    expect(fmtOddsPct(42.4)).to.equal('42%')
    expect(fmtOddsPct(0)).to.equal('0%')
  })

  it('returns an em dash for non-finite input instead of NaN%', () => {
    expect(fmtOddsPct(Number.NaN)).to.equal('—')
    expect(fmtOddsPct(Number.POSITIVE_INFINITY)).to.equal('—')
    expect(fmtOddsPct(Number.NEGATIVE_INFINITY)).to.equal('—')
  })
})

describe('deprize odds row view', () => {
  let mod: any

  before(() => {
    mod = loadModule(ROW_REQUEST)
    requireExports(mod, ROW_REQUEST, ['oddsRowView', 'ODDS_GAP_THRESHOLD'])
  })

  it('suppresses the bracket and the gap caption before the DAO number is revealed', () => {
    const view = mod.oddsRowView({ marketPct: 42, daoPct: null, pooledPct: null })
    expect(view.showBracket).to.equal(false)
    expect(view.gapCaption).to.equal(null)
    expect(view.bracketWidth).to.equal(0)
    expect(view.daoLabel).to.equal('—')
    expect(view.marketLabel).to.equal('42%')
    expect(view.pooledLabel).to.equal(null)
  })

  it('never reports a zero-width bracket once the DAO number is up', () => {
    const split = mod.oddsRowView({ marketPct: 60, daoPct: 40, pooledPct: 50 })
    expect(split.showBracket).to.equal(true)
    expect(split.bracketLo).to.equal(40)
    expect(split.bracketHi).to.equal(60)
    expect(split.bracketWidth).to.be.greaterThan(0)
    expect(split.bracketWidth).to.be.at.least(20)
    expect(split.pooledLabel).to.equal('50%')

    const agree = mod.oddsRowView({ marketPct: 50, daoPct: 50, pooledPct: 50 })
    expect(agree.showBracket).to.equal(true)
    expect(agree.bracketWidth).to.be.greaterThan(0)
    expect(agree.gapCaption).to.equal(null)
  })

  it('writes a gap caption at the threshold and names the higher side', () => {
    expect(mod.ODDS_GAP_THRESHOLD).to.equal(10)

    const below = mod.oddsRowView({ marketPct: 51, daoPct: 48, pooledPct: 49 })
    expect(below.gapCaption).to.equal(null)

    const marketUp = mod.oddsRowView({ marketPct: 40, daoPct: 30, pooledPct: 35 })
    expect(marketUp.gapCaption).to.be.a('string')
    expect(marketUp.gapCaption).to.match(/market/i)
    expect(marketUp.gapCaption).to.match(/10/)
    expect(marketUp.gapCaption).to.not.match(/\bcall(?:ed|ing)?\b|Brier|[√]|sqrt|\bVP\b/i)

    const daoUp = mod.oddsRowView({ marketPct: 20, daoPct: 45, pooledPct: 30 })
    expect(daoUp.gapCaption).to.match(/DAO/i)
    expect(daoUp.gapCaption).to.match(/25/)
    expect(daoUp.gapCaption).to.not.match(/\bcall(?:ed|ing)?\b|Brier|[√]|sqrt|\bVP\b/i)
  })

  it('formats sub-10% row labels with a decimal', () => {
    const view = mod.oddsRowView({ marketPct: 4.2, daoPct: 8.8, pooledPct: 6.1 })
    expect(view.marketLabel).to.equal('4.2%')
    expect(view.daoLabel).to.equal('8.8%')
    expect(view.pooledLabel).to.equal('6.1%')
    expect(view.gapCaption).to.equal(null)
  })
})

describe('deprize odds row wiring', () => {
  it('ForecastPanel uses oddsRowView and drops the old inline bracket math', () => {
    const src = readUi('components/deprize/ForecastPanel.tsx')
    if (!src.includes('oddsRowView')) {
      throw new Error(
        '[not implemented] ForecastPanel must import oddsRowView from @/lib/forecasts/oddsRow'
      )
    }
    if (/function pct\(/.test(src) || /Math\.max\(\s*1\s*,\s*hi\s*-\s*lo\s*\)/.test(src)) {
      throw new Error(
        '[not implemented] ForecastPanel still has the old inline pct() / bracket math. Use oddsRowView and fmtOddsPct.'
      )
    }
  })
})

export {}
