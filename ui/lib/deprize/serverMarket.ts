import ConditionalTokensABI from 'const/abis/ConditionalTokens.json'
import DePrizeMintABI from 'const/abis/DePrizeMint.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import WETHABI from 'const/abis/WETH.json'
import {
  COLLATERAL_TOKEN_ADDRESSES,
  CONDITIONAL_TOKEN_ADDRESSES,
  DEPRIZE_MINT_ADDRESSES,
} from 'const/config'
import {
  DePrizeState,
  MarketStage,
  resolvePayoutVector,
  shouldSurfaceResolution,
} from '@/lib/deprize/constants'

export type ServerMarketSnapshot = {
  marketAddress: string | null
  /** Raw CTF report: payoutDenominator > 0. */
  resolved: boolean
  /** Interpreted resolution. D1 scores against this; G1 must not print odds when true. */
  shouldSurfaceResolution: boolean
  payoutNumerators: bigint[]
  payoutDenominator: bigint
  /** Block timestamp of the CTF payout report, in ms. Never wall-clock. */
  resolvedAtMs: number | null
  marginalPrices: number[]
  probabilitiesNormalized: number[]
  poolWei: bigint
  stage: number | null
}

/** Re-scale finite prices so they sum to 100. Non-finite entries become 0. */
export function normalizeProbabilities(percentages: number[]): number[] {
  const finite = percentages.map((p) => (Number.isFinite(p) && p > 0 ? p : 0))
  const sum = finite.reduce((acc, p) => acc + p, 0)
  if (sum <= 0) return finite.map(() => 0)
  return finite.map((p) => (p / sum) * 100)
}

export function rawCtfResolved(payoutDenominator: bigint | null | undefined): boolean {
  return !!payoutDenominator && payoutDenominator > 0n
}

/**
 * Convert a chain block timestamp (seconds) to ms. Returns null rather than
 * falling back to Date.now() — a wall clock here is the D-1 exploit window.
 */
export function resolvedAtMsFromBlockTimestamp(
  blockTimestampSec: number | null | undefined
): number | null {
  if (blockTimestampSec == null) return null
  if (!Number.isFinite(blockTimestampSec) || blockTimestampSec <= 0) return null
  return Math.floor(blockTimestampSec) * 1000
}

function isConfiguredAddress(value: string | undefined | null): value is string {
  return !!value && !/^0x0+$/.test(value)
}

export async function readServerMarket(args: {
  chainSlug: string
  chainId: number
  deprizeId: number
  numOutcomes: number
  registryState: DePrizeState
}): Promise<ServerMarketSnapshot | null> {
  const { chainSlug, chainId, deprizeId, numOutcomes, registryState } = args
  const mintAddress = DEPRIZE_MINT_ADDRESSES[chainSlug] ?? ''
  const ctfAddress = CONDITIONAL_TOKEN_ADDRESSES[chainSlug] ?? ''
  const wethAddress = COLLATERAL_TOKEN_ADDRESSES[chainSlug] ?? ''
  if (!isConfiguredAddress(mintAddress) || !isConfiguredAddress(ctfAddress) || numOutcomes <= 0) {
    return null
  }

  const { getContract } = await import('thirdweb')
  const { deprizeReadChain, deprizeReadClient, rpcRead } = await import('@/lib/deprize/read')
  const readChain = deprizeReadChain(chainId)
  const mint = getContract({
    client: deprizeReadClient,
    chain: readChain,
    address: mintAddress,
    abi: DePrizeMintABI as any,
  })
  const marketAddress = await rpcRead<string>({
    contract: mint,
    method: 'marketOf' as string,
    params: [BigInt(deprizeId)],
  }).catch(() => '')
  if (!isConfiguredAddress(marketAddress)) return null

  const lmsr = getContract({
    client: deprizeReadClient,
    chain: readChain,
    address: marketAddress,
    abi: LMSRWithTWAP as any,
  })
  const ctf = getContract({
    client: deprizeReadClient,
    chain: readChain,
    address: ctfAddress,
    abi: ConditionalTokensABI as any,
  })

  const stage = await rpcRead({ contract: lmsr, method: 'stage' as string, params: [] })
    .then((v) => Number(v))
    .catch(() => null)

  let conditionId = await rpcRead<string>({
    contract: lmsr,
    method: 'atomicOutcomeConditionId' as string,
    params: [],
  }).catch(() => '')
  if (!conditionId || /^0x0+$/.test(conditionId)) {
    conditionId = await rpcRead<string>({
      contract: lmsr,
      method: 'conditionIds' as string,
      params: [0n],
    }).catch(() => '')
  }

  const prices = await Promise.all(
    Array.from({ length: numOutcomes }, (_, i) =>
      rpcRead({
        contract: lmsr,
        method: 'calcMarginalPrice' as string,
        params: [i],
      })
        .then((p) => (Number(p as bigint) / 2 ** 64) * 100)
        .catch(() => NaN)
    )
  )

  const payoutDenominator = await rpcRead<bigint>({
    contract: ctf,
    method: 'payoutDenominator' as string,
    params: [conditionId],
  }).catch(() => 0n)

  const payoutNumerators = await Promise.all(
    Array.from({ length: numOutcomes }, (_, i) =>
      rpcRead<bigint>({
        contract: ctf,
        method: 'payoutNumerators' as string,
        params: [conditionId, BigInt(i)],
      }).catch(() => 0n)
    )
  )

  const poolWei =
    isConfiguredAddress(wethAddress)
      ? await rpcRead<bigint>({
          contract: getContract({
            client: deprizeReadClient,
            chain: readChain,
            address: wethAddress,
            abi: WETHABI as any,
          }),
          method: 'balanceOf' as string,
          params: [marketAddress],
        }).catch(() => 0n)
      : 0n

  const { resolved } = resolvePayoutVector(payoutNumerators, payoutDenominator)
  const surface = shouldSurfaceResolution({
    ctfResolved: resolved,
    registryState,
    marketClosed: stage === MarketStage.Closed,
  })

  return {
    marketAddress,
    resolved,
    shouldSurfaceResolution: surface,
    payoutNumerators,
    payoutDenominator: payoutDenominator ?? 0n,
    // Missing ConditionResolution log ⇒ null. Never Date.now().
    resolvedAtMs: null,
    marginalPrices: prices,
    probabilitiesNormalized: normalizeProbabilities(prices),
    poolWei: poolWei ?? 0n,
    stage,
  }
}
