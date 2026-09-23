export const SECONDS_PER_YEAR = 365 * 24 * 60 * 60

export type SubscriptionType = 'team' | 'citizen'

export type RenewSubscriptionCall = {
  method: 'renewSubscription'
  params: readonly (string | number)[]
  value: bigint
}

function toTokenId(tokenId: string | number | bigint): string {
  // Token id 0 is valid (Executive Branch). Never treat it as missing.
  if (tokenId === undefined || tokenId === null || tokenId === '') {
    throw new Error('Token id is required to extend a subscription')
  }
  return BigInt(tokenId).toString()
}

export function renewalDurationSeconds(years: number): number {
  if (!Number.isFinite(years) || years < 1) {
    throw new Error('Select at least 1 year to extend')
  }
  return Math.floor(years) * SECONDS_PER_YEAR
}

export function toRenewalValue(cost: unknown): bigint {
  if (cost === undefined || cost === null || cost === '') {
    throw new Error('Subscription cost is still loading. Please wait and try again.')
  }
  if (typeof cost === 'bigint') return cost
  if (typeof cost === 'number') {
    if (!Number.isFinite(cost)) {
      throw new Error('Invalid subscription cost')
    }
    return BigInt(Math.trunc(cost))
  }
  return BigInt((cost as { toString(): string }).toString())
}

export function buildRenewSubscriptionCall({
  type,
  address,
  tokenId,
  years,
  cost,
}: {
  type: SubscriptionType
  address?: string
  tokenId: string | number | bigint
  years: number
  cost: unknown
}): RenewSubscriptionCall {
  const duration = renewalDurationSeconds(years)
  const value = toRenewalValue(cost)
  const resolvedTokenId = toTokenId(tokenId)

  if (type === 'team') {
    if (!address) {
      throw new Error('Connect a wallet to extend this team subscription')
    }
    return {
      method: 'renewSubscription',
      params: [address, resolvedTokenId, duration],
      value,
    }
  }

  return {
    method: 'renewSubscription',
    params: [resolvedTokenId, duration],
    value,
  }
}
