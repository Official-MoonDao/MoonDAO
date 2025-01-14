import { Chain } from 'thirdweb/chains'

export function getChainSlug(chain: Chain) {
  let slug
  if (chain.name === 'Arbitrum One') {
    slug = 'arbitrum'
  } else {
    slug = chain.name?.toLowerCase().replace(/\s+/g, '-') ?? ''
  }
  return slug
}
