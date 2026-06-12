import { arbitrum, sepolia, arbitrumSepolia } from '../lib/rpc/chains'
import { getChainSlug } from '../lib/thirdweb/chain'

// Kept in a tiny standalone module so the global app shell (_app.tsx) can read
// the default chain without pulling in the full const/config module (which
// loads every deployment config at import time).
export const TEST_CHAIN =
  process.env.NEXT_PUBLIC_TEST_CHAIN === 'arbitrum-sepolia' ? arbitrumSepolia : sepolia
export const DEFAULT_CHAIN_V5 = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : TEST_CHAIN

export const DEFAULT_CHAIN_V5_SLUG = getChainSlug(DEFAULT_CHAIN_V5)
