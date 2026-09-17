import { JWT_FRESHNESS_MS } from './fundingStrategy'
import { clampAmountEth, type ParsedOnrampReturn } from './onrampReturn'

export type ReturnNotice =
  | { kind: 'wrong-wallet'; fundedAddress: string }
  | { kind: 'market-closed'; message: string }
  | { kind: 'shortfall'; shortfallEth: number }
  | { kind: 'connect-wallet' }

export type ResolveOnrampReturnResult = {
  action: 'ignore' | 'strip' | 'open'
  betIndex?: number
  prefillEth?: string
  fundsArrived?: boolean
  notice?: ReturnNotice
}

export function resolveOnrampReturn(input: {
  parsed: ParsedOnrampReturn
  jwtVerified: boolean
  jwtAddress?: string
  jwtIssuedAtMs?: number
  jwtConsumed: boolean
  nowMs: number
  userAddress?: string
  numOutcomes: number
  marketAcceptsBets: boolean
  spendableEthAtReturn?: number
  spendableEthNow?: number
  capEth: number
}): ResolveOnrampReturnResult {
  if (!input.parsed.active) return { action: 'ignore' }
  if (!input.jwtVerified) return { action: 'ignore' }

  const funded = input.jwtAddress?.toLowerCase()
  const user = input.userAddress?.toLowerCase()
  if (funded && user && funded !== user) {
    return {
      action: 'strip',
      notice: { kind: 'wrong-wallet', fundedAddress: input.jwtAddress as string },
    }
  }

  if (
    input.jwtIssuedAtMs != null &&
    input.nowMs - input.jwtIssuedAtMs > JWT_FRESHNESS_MS
  ) {
    return { action: 'strip' }
  }

  if (input.jwtConsumed) return { action: 'ignore' }

  if (!input.marketAcceptsBets) {
    return {
      action: 'ignore',
      notice: {
        kind: 'market-closed',
        message:
          'This market is not accepting bets right now. The ETH is in your own wallet and is not lost.',
      },
    }
  }

  const { outcomeIndex, amountEth } = input.parsed
  if (
    !Number.isInteger(outcomeIndex) ||
    outcomeIndex < 0 ||
    outcomeIndex >= input.numOutcomes
  ) {
    return { action: 'strip' }
  }

  const cap = String(input.capEth)
  const prefillEth = amountEth ? clampAmountEth(amountEth, cap) : undefined
  const prefillNum = prefillEth != null ? Number(prefillEth) : undefined

  let fundsArrived: boolean | undefined
  let notice: ReturnNotice | undefined
  const haveSnapshots =
    input.spendableEthAtReturn != null && input.spendableEthNow != null

  if (haveSnapshots) {
    const delta = (input.spendableEthNow as number) - (input.spendableEthAtReturn as number)
    const now = input.spendableEthNow as number
    if (delta > 0) {
      const enough =
        prefillNum == null ? now > 0 : now + 1e-12 >= prefillNum
      fundsArrived = enough
      if (!enough) {
        const shortfallEth = Math.max(0, Math.round(((prefillNum ?? 0) - now) * 1e12) / 1e12)
        notice = { kind: 'shortfall', shortfallEth }
      }
    } else {
      fundsArrived = false
    }
  }

  return {
    action: 'open',
    betIndex: outcomeIndex,
    prefillEth,
    fundsArrived,
    notice,
  }
}
