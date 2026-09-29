import {
  FORECAST_GAS_SPONSORSHIPS_PER_DAY,
  forecastGasBudgetWei,
  forecastGasSponsorKey,
  forecastGasTopUpWei,
} from '@/lib/deprize/forecastGas'
import { L2_GAS_BUDGET_WEI } from '@/lib/rpc/gasBudget'

describe('forecast gas sponsorship', () => {
  it('tops a Sepolia wallet up to the gas budget and skips one that can already pay', () => {
    const budget = forecastGasBudgetWei(11155111)
    expect(budget > L2_GAS_BUDGET_WEI).to.equal(true)
    expect(forecastGasTopUpWei(0n, budget)).to.equal(budget)
    expect(forecastGasTopUpWei(budget / 2n, budget)).to.equal(budget - budget / 2n)
    expect(forecastGasTopUpWei(budget, budget)).to.equal(0n)
    expect(forecastGasTopUpWei(budget + 1n, budget)).to.equal(0n)
  })

  it('uses the smaller L2 budget off Sepolia', () => {
    expect(forecastGasBudgetWei(42161)).to.equal(L2_GAS_BUDGET_WEI)
  })

  it('keys the daily cap by chain and wallet', () => {
    expect(FORECAST_GAS_SPONSORSHIPS_PER_DAY).to.equal(3)
    expect(forecastGasSponsorKey(11155111, '0xAbC')).to.equal(
      'deprize:forecast-gas:11155111:0xabc'
    )
  })
})
