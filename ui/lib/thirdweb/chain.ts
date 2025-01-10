import { Chain } from 'thirdweb/chains'

export function getChainSlug(chain: Chain) {
  return chain.name?.toLowerCase().replace(/\s+/g, '-')
}
