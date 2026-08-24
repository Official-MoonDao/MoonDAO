import { expect } from 'chai'
import {
  SECONDS_PER_YEAR,
  buildRenewSubscriptionCall,
  renewalDurationSeconds,
  toRenewalValue,
} from '@/lib/subscription/renewSubscription'

const WALLET = '0x1111111111111111111111111111111111111111'
const COST_WEI = BigInt('100000000000000000')
const EXECUTIVE_BRANCH_TOKEN_ID = 0

/**
 * Snapshot of the pre-fix prepareContractCall shape from SubscriptionModal.
 * thirdweb v5 reads payable ETH from a top-level `value`; `options.value` is
 * ignored, so the tx simulates at 0 ETH and never reaches a wallet popup.
 */
function legacyBuggyCall({
  type,
  address,
  tokenId,
  years,
  subscriptionCost,
}: {
  type: 'team' | 'citizen'
  address?: string
  tokenId: string | number
  years: number
  subscriptionCost: unknown
}) {
  if (!years || subscriptionCost === undefined) return null
  const duration = years * SECONDS_PER_YEAR
  if (type === 'team') {
    return {
      method: 'renewSubscription',
      params: [address, tokenId, duration],
      options: { value: (subscriptionCost as { toString(): string }).toString() },
    }
  }
  return {
    method: 'renewSubscription',
    params: [tokenId, duration],
    options: { value: (subscriptionCost as { toString(): string }).toString() },
  }
}

function thirdwebV5PayableValue(call: { value?: unknown } | null | undefined): bigint {
  if (!call || call.value == null) return BigInt(0)
  return BigInt(call.value.toString())
}

describe('Issue #1537 — extend team subscription', () => {
  it('reproduces the no-wallet-popup bug: payable ETH was nested under options', () => {
    const call = legacyBuggyCall({
      type: 'team',
      address: WALLET,
      tokenId: EXECUTIVE_BRANCH_TOKEN_ID,
      years: 1,
      subscriptionCost: COST_WEI,
    })

    expect(call).to.not.equal(null)
    expect(call && 'options' in call && (call as any).options.value).to.equal(
      COST_WEI.toString()
    )
    expect(thirdwebV5PayableValue(call)).to.equal(BigInt(0))
  })

  it('builds a team renew call with top-level wei value (Executive Branch token 0)', () => {
    const call = buildRenewSubscriptionCall({
      type: 'team',
      address: WALLET,
      tokenId: EXECUTIVE_BRANCH_TOKEN_ID,
      years: 1,
      cost: COST_WEI,
    })

    expect(call.method).to.equal('renewSubscription')
    expect(call.params).to.deep.equal([WALLET, '0', SECONDS_PER_YEAR])
    expect(call.value).to.equal(COST_WEI)
    expect(thirdwebV5PayableValue(call)).to.equal(COST_WEI)
    expect(call).to.not.have.property('options')
  })

  it('builds a citizen renew call without the sender address param', () => {
    const call = buildRenewSubscriptionCall({
      type: 'citizen',
      address: WALLET,
      tokenId: 12,
      years: 2,
      cost: '250000000000000000',
    })

    expect(call.params).to.deep.equal(['12', 2 * SECONDS_PER_YEAR])
    expect(call.value).to.equal(BigInt('250000000000000000'))
  })

  it('preserves a zero renewal price (discount / whitelist)', () => {
    const call = buildRenewSubscriptionCall({
      type: 'team',
      address: WALLET,
      tokenId: '0',
      years: 1,
      cost: BigInt(0),
    })
    expect(call.value).to.equal(BigInt(0))
  })

  it('rejects a missing token id without treating 0 as missing', () => {
    expect(() =>
      buildRenewSubscriptionCall({
        type: 'citizen',
        tokenId: '' as any,
        years: 1,
        cost: COST_WEI,
      })
    ).to.throw(/token id/i)
    expect(toRenewalValue(COST_WEI)).to.equal(COST_WEI)
    expect(renewalDurationSeconds(1)).to.equal(SECONDS_PER_YEAR)
  })

  it('rejects an unloaded cost so the button cannot fire a 0-ETH simulation', () => {
    expect(() =>
      buildRenewSubscriptionCall({
        type: 'team',
        address: WALLET,
        tokenId: 0,
        years: 1,
        cost: undefined,
      })
    ).to.throw(/still loading/i)
  })

  it('rejects a team renew without a connected wallet', () => {
    expect(() =>
      buildRenewSubscriptionCall({
        type: 'team',
        tokenId: 0,
        years: 1,
        cost: COST_WEI,
      })
    ).to.throw(/wallet/i)
  })
})
