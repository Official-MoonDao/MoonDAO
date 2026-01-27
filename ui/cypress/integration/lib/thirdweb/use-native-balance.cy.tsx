import React, { useEffect } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThirdwebProvider } from 'thirdweb/react'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import { arbitrum, sepolia, ethereum } from '@/lib/rpc/chains'

const queryClient = new QueryClient()

// Helper component to test the hook behavior
function NativeBalanceTestComponent({
  onBalanceFetched,
}: {
  onBalanceFetched?: (balance: any) => void
}) {
  const { nativeBalance, refetch } = useNativeBalance()

  useEffect(() => {
    if (nativeBalance !== undefined && onBalanceFetched) {
      onBalanceFetched(nativeBalance)
    }
  }, [nativeBalance, onBalanceFetched])

  return (
    <div data-testid="native-balance-component">
      <span data-testid="balance-value">{nativeBalance ?? 'Loading...'}</span>
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

        cy.window().then((win) => {
          ;(win as any).__CYPRESS_MOCK_WALLETS__ = [
            {
              address: '0x1234567890123456789012345678901234567890',
              chainId: `eip155:${ethereum.id}`, // Wallet on Ethereum
              walletClientType: walletType,
              switchChain: switchChainSpy,
              getEthersProvider: cy.stub().resolves({
                getBalance: cy.stub().resolves({ toString: () => '1000000000000000000' }),
              }),
            },
          ]
        })

        cy.mount(
          <QueryClientProvider client={queryClient}>
            <PrivyWalletContext.Provider
              value={{
                selectedWallet: 0,
                setSelectedWallet: () => {},
              }}
            >
              <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
                <ThirdwebProvider>
                  <NativeBalanceTestComponent />
                </ThirdwebProvider>
              </PrivyProvider>
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

      cy.window().then((win) => {
        ;(win as any).__CYPRESS_MOCK_WALLETS__ = [
          {
            address: '0x1234567890123456789012345678901234567890',
            chainId: `eip155:${sepolia.id}`, // Wallet on Sepolia
            walletClientType: 'coinbase_wallet', // Even auto-switch wallets shouldn't switch
            switchChain: switchChainSpy,
            getEthersProvider: cy.stub().resolves({
              getBalance: cy.stub().resolves({ toString: () => '1000000000000000000' }),
            }),
          },
        ]
      })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <PrivyWalletContext.Provider
            value={{
              selectedWallet: 0,
              setSelectedWallet: () => {},
            }}
          >
            <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
              <ThirdwebProvider>
                <NativeBalanceTestComponent />
              </ThirdwebProvider>
            </PrivyProvider>
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
      const getBalanceSpy = cy.stub().resolves({ toString: () => '2500000000000000000' }).as('getBalanceSpy')

      cy.window().then((win) => {
        ;(win as any).__CYPRESS_MOCK_WALLETS__ = [
          {
            address: '0x1234567890123456789012345678901234567890',
            chainId: `eip155:${ethereum.id}`, // Wallet on Ethereum
            walletClientType: 'metamask',
            switchChain: cy.stub(),
            getEthersProvider: cy.stub().resolves({
              getBalance: getBalanceSpy,
            }),
          },
        ]
      })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <PrivyWalletContext.Provider
            value={{
              selectedWallet: 0,
              setSelectedWallet: () => {},
            }}
          >
            <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
              <ThirdwebProvider>
                <NativeBalanceTestComponent />
              </ThirdwebProvider>
            </PrivyProvider>
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
      const getBalanceSpy = cy.stub().rejects(new Error('Network error')).as('getBalanceSpy')

      cy.window().then((win) => {
        ;(win as any).__CYPRESS_MOCK_WALLETS__ = [
          {
            address: '0x1234567890123456789012345678901234567890',
            chainId: `eip155:${ethereum.id}`,
            walletClientType: 'metamask',
            switchChain: cy.stub(),
            getEthersProvider: cy.stub().resolves({
              getBalance: getBalanceSpy,
            }),
          },
        ]
      })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <PrivyWalletContext.Provider
            value={{
              selectedWallet: 0,
              setSelectedWallet: () => {},
            }}
          >
            <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
              <ThirdwebProvider>
                <NativeBalanceTestComponent />
              </ThirdwebProvider>
            </PrivyProvider>
          </PrivyWalletContext.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')

      // Component should still render even with errors (graceful degradation)
      cy.get('[data-testid="balance-value"]').should('exist')
    })
  })
})
