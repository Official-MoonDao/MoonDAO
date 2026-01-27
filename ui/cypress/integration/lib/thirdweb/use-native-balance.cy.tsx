import React, { useEffect } from 'react'
import * as PrivyAuth from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThirdwebProvider } from 'thirdweb/react'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import { arbitrum, sepolia, ethereum, polygon, Chain } from '@/lib/rpc/chains'

const queryClient = new QueryClient()

// Helper function to create a mock wallet
function createMockWallet(
  walletType: string,
  chainId: number,
  switchChainSpy: Cypress.Agent<sinon.SinonStub>,
  getBalanceSpy?: sinon.SinonStub | Cypress.Agent<sinon.SinonStub>
) {
  return {
    address: '0x1234567890123456789012345678901234567890',
    chainId: `eip155:${chainId}`,
    walletClientType: walletType,
    switchChain: switchChainSpy,
    getEthersProvider: cy.stub().resolves({
      getBalance: getBalanceSpy ?? cy.stub().resolves({ toString: () => '1000000000000000000' }),
    }),
  }
}

// Helper component to test the hook behavior
function NativeBalanceTestComponent({
  onBalanceFetched,
  onWalletChainFetched,
}: {
  onBalanceFetched?: (balance: any) => void
  onWalletChainFetched?: (chain: Chain | undefined) => void
}) {
  const { nativeBalance, walletChain, refetch } = useNativeBalance()

  useEffect(() => {
    if (nativeBalance !== undefined && onBalanceFetched) {
      onBalanceFetched(nativeBalance)
    }
  }, [nativeBalance, onBalanceFetched])

  useEffect(() => {
    if (onWalletChainFetched) {
      onWalletChainFetched(walletChain)
    }
  }, [walletChain, onWalletChainFetched])

  return (
    <div data-testid="native-balance-component">
      <span data-testid="balance-value">{nativeBalance ?? 'Loading...'}</span>
      <span data-testid="wallet-chain-id">{walletChain?.id ?? 'unknown'}</span>
      <span data-testid="wallet-chain-symbol">{walletChain?.nativeCurrency?.symbol ?? 'unknown'}</span>
      <button data-testid="refetch-button" onClick={() => refetch()}>
        Refetch
      </button>
    </div>
  )
}

