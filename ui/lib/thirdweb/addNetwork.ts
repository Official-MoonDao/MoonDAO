import toast from 'react-hot-toast'
import {
  arbitrum,
  base,
  ethereum,
  sepolia,
  arbitrumSepolia,
} from 'thirdweb/chains'

export async function addNetworkToWallet(chain: any) {
  try {
    // Get the chain configuration
    const chainConfig = {
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
    }

    const chainData = chainConfig[chain.id]
    if (!chainData) {
      throw new Error('Unsupported chain')
    }

    try {
      // First try to switch to the chain
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainData.chainId }],
      })
      // If successful, the chain already exists
      return true
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        // Try to add the network to the wallet
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [chainData],
        })
        toast.success(`Added ${chainData.chainName} to your wallet`)
        return true
      }
      // If it's not a 4902 error, rethrow it
      throw switchError
    }
  } catch (error: any) {
    // If the user rejects the request
    if (error.code === 4001) {
      toast.error('Please add the network to continue')
    } else {
      toast.error('Failed to add network to wallet')
    }
    console.error('Error adding network:', error)
    return false
  }
}
