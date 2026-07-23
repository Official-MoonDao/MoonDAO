import { formatPrizeTokenLabel } from '@/lib/deprize/format'

describe('deprize launchpad token labels', () => {
  it('prefixes a bare symbol with $', () => {
    expect(formatPrizeTokenLabel('FRANKT')).to.equal('$FRANKT')
    expect(formatPrizeTokenLabel('OVERVIEW')).to.equal('$OVERVIEW')
  })

  it('keeps an already-prefixed symbol', () => {
    expect(formatPrizeTokenLabel('$FRANKT')).to.equal('$FRANKT')
  })

  it('falls back to a generic label when the symbol is unknown (never OVERVIEW)', () => {
    expect(formatPrizeTokenLabel(undefined)).to.equal('prize-pool tokens')
    expect(formatPrizeTokenLabel('')).to.equal('prize-pool tokens')
    expect(formatPrizeTokenLabel('   ')).to.equal('prize-pool tokens')
  })
})
