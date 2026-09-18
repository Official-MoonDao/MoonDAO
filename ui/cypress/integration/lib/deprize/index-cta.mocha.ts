/**
 * /deprize index: one Predict CTA per prize (not per outcome), labeled
 * "Predict", with a USD equivalent next to the prize-pool ETH figure.
 */
import fs from 'fs'
import path from 'path'
import { DEPRIZE_PREDICT_CTA } from '@/lib/deprize/constants'

const UI_ROOT = path.resolve(__dirname, '../../../../')

function readUi(...parts: string[]): string {
  return fs.readFileSync(path.join(UI_ROOT, ...parts), 'utf8')
}

describe('deprize index predict CTA and pool USD', () => {
  const hero = readUi('components/deprize/LiveDePrizeHero.tsx')
  const card = readUi('components/deprize/RaceMarketCard.tsx')

  it('labels the CTA Predict with no "free" qualifier', () => {
    expect(DEPRIZE_PREDICT_CTA).to.equal('Predict')
    expect(DEPRIZE_PREDICT_CTA).to.not.match(/free/i)
    expect(hero).to.not.match(/Predict\s+[—–-]\s*free/i)
    expect(card).to.not.match(/Predict\s+[—–-]\s*free/i)
  })

  it('does not put a Predict control on every outcome row', () => {
    const rowStart = card.indexOf('function OutcomeBetRow')
    const rowEnd = card.indexOf('export type RaceCardVariant')
    expect(rowStart).to.be.greaterThan(-1)
    expect(rowEnd).to.be.greaterThan(rowStart)
    const row = card.slice(rowStart, rowEnd)
    expect(row).to.not.include('DEPRIZE_PREDICT_CTA')
    expect(row).to.not.include('predictHref')
    expect(row).to.not.match(/>\s*Predict\s*</)

    const heroRows = hero.slice(hero.indexOf('{ranked.map'), hero.indexOf('{showPredict &&'))
    expect(heroRows).to.not.include('DEPRIZE_PREDICT_CTA')
    expect(heroRows).to.not.include('forecastHref')
  })

  it('keeps a single Predict link per prize card', () => {
    expect(hero.split('DEPRIZE_PREDICT_CTA').length - 1).to.equal(2) // import + one render
    expect(card).to.include('function PredictLink')
    expect(card.split('<PredictLink').length - 1).to.equal(3) // grid, featured, list
  })

  it('renders prize-pool ETH with a USD equivalent', () => {
    expect(hero).to.include("import EthUsd from '@/components/deprize/EthUsd'")
    expect(hero).to.include('<EthUsd')
    expect(hero).to.not.include('fmtPrizeEth')
    expect(card).to.include("import EthUsd from '@/components/deprize/EthUsd'")
    expect(card).to.include('function PoolAmount')
    expect(card).to.include('<EthUsd')
    expect(card).to.not.include('fmtPrizeEth')
  })
})
