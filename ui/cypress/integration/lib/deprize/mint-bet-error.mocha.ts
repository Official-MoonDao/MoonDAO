import {
  betFailureMessage,
  COST_TOO_HIGH_MESSAGE,
  COST_TOO_HIGH_SELECTOR,
  isCostTooHighError,
} from '@/lib/deprize/mintBet'

describe('deprize mint bet errors', () => {
  it('recognizes the raw CostTooHigh selector the wallet shows when the ABI omits it', () => {
    const err = {
      shortMessage: `Encoded error signature "${COST_TOO_HIGH_SELECTOR}" not found on ABI.`,
    }
    expect(isCostTooHighError(err)).to.equal(true)
    expect(betFailureMessage(err)).to.equal(COST_TOO_HIGH_MESSAGE)
  })

  it('recognizes a decoded CostTooHigh nested on the cause', () => {
    const err = {
      message: 'Bet failed.',
      cause: { errorName: 'CostTooHigh', data: { cost: 1n, budget: 1n, maxCost: 1n } },
    }
    expect(betFailureMessage(err)).to.equal(COST_TOO_HIGH_MESSAGE)
  })

  it('leaves other failures alone', () => {
    expect(betFailureMessage(new Error('User rejected the request.'))).to.equal(null)
    expect(isCostTooHighError('BettingClosed')).to.equal(false)
  })
})
