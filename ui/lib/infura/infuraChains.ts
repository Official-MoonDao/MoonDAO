import { defineChain } from 'thirdweb'
import { Chain as ThirdwebChain } from 'thirdweb/chains'

const infuraKey = process.env.NEXT_PUBLIC_INFURA_KEY
const etherscanApiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY
const arbiscanApiKey = process.env.NEXT_PUBLIC_ARBISCAN_API_KEY
const basescanApiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY
const polygonscanApiKey = process.env.NEXT_PUBLIC_POLYGONSCAN_API_KEY

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
      apiUrl: `https://api.etherscan.io/api?apikey=${etherscanApiKey}`,
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
      apiUrl: `https://api.arbiscan.io/api?apikey=${arbiscanApiKey}`,
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
      apiUrl: `https://api.basescan.org/api?apikey=${basescanApiKey}`,
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
      apiUrl: `https://api.polygonscan.com/api?apikey=${polygonscanApiKey}`,
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
      apiUrl: `https://api-sepolia.etherscan.io/api?apikey=${etherscanApiKey}`,
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
      apiUrl: `https://api-sepolia.arbiscan.io/api?apikey=${arbiscanApiKey}`,
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
      apiUrl: `https://api-sepolia-optimism.etherscan.io/api?apikey=${etherscanApiKey}`,
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
      apiUrl: `https://api-sepolia.basescan.org/api?apikey=${basescanApiKey}`,
    },
  ],
})
