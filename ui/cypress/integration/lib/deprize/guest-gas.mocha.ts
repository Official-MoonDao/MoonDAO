/// <reference types="node" />

/**
 * Guest accounts cost nothing to create, so the per-wallet stipend limit does
 * not bound them. Guest top-ups also count against the caller's IP and a
 * daily ETH cap per chain.
 */
import {
  FORECAST_GUEST_TOPUPS_PER_IP_PER_DAY,
  forecastGasBudgetWei,
  forecastGuestDailyCapWei,
  forecastGuestDay,
  forecastGuestIpKey,
  forecastGuestSpendKey,
  guestGasCheck,
} from '@/lib/deprize/forecastGas'

describe('guest forecast gas caps', () => {
  it('defaults to 100 full top-ups a day: 0.025 ETH on Arbitrum', () => {
    expect(forecastGuestDailyCapWei(42161)).to.equal(25n * 10n ** 15n)
    expect(forecastGuestDailyCapWei(11155111)).to.equal(forecastGasBudgetWei(11155111) * 100n)
  })

  it('takes a whole-number wei override and ignores anything else', () => {
    expect(forecastGuestDailyCapWei(42161, '1000')).to.equal(1000n)
    expect(forecastGuestDailyCapWei(42161, '0.5')).to.equal(25n * 10n ** 15n)
    expect(forecastGuestDailyCapWei(42161, '')).to.equal(25n * 10n ** 15n)
  })

  it('stops an IP after its daily guest top-ups', () => {
    const cap = forecastGuestDailyCapWei(42161)
    expect(
      guestGasCheck({ ipCount: FORECAST_GUEST_TOPUPS_PER_IP_PER_DAY, spentWei: 0n, capWei: cap })
    ).to.equal('ok')
    expect(
      guestGasCheck({
        ipCount: FORECAST_GUEST_TOPUPS_PER_IP_PER_DAY + 1,
        spentWei: 0n,
        capWei: cap,
      })
    ).to.equal('ip-capped')
  })

  it('stops every guest once the day spends past the cap', () => {
    expect(guestGasCheck({ ipCount: 1, spentWei: 100n, capWei: 100n })).to.equal('ok')
    expect(guestGasCheck({ ipCount: 1, spentWei: 101n, capWei: 100n })).to.equal('budget-capped')
  })

  it('keys counters by chain and UTC day', () => {
    const day = forecastGuestDay(new Date('2026-11-12T23:30:00-08:00'))
    expect(day).to.equal('2026-11-13')
    expect(forecastGuestIpKey(42161, '1.2.3.4', day)).to.equal(
      'deprize:forecast-gas:guest-ip:42161:2026-11-13:1.2.3.4'
    )
    expect(forecastGuestSpendKey(42161, day)).to.equal(
      'deprize:forecast-gas:guest-wei:42161:2026-11-13'
    )
  })
})
