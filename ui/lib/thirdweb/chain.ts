import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  Chain,
  ethereum,
  optimismSepolia,
  polygon,
  sepolia,
} from '../rpc/chains'

export function getChainSlug(chain: Chain) {
  let slug
  // Special cases for chains with different naming
  if (chain.name === 'Arbitrum One') {
    slug = 'arbitrum'
  } else if (
    chain.name === 'Base Sepolia Testnet' ||
    chain.name === 'Base Sepolia'
  ) {
    slug = 'base-sepolia-testnet'
  } else if (chain.name === 'Arbitrum Sepolia') {
    slug = 'arbitrum-sepolia'
  } else if (
    chain.name === 'OP Sepolia Testnet' ||
    chain.name === 'Optimism Sepolia'
  ) {
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
    'base-sepolia-testnet': baseSepolia,
    'op-sepolia': optimismSepolia,
  }

  return slugsToChains?.[slug]
}

export function getChainById(chainId: number): Chain | undefined {
  const chainsById: Record<number, Chain> = {
    1: ethereum,
    42161: arbitrum,
    8453: base,
    137: polygon,
    11155111: sepolia,
    421614: arbitrumSepolia,
    84532: baseSepolia,
    11155420: optimismSepolia,
  }

  return chainsById[chainId]
}
