import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  Chain,
  ethereum,
  polygon,
  sepolia,
} from '@/lib/infura/infuraChains'

export function getChainSlug(chain: Chain) {
  let slug
  if (chain.name === 'Arbitrum One') {
    slug = 'arbitrum'
  } else {
    slug = chain.name?.toLowerCase().replace(/\s+/g, '-') ?? ''
  }
  return slug
}

export function v4SlugToV5Chain(slug: string) {
  const slugsToChains: Record<string, Chain> = {
    arbitrum,
    ethereum,
    polygon,
    base,
    sepolia,
    'arbitrum-sepolia': arbitrumSepolia,
    'base-sepolia': baseSepolia,
  }

  return slugsToChains?.[slug]
}
