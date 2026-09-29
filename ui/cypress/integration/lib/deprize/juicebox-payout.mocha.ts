import { JB_NATIVE_TOKEN_ADDRESS, JB_NATIVE_TOKEN_ID } from 'const/config'
import { useAllowanceOfParams } from '@/lib/deprize/juiceboxPayout'

describe('deprize juicebox payout', () => {
  it('names the winner as the surplus-allowance beneficiary', () => {
    const winner = '0x679d87D8640e66778c3419D164998E720D7495f6'
    expect(
      useAllowanceOfParams({ projectId: 275n, amountWei: 10n ** 18n, beneficiary: winner })
    ).to.deep.equal([
      275n,
      JB_NATIVE_TOKEN_ADDRESS,
      10n ** 18n,
      BigInt(JB_NATIVE_TOKEN_ID),
      0n,
      winner,
      '0x0000000000000000000000000000000000000000',
      'DePrize prize payout',
    ])
  })
})