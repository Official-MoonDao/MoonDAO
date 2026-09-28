import { getChainById } from '@/lib/thirdweb/chain'
import { deprizePinnedChainId } from './deprizeChainPin'

/**
 * App network a prefixed DePrize URL should open on.
 * `/deprize/sep/2` is a Sepolia prize even when the build default is Arbitrum.
 */
export function chainForDeprizePath(pathname: string | undefined) {
  const chainId = deprizePinnedChainId(pathname)
  if (chainId == null) return undefined
  return getChainById(chainId)
}
