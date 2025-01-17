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
  if (chain.name === 'Arbitrum One') {
    slug = 'arbitrum'
  } else {
    slug = chain.name?.toLowerCase().replace(/\s+/g, '-') ?? ''
  }
  return slug
}

export const thirdwebV4SlugsToV5Chains: { [key: string]: Chain } = {
  arbitrum,
  ethereum,
  polygon,
  base,
  sepolia,
  'arbitrum-sepolia': arbitrumSepolia,
  'base-sepolia': baseSepolia,
}
