import { Page, BrowserContext } from '@playwright/test'

/**
 * Wallet mocking utilities for testing Web3 interactions
 * Supports MetaMask, WalletConnect, and Privy auth mocking
 */

export interface MockWallet {
  address: string
  privateKey: string
  chainId: number
}

// Test wallets (DO NOT use in production - these are for testing only)
export const TEST_WALLETS: Record<string, MockWallet> = {
  user1: {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    chainId: 1, // Mainnet
  },
  user2: {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    chainId: 1,
  },
  // Sepolia testnet wallet
  testnetUser: {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    chainId: 11155111, // Sepolia
  },
  // Arbitrum wallet
  arbitrumUser: {
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
    chainId: 42161, // Arbitrum One
  },
}

/**
 * Mock Ethereum provider for injecting into the page
 */
export async function injectMockEthereumProvider(
  page: Page,
  wallet: MockWallet
): Promise<void> {
  await page.addInitScript((walletData) => {
    const mockProvider = {
      isMetaMask: true,
      selectedAddress: walletData.address,
      chainId: `0x${walletData.chainId.toString(16)}`,
      networkVersion: walletData.chainId.toString(),
      
      request: async ({ method, params }: { method: string; params?: unknown[] }) => {
        switch (method) {
          case 'eth_requestAccounts':
          case 'eth_accounts':
            return [walletData.address]
          
          case 'eth_chainId':
            return `0x${walletData.chainId.toString(16)}`
          
          case 'net_version':
            return walletData.chainId.toString()
          
          case 'wallet_switchEthereumChain':
            // Simulate successful chain switch
            return null
          
          case 'eth_getBalance':
            // Return 10 ETH for testing
            return '0x8AC7230489E80000'
          
          case 'eth_estimateGas':
            return '0x5208' // 21000 gas
          
          case 'eth_gasPrice':
            return '0x3B9ACA00' // 1 Gwei
          
          case 'personal_sign':
          case 'eth_signTypedData_v4':
            // Return a mock signature
            return '0x' + '00'.repeat(65)
          
          default:
            console.log(`[MockProvider] Unhandled method: ${method}`, params)
            throw new Error(`Method ${method} not mocked`)
        }
      },
      
      on: (event: string, callback: (...args: unknown[]) => void) => {
        // Store event listeners for potential triggering
        console.log(`[MockProvider] Registered listener for: ${event}`)
      },
      
      removeListener: () => {},
      
      // Emit account/chain changes
      _emitAccountsChanged: (accounts: string[]) => {
        window.dispatchEvent(new CustomEvent('accountsChanged', { detail: accounts }))
      },
      
      _emitChainChanged: (chainId: string) => {
        window.dispatchEvent(new CustomEvent('chainChanged', { detail: chainId }))
      },
    }
    
    // @ts-ignore
    window.ethereum = mockProvider
  }, wallet)
}

/**
 * Mock Privy authentication state
 */
export async function mockPrivyAuth(
  page: Page,
  options: {
    authenticated: boolean
    wallet?: MockWallet
    email?: string
  }
): Promise<void> {
  await page.addInitScript((opts) => {
    // Store mock Privy state in localStorage
    if (opts.authenticated && opts.wallet) {
      localStorage.setItem('privy:authenticated', 'true')
      localStorage.setItem('privy:wallet', JSON.stringify({
        address: opts.wallet.address,
        chainId: opts.wallet.chainId,
      }))
      if (opts.email) {
        localStorage.setItem('privy:email', opts.email)
      }
    }
  }, options)
}

/**
 * Wait for wallet connection UI to appear and interact with it
 */
export async function waitForWalletConnection(page: Page): Promise<void> {
  // Wait for common wallet connection modals
  const walletModalSelectors = [
    '[data-testid="wallet-modal"]',
    '[class*="wallet-modal"]',
    '[class*="connect-wallet"]',
    'button:has-text("Connect Wallet")',
    'button:has-text("Connect")',
  ]
  
  await page.waitForSelector(walletModalSelectors.join(', '), {
    timeout: 10000,
  }).catch(() => {
    console.log('No wallet modal detected')
  })
}

/**
 * Simulate a wallet disconnect
 */
export async function disconnectWallet(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Clear wallet-related localStorage
    const keysToRemove = Object.keys(localStorage).filter(
      key => key.includes('wallet') || key.includes('privy') || key.includes('wagmi')
    )
    keysToRemove.forEach(key => localStorage.removeItem(key))
    
    // Emit disconnect event
    if (window.ethereum) {
      window.dispatchEvent(new CustomEvent('accountsChanged', { detail: [] }))
    }
  })
}

/**
 * Get wallet connection state from page
 */
export async function getWalletState(page: Page): Promise<{
  connected: boolean
  address?: string
  chainId?: number
}> {
  return page.evaluate(() => {
    const ethereum = (window as any).ethereum
    if (!ethereum?.selectedAddress) {
      return { connected: false }
    }
    return {
      connected: true,
      address: ethereum.selectedAddress,
      chainId: parseInt(ethereum.chainId, 16),
    }
  })
}

/**
 * Switch chain in mock provider
 */
export async function switchChain(page: Page, chainId: number): Promise<void> {
  await page.evaluate((targetChainId) => {
    const ethereum = (window as any).ethereum
    if (ethereum) {
      ethereum.chainId = `0x${targetChainId.toString(16)}`
      ethereum.networkVersion = targetChainId.toString()
      window.dispatchEvent(new CustomEvent('chainChanged', { 
        detail: `0x${targetChainId.toString(16)}` 
      }))
    }
  }, chainId)
}

// Chain configurations for common networks
export const CHAINS = {
  mainnet: { id: 1, name: 'Ethereum Mainnet' },
  sepolia: { id: 11155111, name: 'Sepolia Testnet' },
  arbitrum: { id: 42161, name: 'Arbitrum One' },
  arbitrumSepolia: { id: 421614, name: 'Arbitrum Sepolia' },
  base: { id: 8453, name: 'Base' },
  baseSepolia: { id: 84532, name: 'Base Sepolia' },
} as const