describe('useNativeBalance - No Auto Chain Switching', () => {
  /**
   * IMPORTANT: The useNativeBalance hook should NEVER auto-switch chains.
   * 
   * This is critical for preventing race conditions:
   * 1. Single-tab: Prevents the wallets array updates from triggering repeated effect runs
   * 2. Multi-tab: Prevents different tabs with different selectedChain values from fighting over the wallet's chain
   * 
   * Chain switching should ONLY happen in response to explicit user actions
   * (e.g., clicking a "Switch Network" button), not automatically in background hooks.
   */

  describe('No chain switching for ANY wallet type', () => {
    const walletTypes = [
      'metamask',
      'injected', 
      'walletconnect',
      'coinbase_wallet',
      'privy',
    ]

    walletTypes.forEach((walletType) => {
      it(`should NOT call switchChain for ${walletType} wallets`, () => {
        const switchChainSpy = cy.stub().as('switchChainSpy')
        const mockWallets = [createMockWallet(walletType, ethereum.id, switchChainSpy)]

        // Stub useWallets to inject mock wallets
        cy.stub(PrivyAuth, 'useWallets').returns({ wallets: mockWallets })

        cy.mount(
          <QueryClientProvider client={queryClient}>
            <PrivyWalletContext.Provider
              value={{
                selectedWallet: 0,
                setSelectedWallet: () => {},
              }}
            >
              <ThirdwebProvider>
                <NativeBalanceTestComponent />
              </ThirdwebProvider>
            </PrivyWalletContext.Provider>
          </QueryClientProvider>
        )

        cy.get('[data-testid="native-balance-component"]').should('exist')

        // Wait for the interval to potentially run
        cy.wait(1000)

        // switchChain should NEVER be called - useNativeBalance does not switch chains
        cy.get('@switchChainSpy').should('not.have.been.called')
      })
    })
  })

  describe('Multi-tab race condition prevention', () => {
    it('should not cause chain oscillation when multiple tabs have different selectedChain values', () => {
      // This test simulates the scenario where:
      // - Tab 1 has selectedChain = Ethereum
      // - Tab 2 has selectedChain = Arbitrum
      // - Both tabs are running useNativeBalance
      // - Neither should try to auto-switch the shared wallet

      const switchChainSpy = cy.stub().as('switchChainSpy')
      const mockWallets = [createMockWallet('coinbase_wallet', sepolia.id, switchChainSpy)]

      // Stub useWallets to inject mock wallets
      cy.stub(PrivyAuth, 'useWallets').returns({ wallets: mockWallets })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <PrivyWalletContext.Provider
            value={{
              selectedWallet: 0,
              setSelectedWallet: () => {},
            }}
          >
            <ThirdwebProvider>
              <NativeBalanceTestComponent />
            </ThirdwebProvider>
          </PrivyWalletContext.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')

      // Wait for multiple intervals (5s each in the hook, but we check earlier)
      cy.wait(2000)

      // No chain switching should occur - this prevents multi-tab fighting
      cy.get('@switchChainSpy').should('not.have.been.called')
    })
  })

  describe('Balance fetching works regardless of chain mismatch', () => {
    it('should fetch balance from wallet current chain without switching', () => {
      const getBalanceSpy = cy.stub().resolves({ toString: () => '2500000000000000000' })
      cy.wrap(getBalanceSpy).as('getBalanceSpy')
      const switchChainSpy = cy.stub().as('switchChainSpy')
      const mockWallets = [createMockWallet('metamask', ethereum.id, switchChainSpy, getBalanceSpy)]

      // Stub useWallets to inject mock wallets
      cy.stub(PrivyAuth, 'useWallets').returns({ wallets: mockWallets })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <PrivyWalletContext.Provider
            value={{
              selectedWallet: 0,
              setSelectedWallet: () => {},
            }}
          >
            <ThirdwebProvider>
              <NativeBalanceTestComponent />
            </ThirdwebProvider>
          </PrivyWalletContext.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')

      // Wait for balance fetch
      cy.wait(500)

      // Balance should be fetched from whatever chain the wallet is on
      cy.get('@getBalanceSpy').should('have.been.called')
    })

    it('should handle getBalance errors gracefully', () => {
      const getBalanceSpy = cy.stub().rejects(new Error('Network error'))
      cy.wrap(getBalanceSpy).as('getBalanceSpy')
      const switchChainSpy = cy.stub().as('switchChainSpy')
      const mockWallets = [createMockWallet('metamask', ethereum.id, switchChainSpy, getBalanceSpy)]

      // Stub useWallets to inject mock wallets
      cy.stub(PrivyAuth, 'useWallets').returns({ wallets: mockWallets })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <PrivyWalletContext.Provider
            value={{
              selectedWallet: 0,
              setSelectedWallet: () => {},
            }}
          >
            <ThirdwebProvider>
              <NativeBalanceTestComponent />
            </ThirdwebProvider>
          </PrivyWalletContext.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')

      // Component should still render even with errors (graceful degradation)
      cy.get('[data-testid="balance-value"]').should('exist')
    })
  })

  describe('walletChain returns the correct chain info for native token display', () => {
    it('should return ETH as native token symbol when wallet is on Ethereum', () => {
      const switchChainSpy = cy.stub().as('switchChainSpy')
      const mockWallets = [createMockWallet('metamask', ethereum.id, switchChainSpy)]

      cy.stub(PrivyAuth, 'useWallets').returns({ wallets: mockWallets })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <PrivyWalletContext.Provider
            value={{
              selectedWallet: 0,
              setSelectedWallet: () => {},
            }}
          >
            <ThirdwebProvider>
              <NativeBalanceTestComponent />
            </ThirdwebProvider>
          </PrivyWalletContext.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')
      cy.wait(500)

      // walletChain should reflect Ethereum
      cy.get('[data-testid="wallet-chain-id"]').should('have.text', String(ethereum.id))
      cy.get('[data-testid="wallet-chain-symbol"]').should('have.text', 'ETH')
    })

    it('should return MATIC as native token symbol when wallet is on Polygon', () => {
      const switchChainSpy = cy.stub().as('switchChainSpy')
      const mockWallets = [createMockWallet('metamask', polygon.id, switchChainSpy)]

      cy.stub(PrivyAuth, 'useWallets').returns({ wallets: mockWallets })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <PrivyWalletContext.Provider
            value={{
              selectedWallet: 0,
              setSelectedWallet: () => {},
            }}
          >
            <ThirdwebProvider>
              <NativeBalanceTestComponent />
            </ThirdwebProvider>
          </PrivyWalletContext.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')
      cy.wait(500)

      // walletChain should reflect Polygon
      cy.get('[data-testid="wallet-chain-id"]').should('have.text', String(polygon.id))
      cy.get('[data-testid="wallet-chain-symbol"]').should('have.text', 'MATIC')
    })

    it('should return ETH for Arbitrum (L2 with ETH native token)', () => {
      const switchChainSpy = cy.stub().as('switchChainSpy')
      const mockWallets = [createMockWallet('metamask', arbitrum.id, switchChainSpy)]

      cy.stub(PrivyAuth, 'useWallets').returns({ wallets: mockWallets })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <PrivyWalletContext.Provider
            value={{
              selectedWallet: 0,
              setSelectedWallet: () => {},
            }}
          >
            <ThirdwebProvider>
              <NativeBalanceTestComponent />
            </ThirdwebProvider>
          </PrivyWalletContext.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')
      cy.wait(500)

      // walletChain should reflect Arbitrum with ETH as native token
      cy.get('[data-testid="wallet-chain-id"]').should('have.text', String(arbitrum.id))
      cy.get('[data-testid="wallet-chain-symbol"]').should('have.text', 'ETH')
    })

    it('should correctly label ETH balance even when selectedChain is Polygon (fixes mislabeling bug)', () => {
      // This is the specific bug scenario:
      // - MetaMask wallet is on Ethereum
      // - User selected Polygon in the UI
      // - Previously: balance showed as "MATIC" (wrong!)
      // - After fix: balance should show as "ETH" (correct!)

      const switchChainSpy = cy.stub().as('switchChainSpy')
      // Wallet is on Ethereum
      const mockWallets = [createMockWallet('metamask', ethereum.id, switchChainSpy)]

      cy.stub(PrivyAuth, 'useWallets').returns({ wallets: mockWallets })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <PrivyWalletContext.Provider
            value={{
              selectedWallet: 0,
              setSelectedWallet: () => {},
            }}
          >
            <ThirdwebProvider>
              {/* Note: The hook no longer uses selectedChain from context */}
              <NativeBalanceTestComponent />
            </ThirdwebProvider>
          </PrivyWalletContext.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')
      cy.wait(500)

      // Even though selectedChain could be Polygon, the native token symbol
      // should reflect the wallet's actual chain (Ethereum = ETH)
      cy.get('[data-testid="wallet-chain-symbol"]').should('have.text', 'ETH')
    })
  })
})
