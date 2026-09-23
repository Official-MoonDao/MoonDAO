/// <reference types="node" />
import fs from 'fs'
import path from 'path'
import { betPresetEthAmounts, formatBetPresetEth } from '@/lib/deprize/betPresets'

const UI_ROOT = path.resolve(__dirname, '../../../../')

describe('bet preset amounts', () => {
  it('lands within a dollar of $10, $100, and $1000 at $2688 per ETH', () => {
    const price = 2688
    const amounts = betPresetEthAmounts(price)
    expect(amounts).to.have.length(3)
    const targets = [10, 100, 1000]
    amounts.forEach((eth, i) => {
      expect(Math.abs(eth * price - targets[i]) < 1).to.equal(true)
    })
    expect(formatBetPresetEth(amounts[0])).to.equal('0.00372')
    expect(formatBetPresetEth(amounts[1])).to.equal('0.037202')
    expect(formatBetPresetEth(amounts[2])).to.equal('0.372024')
  })

  it('caps the $1000 chip at 1 ETH and drops the duplicate when ETH is $100', () => {
    const amounts = betPresetEthAmounts(100)
    const keys = amounts.map((eth) => eth.toFixed(6))
    expect(new Set(keys).size).to.equal(amounts.length)
    expect(amounts.length < 3).to.equal(true)
    for (const eth of amounts) {
      expect(eth > 1).to.equal(false)
    }
    expect(amounts.some((eth) => Math.abs(eth - 1) < 1e-9)).to.equal(true)
  })

  it('returns nothing without a positive ETH price', () => {
    expect(betPresetEthAmounts(null)).to.deep.equal([])
    expect(betPresetEthAmounts(undefined)).to.deep.equal([])
    expect(betPresetEthAmounts(0)).to.deep.equal([])
    expect(betPresetEthAmounts(-2688)).to.deep.equal([])
  })

  it('wires the prediction bet row to the three dollar chips', () => {
    const src = fs.readFileSync(path.join(UI_ROOT, 'components/deprize/BetModal.tsx'), 'utf8')
    expect(src).to.include('betPresetEthAmounts')
    expect(src).to.not.include("['0.01', '0.05', '0.1']")
    expect(src).to.not.include('Max (')
  })
})
