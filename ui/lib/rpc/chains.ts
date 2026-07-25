import { defineChain } from 'thirdweb'
import { Chain as ThirdwebChain } from 'thirdweb/chains'

const infuraKey = process.env.NEXT_PUBLIC_INFURA_KEY
const etherscanApiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY

const ankrApiKey = process.env.NEXT_PUBLIC_ANKR_API_KEY

const infuraRpcs = {
  arbitrum: `https://arbitrum-mainnet.infura.io/v3/${infuraKey}`,
  ethereum: `https://mainnet.infura.io/v3/${infuraKey}`,
  base: `https://base-mainnet.infura.io/v3/${infuraKey}`,
  polygon: `https://polygon-mainnet.infura.io/v3/${infuraKey}`,
  sepolia: `https://sepolia.infura.io/v3/${infuraKey}`,
  arbitrumSepolia: `https://arbitrum-sepolia.infura.io/v3/${infuraKey}`,
  optimismSepolia: `https://optimism-sepolia.infura.io/v3/${infuraKey}`,
  baseSepolia: `https://base-sepolia.infura.io/v3/${infuraKey}`,
}

const ankrRpcBase = `https://rpc.ankr.com`

const ankrRpcs = {
  polygon: `${ankrRpcBase}/polygon/${ankrApiKey}`,
  ethereum: `${ankrRpcBase}/eth/${ankrApiKey}`,
  arbitrum: `${ankrRpcBase}/arbitrum/${ankrApiKey}`,
  base: `${ankrRpcBase}/base/${ankrApiKey}`,
}

const useAnkr = process.env.NEXT_PUBLIC_RPC === 'ankr'
const mainnetRpc = useAnkr ? ankrRpcs : infuraRpcs

/**
 * Browser reads go through `/api/rpc/<chainId>`, which tries Infura then public
 * fallbacks (see `serverJsonRpc.proxyJsonRpcRequest`). That keeps the signed-in
 * dashboard alive when the shared Infura key returns HTTP 429.
 *
 * Server-side code keeps the direct Infura/Ankr URL so SSR / API routes / scripts
 * do not recurse into the Next API from the same process.
 *
 * `NEXT_PUBLIC_RPC=ankr` still bypasses the proxy and talks to Ankr directly.
 */
function clientRpcUrl(chainId: number, directRpc: string): string {
  if (useAnkr) return directRpc
  // Server / SSR: talk to Infura (or Ankr) directly — never recurse into the
  // Next API from the same process.
  if (typeof window === 'undefined') return directRpc
  // Absolute URL so viem/thirdweb's HTTP transport does not reject a relative path.
  return `${window.location.origin}/api/rpc/${chainId}`
}

export type Chain = ThirdwebChain

export const ethereum = defineChain({
  id: 1,
  name: 'Ethereum',
  rpc: clientRpcUrl(1, mainnetRpc.ethereum),
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorers: [
    {
      name: 'Etherscan',
      url: 'https://etherscan.io',
      apiUrl: `https://api.etherscan.io/v2/api?apikey=${etherscanApiKey}&chainid=1`,
    },
  ],
})

export const arbitrum = defineChain({
  id: 42161,
  name: 'Arbitrum One',
  // Allow a fork/Tenderly RPC override for end-to-end preview testing (Track B of
  // the Frank re-open rollout). Falls back to the normal Infura/Ankr mainnet RPC
  // (browser → /api/rpc proxy with public fallbacks).
  rpc:
    process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ||
    clientRpcUrl(42161, mainnetRpc.arbitrum),
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorers: [
    {
      name: 'Arbiscan',
      url: 'https://arbiscan.io',
      apiUrl: `https://api.etherscan.io/v2/api?apikey=${etherscanApiKey}&chainid=42161`,
    },
  ],
})

export const base = defineChain({
  id: 8453,
  name: 'Base',
  rpc: clientRpcUrl(8453, mainnetRpc.base),
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorers: [
    {
      name: 'Basescan',
      url: 'https://basescan.org',
      apiUrl: `https://api.etherscan.io/v2/api?apikey=${etherscanApiKey}&chainid=8453`,
    },
  ],
})

export const polygon = defineChain({
  id: 137,
  name: 'Polygon',
  rpc: clientRpcUrl(137, mainnetRpc.polygon),
  nativeCurrency: {
    name: 'Matic',
    symbol: 'MATIC',
    decimals: 18,
  },
  blockExplorers: [
    {
      name: 'PolygonScan',
      url: 'https://polygonscan.com',
      apiUrl: `https://api.etherscan.io/v2/api?apikey=${etherscanApiKey}&chainid=137`,
    },
  ],
})

export const sepolia = defineChain({
  id: 11155111,
  name: 'Sepolia',
  rpc: clientRpcUrl(11155111, infuraRpcs.sepolia),
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorers: [
    {
      name: 'Etherscan',
      url: 'https://sepolia.etherscan.io',
      apiUrl: `https://api.etherscan.io/v2/api?apikey=${etherscanApiKey}&chainid=11155111`,
    },
  ],
  testnet: true,
})

export const arbitrumSepolia = defineChain({
  id: 421614,
  name: 'Arbitrum Sepolia',
  rpc: clientRpcUrl(421614, infuraRpcs.arbitrumSepolia),
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorers: [
    {
      name: 'Arbiscan',
      url: 'https://sepolia.arbiscan.io',
      apiUrl: `https://api.etherscan.io/v2/api?apikey=${etherscanApiKey}&chainid=421614`,
    },
  ],
  testnet: true,
})

export const optimismSepolia = defineChain({
  id: 11155420,
  name: 'Optimism Sepolia',
  rpc: clientRpcUrl(11155420, infuraRpcs.optimismSepolia),
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorers: [
    {
      name: 'Etherscan',
      url: 'https://sepolia-optimism.etherscan.io',
      apiUrl: `https://api.etherscan.io/v2/api?apikey=${etherscanApiKey}&chainid=11155420`,
    },
  ],
  testnet: true,
})

export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  rpc: clientRpcUrl(84532, infuraRpcs.baseSepolia),
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorers: [
    {
      name: 'Basescan',
      url: 'https://sepolia.basescan.org',
      apiUrl: `https://api.etherscan.io/v2/api?apikey=${etherscanApiKey}&chainid=84532`,
    },
  ],
  testnet: true,
})
