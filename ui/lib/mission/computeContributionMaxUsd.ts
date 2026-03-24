import { LAYERZERO_MAX_CONTRIBUTION_ETH } from 'const/config'
import { arbitrum, base, ethereum } from '@/lib/rpc/chains'

/**
 * Max USD contribution from native ETH balance, matching mission contribute modal / pay card rules:
 * same-chain gas reserves (Arbitrum/Base 0.0001 ETH, mainnet 0.001 ETH, else 0.001),
 * cross-chain leaves 0.001 ETH, LayerZero cap from config for eth/base sources.
 */
export function computeContributionMaxUsd(input: {
  balanceEth: number
  selectedChainId: number
  chainSlug: string
  defaultChainSlug: string
  ethUsdPrice: number
}): number | null {
  const { balanceEth, selectedChainId, chainSlug, defaultChainSlug, ethUsdPrice } = input
  if (!Number.isFinite(balanceEth) || balanceEth <= 0) return null
  if (!Number.isFinite(ethUsdPrice) || ethUsdPrice <= 0) return null

  const isCrossChain = chainSlug !== defaultChainSlug

  let maxContribEth: number
  if (!isCrossChain) {
    let gasReserveEth = 0.001
    if (selectedChainId === arbitrum.id) gasReserveEth = 0.0001
    else if (selectedChainId === base.id) gasReserveEth = 0.0001
    else if (selectedChainId === ethereum.id) gasReserveEth = 0.001
    maxContribEth = Math.max(0, balanceEth - gasReserveEth)
  } else {
    maxContribEth = Math.max(0, balanceEth - 0.001)
  }

  let maxUsd = maxContribEth * ethUsdPrice
  if (maxUsd <= 0) return null

  if (isCrossChain && (chainSlug === 'ethereum' || chainSlug === 'base')) {
    maxUsd = Math.min(maxUsd, LAYERZERO_MAX_CONTRIBUTION_ETH * ethUsdPrice)
  }

  return Math.floor(maxUsd * 100) / 100
}
