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

  it('puts Predict on each bettable outcome row', () => {
    const rowStart = card.indexOf('function OutcomeBetRow')
    const rowEnd = card.indexOf('export type RaceCardVariant')
    expect(rowStart).to.be.greaterThan(-1)
    expect(rowEnd).to.be.greaterThan(rowStart)
    const row = card.slice(rowStart, rowEnd)
    expect(row).to.include('DEPRIZE_PREDICT_CTA')
    expect(row).to.not.match(/>\s*Buy\s*</)

    const heroRows = hero.slice(hero.indexOf('{ranked.map'), hero.indexOf('{showPredict &&'))
    expect(heroRows).to.include('DEPRIZE_PREDICT_CTA')
  })

  it('keeps the restricted-region Predict link on each card variant', () => {
    // import, the outcome-row button, and the restricted-region link
    expect(hero.split('DEPRIZE_PREDICT_CTA').length - 1).to.equal(3)
    expect(card).to.include('function PredictLink')
    expect(card.split('<PredictLink').length - 1).to.equal(3) // grid, featured, list
  })

  it('renders the prize as a dollar-led Prize available figure', () => {
    expect(hero).to.include("import PrizeAvailable from '@/components/deprize/PrizeAvailable'")
    expect(hero).to.include('<PrizeAvailable')
    expect(hero).to.not.include('fmtPrizeEth')
    expect(card).to.include("import PrizeAvailable from '@/components/deprize/PrizeAvailable'")
    expect(card).to.include('<PrizeAvailable')
    expect(card).to.not.include('fmtPrizeEth')
    const figure = readUi('components/deprize/PrizeAvailable.tsx')
    expect(figure).to.include('Prize available')
    expect(figure).to.include('Math.round')
  })
})
