/**
 * "Fund the prize" opens the existing contribution window. It must not call
 * Privy login and return before that window exists — login() is a no-op when
 * a session is already signed in but thirdweb has no account.
 */
import fs from 'fs'
import path from 'path'

const UI_ROOT = path.resolve(__dirname, '../../../../')

function readUi(...parts: string[]): string {
  return fs.readFileSync(path.join(UI_ROOT, ...parts), 'utf8')
}

describe('fund the prize click', () => {
  const slot = readUi('components/deprize/detail/PrizePoolSlot.tsx')
  const modal = readUi('components/deprize/FundPrizeModal.tsx')

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

  it('mounts the fund window without waiting for a connected account', () => {
    expect(slot).to.match(
      /\{fundOpen && props\.jbProjectId != null && props\.chain && props\.deprizeId != null && \(/
    )
    expect(slot).to.not.match(
      /fundOpen &&[\s\S]{0,120}props\.account &&/
    )
  })

  it('offers connect inside the fund window when no wallet is attached', () => {
    expect(modal).to.include('account?: any')
    expect(modal).to.include('Connect wallet')
    expect(modal).to.include('Reconnect wallet')
    expect(modal).to.include('!wallet ?')
  })
})
