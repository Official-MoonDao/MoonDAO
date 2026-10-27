import { expect } from 'chai'
import { DEPRIZE_LOG_TOPICS } from '@/lib/deprize/etherscanLogs'

describe('/api/deprize/logs topic allowlist', () => {
  it('is exactly Bet, AMMOutcomeTokenTrade and AMMFundingChanged', () => {
    expect([...DEPRIZE_LOG_TOPICS].sort()).to.deep.equal(
      [
        '0x04eb95d075819d291f4eee1fc806bc120d794372723a76adb57b5ba51643f1d1',
        '0xda7ff5556ce7ecfcf06296f03426e8c02a7305b85cfd88816a32f7f496905177',
        '0xc55e9a33fb8b1de5318b5c7b96a32937e54006c82000b2c468ed1fb9f73f6799',
      ].sort()
    )
  })

  it('does not serve arbitrary events such as ERC-20 Transfer', () => {
    expect(
      DEPRIZE_LOG_TOPICS.has('0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef')
    ).to.equal(false)
  })
})
