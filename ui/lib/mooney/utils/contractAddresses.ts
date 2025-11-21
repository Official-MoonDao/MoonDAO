import { MOONEY_ADDRESSES } from 'const/config'
import { Chain } from '@/lib/rpc/chains'
import { arbitrum, base, ethereum, polygon } from '@/lib/rpc/chains'
import { getChainSlug } from '@/lib/thirdweb/chain'

export interface ChainAddressInfo {
  chain: Chain
  address: string
  chainName: string
  color: string
}

const CHAIN_COLORS: Record<string, string> = {
  ethereum: '#3B82F6',
  arbitrum: '#8B5CF6',
  polygon: '#10B981',
  base: '#3B82F6',
}

const CHAIN_DISPLAY_NAMES: Record<string, string> = {
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  polygon: 'Polygon',
  base: 'Base',
}

export const SUPPORTED_CHAINS: Chain[] = [ethereum, arbitrum, polygon, base]

export function getMooneyAddress(chain: Chain): string | undefined {
  const isSupported = SUPPORTED_CHAINS.some((supportedChain) => supportedChain.id === chain.id)
  if (!isSupported) {
    return undefined
  }
  const chainSlug = getChainSlug(chain)
  return MOONEY_ADDRESSES[chainSlug]
}

export function getChainAddressInfo(chain: Chain): ChainAddressInfo | null {
  const chainSlug = getChainSlug(chain)
  const address = MOONEY_ADDRESSES[chainSlug]

  if (!address) return null

  return {
    chain,
    address,
    chainName: CHAIN_DISPLAY_NAMES[chainSlug] || chain.name || '',
    color: CHAIN_COLORS[chainSlug] || '#3B82F6',
  }
}

export function getAllChainAddresses(): ChainAddressInfo[] {
  return SUPPORTED_CHAINS.map(getChainAddressInfo).filter(
    (info): info is ChainAddressInfo => info !== null
  )
}
