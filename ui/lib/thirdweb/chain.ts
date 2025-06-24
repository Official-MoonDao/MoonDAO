import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  Chain,
  ethereum,
  polygon,
  sepolia,
} from 'thirdweb/chains'

export function getChainSlug(chain: Chain) {
  let slug
  // Special cases for chains with different naming
  if (chain.name === 'Arbitrum One') {
    slug = 'arbitrum'
  } else if (chain.name === 'Base Sepolia Testnet' || chain.name === 'Base Sepolia') {
    slug = 'base-sepolia-testnet'
  } else if (chain.name === 'Arbitrum Sepolia') {
    slug = 'arbitrum-sepolia'
  } else if (chain.name === 'OP Sepolia Testnet' || chain.name === 'Optimism Sepolia') {
    slug = 'op-sepolia'
  } else {
    // Default: lowercase and replace spaces with hyphens
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
