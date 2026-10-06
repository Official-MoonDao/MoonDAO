import { arbitrum, arbitrumSepolia, sepolia } from '@privy-io/chains'
import { DEFAULT_CHAIN_V5 } from 'const/defaultChain'

/**
 * Privy embedded wallets initialize on `defaultChain`. The SDK's fallback is
 * Ethereum mainnet, which is not the chain this app reads and writes on.
 * Passing the matching Privy chain object (not a bare `{ id }`) keeps the
 * wallet on Arbitrum, Sepolia, or Arbitrum Sepolia from the first connect.
 */
export function privyDefaultChain() {
  const id = DEFAULT_CHAIN_V5.id
  if (id === arbitrumSepolia.id) return arbitrumSepolia
  if (id === sepolia.id) return sepolia
  return arbitrum
}
