/**
 * "Fund the prize" opens the launchpad contribution modal. It must not call
 * Privy login and return before that window exists.
 */
import fs from 'fs'
import path from 'path'

const UI_ROOT = path.resolve(__dirname, '../../../../')

function readUi(...parts: string[]): string {
  return fs.readFileSync(path.join(UI_ROOT, ...parts), 'utf8')
}

describe('fund the prize click', () => {
  const slot = readUi('components/deprize/detail/PrizePoolSlot.tsx')
  const contribute = readUi('components/deprize/DePrizeLaunchpadContribute.tsx')

  it('opens the fund window on click instead of returning at login', () => {
    const start = slot.indexOf('function onFund()')
    const end = slot.indexOf('return (', start)
    expect(start).to.be.greaterThan(-1)
    expect(end).to.be.greaterThan(start)
    const handler = slot.slice(start, end)
    expect(handler).to.include('setFundOpen(true)')
    expect(handler).to.not.include('login()')
    expect(handler).to.not.match(/if\s*\(\s*!props\.account\s*\)/)
  })

  it('mounts the launchpad contribution modal without waiting for a connected account', () => {
    expect(slot).to.match(
      /\{props\.jbProjectId != null && props\.chain && props\.deprizeId != null && \(/
    )
    expect(slot).to.include('open={fundOpen}')
    expect(slot).to.include('DePrizeLaunchpadContribute')
    expect(slot).to.not.include('FundPrizeModal')
    expect(slot).to.not.match(/fundOpen &&[\s\S]{0,120}props\.account &&/)
  })

  it('reuses the launchpad contribution modal and its terms checkbox', () => {
    expect(contribute).to.include('MissionContributeModal')
    expect(contribute).to.include('paymentChain={getChainById(props.chainId)}')
    expect(contribute).to.include('/api/mission/contribute-props')
    expect(contribute).to.not.include('DePrize Terms')
    expect(contribute).to.not.include('Not available to U.S. persons')
    expect(contribute).to.not.include('useDePrizeRestricted')
  })
})
