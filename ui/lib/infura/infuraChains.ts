import { defineChain } from 'thirdweb'
import { Chain as ThirdwebChain } from 'thirdweb/chains'

const infuraKey = process.env.NEXT_PUBLIC_INFURA_KEY
const etherscanApiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY

export type Chain = ThirdwebChain

export const ethereum = defineChain({
  id: 1,
  name: 'Ethereum',
  rpc: `https://mainnet.infura.io/v3/${infuraKey}`,
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
  rpc: `https://arbitrum-mainnet.infura.io/v3/${infuraKey}`,
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
  rpc: `https://base-mainnet.infura.io/v3/${infuraKey}`,
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
  rpc: `https://polygon-mainnet.infura.io/v3/${infuraKey}`,
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
  rpc: `https://sepolia.infura.io/v3/${infuraKey}`,
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
})

export const arbitrumSepolia = defineChain({
  id: 421611,
  name: 'Arbitrum Sepolia',
  rpc: `https://arbitrum-sepolia.infura.io/v3/${infuraKey}`,
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorers: [
    {
      name: 'Arbiscan',
      url: 'https://sepolia.arbiscan.io',
      apiUrl: `https://api.etherscan.io/v2/api?apikey=${etherscanApiKey}&chainid=421611`,
    },
  ],
})

export const optimismSepolia = defineChain({
  id: 11155420,
  name: 'Optimism Sepolia',
  rpc: `https://optimism-sepolia.infura.io/v3/${infuraKey}`,
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
})

export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  rpc: `https://base-sepolia.infura.io/v3/${infuraKey}`,
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
})
