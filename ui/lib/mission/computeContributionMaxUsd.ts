import { LAYERZERO_MAX_CONTRIBUTION_ETH } from 'const/config'
import { arbitrum, base, ethereum } from '@/lib/rpc/chains'
import { L2_GAS_BUDGET_WEI } from '@/lib/rpc/gasBudget'

const WEI = BigInt('1000000000000000000')

/** Shared L2 budget — must cover wallet `gasLimit * maxFeePerGas` lock. */
const RESERVE_WEI_LOW = L2_GAS_BUDGET_WEI
/** 0.001 ETH — default same-chain reserve, cross-chain leave-behind */
const RESERVE_WEI_DEFAULT = BigInt('1000000000000000')

/**
 * Max USD contribution from native ETH balance, matching mission contribute modal / pay card rules:
 * same-chain gas reserves (Arbitrum/Base L2 budget, mainnet 0.001 ETH, else 0.001),
 * cross-chain leaves 0.001 ETH, LayerZero cap from config for eth/base sources.
 */
export function computeContributionMaxUsd(input: {
  /** Prefer `balanceWei` for exact max; `balanceEth` is a fallback and may lose precision. */
  balanceEth?: number
  balanceWei?: bigint
  selectedChainId: number
  chainSlug: string
  defaultChainSlug: string
  ethUsdPrice: number
}): number | null {
  const { balanceEth, balanceWei, selectedChainId, chainSlug, defaultChainSlug, ethUsdPrice } = input

  let balanceWeiNorm: bigint | undefined
  if (balanceWei !== undefined) {
    if (balanceWei <= BigInt(0)) return null
    balanceWeiNorm = balanceWei
  } else if (balanceEth !== undefined && Number.isFinite(balanceEth) && balanceEth > 0) {
    balanceWeiNorm = BigInt(Math.floor(balanceEth * 1e18))
  }
  if (balanceWeiNorm === undefined || balanceWeiNorm <= BigInt(0)) return null

  if (!Number.isFinite(ethUsdPrice) || ethUsdPrice <= 0) return null

  const isCrossChain = chainSlug !== defaultChainSlug

  let reserveWei: bigint
  if (!isCrossChain) {
    if (selectedChainId === arbitrum.id || selectedChainId === base.id) {
      reserveWei = RESERVE_WEI_LOW
    } else if (selectedChainId === ethereum.id) {
      reserveWei = RESERVE_WEI_DEFAULT
    } else {
      reserveWei = RESERVE_WEI_DEFAULT
    }
  } else {
    reserveWei = RESERVE_WEI_DEFAULT
  }

  let maxContribWei =
    balanceWeiNorm > reserveWei ? balanceWeiNorm - reserveWei : BigInt(0)
  if (maxContribWei <= BigInt(0)) return null

  if (isCrossChain && (chainSlug === 'ethereum' || chainSlug === 'base')) {
    const capWei = BigInt(Math.ceil(LAYERZERO_MAX_CONTRIBUTION_ETH * 1e18))
    if (maxContribWei > capWei) maxContribWei = capWei
  }

  const priceScaled = BigInt(Math.round(ethUsdPrice * 1e8))
  const usdTimes1e8 = (maxContribWei * priceScaled) / WEI
  const flooredHundredths = usdTimes1e8 / BigInt(1000000)
  return Number(flooredHundredths) / 100
}
