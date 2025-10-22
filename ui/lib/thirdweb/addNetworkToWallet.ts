import toast from 'react-hot-toast'
import {
  arbitrum,
  base,
  ethereum,
  sepolia,
  arbitrumSepolia,
  optimismSepolia,
  Chain,
} from '@/lib/rpc/chains'

type ChainConfig = {
  chainId: string
  chainName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls: string[]
}

type ChainConfigMap = {
  [key: number]: ChainConfig
}

const CHAIN_CONFIGS: ChainConfigMap = {
  [arbitrum.id]: {
    chainId: `0x${arbitrum.id.toString(16)}`,
    chainName: 'Arbitrum One',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io'],
  },
  [base.id]: {
    chainId: `0x${base.id.toString(16)}`,
    chainName: 'Base',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org'],
  },
  [ethereum.id]: {
    chainId: `0x${ethereum.id.toString(16)}`,
    chainName: 'Ethereum',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://eth.llamarpc.com'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  [sepolia.id]: {
    chainId: `0x${sepolia.id.toString(16)}`,
    chainName: 'Sepolia',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://rpc.sepolia.org'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  [arbitrumSepolia.id]: {
    chainId: `0x${arbitrumSepolia.id.toString(16)}`,
    chainName: 'Arbitrum Sepolia',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://sepolia.arbiscan.io'],
  },
  [optimismSepolia.id]: {
    chainId: `0x${optimismSepolia.id.toString(16)}`,
    chainName: 'Optimism Sepolia',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://sepolia.optimism.io'],
    blockExplorerUrls: ['https://sepolia-optimism.etherscan.io'],
  },
}

export async function addNetworkToWallet(chain: Chain): Promise<boolean> {
  const ethereum = window?.ethereum
  if (!ethereum) {
    toast.error('No Ethereum provider found.')
    return false
  }

  try {
    const chainData = CHAIN_CONFIGS[chain.id]
    if (!chainData) {
      throw new Error(`Unsupported chain: ${chain.id}`)
    }

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainData.chainId }],
      })
      return true
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [chainData],
        })
        toast.success(`Added ${chainData.chainName} to your wallet.`)
        return true
      }
      throw switchError
    }
  } catch (error: any) {
    if (error.code === 4001) {
      toast.error('Please add the network to continue.')
    }
    console.error('Error adding network:', error)
    return false
  }
}

export async function checkIfChainExists(chain: Chain): Promise<boolean> {
  const ethereum = window?.ethereum
  if (!ethereum) {
    return false
  }

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chain.id.toString(16)}` }],
    })
    return true
  } catch (error: any) {
    return error.code !== 4902
  }
}
