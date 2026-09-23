import type { Chain } from '@/lib/rpc/chains'
import { v4SlugToV5Chain } from '@/lib/thirdweb/chain'

/**
 * App network a prefixed DePrize URL should open on.
 * `/deprize/sep/2` is a Sepolia prize even when the build default is Arbitrum.
 */
export function chainForDeprizePath(pathname: string | undefined): Chain | undefined {
  if (!pathname) return undefined
  if (pathname === '/deprize/sep' || pathname.startsWith('/deprize/sep/')) {
    return v4SlugToV5Chain('sepolia')
  }
  if (pathname === '/deprize/arb' || pathname.startsWith('/deprize/arb/')) {
    return v4SlugToV5Chain('arbitrum')
  }
  return undefined
}
