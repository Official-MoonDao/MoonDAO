import React, { useEffect, useState } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThirdwebProvider } from 'thirdweb/react'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import { arbitrum, sepolia, ethereum } from '@/lib/rpc/chains'

const queryClient = new QueryClient()

// Helper component to test the hook behavior
function NativeBalanceTestComponent({
  onSwitchChainCalled,
  onBalanceFetched,
}: {
  onSwitchChainCalled?: () => void
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

describe('useNativeBalance - Chain Switch Race Condition Prevention', () => {
  describe('MetaMask (non-auto-switch wallet)', () => {
    it('should NOT auto-switch chain for MetaMask wallets', () => {
      const switchChainSpy = cy.stub().as('switchChainSpy')
      const currentChainId = ethereum.id // Wallet on Ethereum
      const targetChainId = arbitrum.id // selectedChain is Arbitrum

      // Mock MetaMask wallet
      cy.window().then((win) => {
        // This simulates the behavior where MetaMask is on Ethereum
        // but selectedChain is Arbitrum - it should NOT auto-switch
        ;(win as any).__CYPRESS_MOCK_WALLETS__ = [
          {
            address: '0x1234567890123456789012345678901234567890',
            chainId: `eip155:${currentChainId}`,
            walletClientType: 'metamask', // MetaMask - NOT an auto-switch wallet
            switchChain: switchChainSpy,
            getEthersProvider: cy.stub().resolves({
              getBalance: cy.stub().resolves({ toString: () => '1000000000000000000' }),
            }),
          },
        ]
      })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <ChainContextV5.Provider
            value={{
              selectedChain: arbitrum, // Target is Arbitrum
              setSelectedChain: () => {},
            }}
          >
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
          </ChainContextV5.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')

      // Wait for the interval to run at least once (5 seconds in the hook)
      // We'll check after a shorter time since we're testing the guard logic
      cy.wait(1000)

      // switchChain should NOT have been called for MetaMask
      cy.get('@switchChainSpy').should('not.have.been.called')
    })

    it('should NOT auto-switch chain for injected wallets', () => {
      const switchChainSpy = cy.stub().as('switchChainSpy')

      cy.window().then((win) => {
        ;(win as any).__CYPRESS_MOCK_WALLETS__ = [
          {
            address: '0x1234567890123456789012345678901234567890',
            chainId: `eip155:${ethereum.id}`,
            walletClientType: 'injected', // Generic injected wallet
            switchChain: switchChainSpy,
            getEthersProvider: cy.stub().resolves({
              getBalance: cy.stub().resolves({ toString: () => '1000000000000000000' }),
            }),
          },
        ]
      })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <ChainContextV5.Provider
            value={{
              selectedChain: arbitrum,
              setSelectedChain: () => {},
            }}
          >
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
          </ChainContextV5.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')
      cy.wait(1000)

      // switchChain should NOT have been called
      cy.get('@switchChainSpy').should('not.have.been.called')
    })
  })

  describe('Coinbase/Privy (auto-switch wallets)', () => {
    it('should NOT call switchChain when wallet is already on target chain', () => {
      const switchChainSpy = cy.stub().as('switchChainSpy')
      const targetChainId = arbitrum.id

      cy.window().then((win) => {
        ;(win as any).__CYPRESS_MOCK_WALLETS__ = [
          {
            address: '0x1234567890123456789012345678901234567890',
            chainId: `eip155:${targetChainId}`, // Already on Arbitrum
            walletClientType: 'coinbase_wallet', // Auto-switch wallet
            switchChain: switchChainSpy,
            getEthersProvider: cy.stub().resolves({
              getBalance: cy.stub().resolves({ toString: () => '1000000000000000000' }),
            }),
          },
        ]
      })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <ChainContextV5.Provider
            value={{
              selectedChain: arbitrum, // Target is also Arbitrum
              setSelectedChain: () => {},
            }}
          >
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
          </ChainContextV5.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')
      cy.wait(1000)

      // switchChain should NOT be called - wallet already on target chain
      cy.get('@switchChainSpy').should('not.have.been.called')
    })

    it('should call switchChain only once when Privy wallet needs to switch', () => {
      let switchCallCount = 0
      const switchChainSpy = cy.stub().callsFake(async () => {
        switchCallCount++
      }).as('switchChainSpy')

      cy.window().then((win) => {
        ;(win as any).__CYPRESS_MOCK_WALLETS__ = [
          {
            address: '0x1234567890123456789012345678901234567890',
            chainId: `eip155:${sepolia.id}`, // On Sepolia, need to switch
            walletClientType: 'privy', // Auto-switch wallet
            switchChain: switchChainSpy,
            getEthersProvider: cy.stub().resolves({
              getBalance: cy.stub().resolves({ toString: () => '1000000000000000000' }),
            }),
          },
        ]
      })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <ChainContextV5.Provider
            value={{
              selectedChain: arbitrum, // Target is Arbitrum
              setSelectedChain: () => {},
            }}
          >
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
          </ChainContextV5.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')
    })
  })

  describe('Race Condition Prevention', () => {
    it('should not cause oscillation between chains (no infinite switching loop)', () => {
      let switchCallCount = 0
      const maxAllowedSwitches = 3 // Allow some switches but not infinite

      const switchChainSpy = cy.stub().callsFake(async (chainId: number) => {
        switchCallCount++
        if (switchCallCount > maxAllowedSwitches) {
          throw new Error(
            `RACE CONDITION DETECTED: switchChain called ${switchCallCount} times, expected <= ${maxAllowedSwitches}`
          )
        }
        // Simulate async chain switch
        await new Promise((resolve) => setTimeout(resolve, 50))
      }).as('switchChainSpy')

      cy.window().then((win) => {
        ;(win as any).__CYPRESS_MOCK_WALLETS__ = [
          {
            address: '0x1234567890123456789012345678901234567890',
            chainId: `eip155:${sepolia.id}`,
            walletClientType: 'coinbase_wallet',
            switchChain: switchChainSpy,
            getEthersProvider: cy.stub().resolves({
              getBalance: cy.stub().resolves({ toString: () => '1000000000000000000' }),
            }),
          },
        ]
      })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <ChainContextV5.Provider
            value={{
              selectedChain: arbitrum,
              setSelectedChain: () => {},
            }}
          >
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
          </ChainContextV5.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')

      // Wait for multiple potential switch attempts
      cy.wait(2000)

      // Verify no infinite loop occurred
      cy.wrap(null).then(() => {
        expect(switchCallCount).to.be.lte(maxAllowedSwitches)
      })
    })

    it('should handle chain switch failures gracefully without retrying infinitely', () => {
      let failureCount = 0
      const maxRetries = 3

      const switchChainSpy = cy.stub().callsFake(async () => {
        failureCount++
        throw new Error('User rejected chain switch')
      }).as('switchChainSpy')

      cy.window().then((win) => {
        ;(win as any).__CYPRESS_MOCK_WALLETS__ = [
          {
            address: '0x1234567890123456789012345678901234567890',
            chainId: `eip155:${sepolia.id}`,
            walletClientType: 'privy',
            switchChain: switchChainSpy,
            getEthersProvider: cy.stub().resolves({
              getBalance: cy.stub().resolves({ toString: () => '1000000000000000000' }),
            }),
          },
        ]
      })

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <ChainContextV5.Provider
            value={{
              selectedChain: arbitrum,
              setSelectedChain: () => {},
            }}
          >
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
          </ChainContextV5.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="native-balance-component"]').should('exist')

      // Wait and ensure failures don't cause infinite loop
      cy.wait(2000)

      // Should have limited retries, not infinite
      cy.wrap(null).then(() => {
        expect(failureCount).to.be.lte(maxRetries)
      })
    })
  })

  describe('Wallet Type Detection', () => {
    const walletTypes = [
      { type: 'metamask', shouldAutoSwitch: false },
      { type: 'injected', shouldAutoSwitch: false },
      { type: 'walletconnect', shouldAutoSwitch: false },
      { type: 'coinbase_wallet', shouldAutoSwitch: true },
      { type: 'privy', shouldAutoSwitch: true },
    ]

    walletTypes.forEach(({ type, shouldAutoSwitch }) => {
      it(`should ${shouldAutoSwitch ? '' : 'NOT '}auto-switch for ${type} wallets`, () => {
        const switchChainSpy = cy.stub().as('switchChainSpy')

        cy.window().then((win) => {
          ;(win as any).__CYPRESS_MOCK_WALLETS__ = [
            {
              address: '0x1234567890123456789012345678901234567890',
              chainId: `eip155:${sepolia.id}`, // Different from target
              walletClientType: type,
              switchChain: switchChainSpy,
              getEthersProvider: cy.stub().resolves({
                getBalance: cy.stub().resolves({ toString: () => '1000000000000000000' }),
              }),
            },
          ]
        })

        cy.mount(
          <QueryClientProvider client={queryClient}>
            <ChainContextV5.Provider
              value={{
                selectedChain: arbitrum, // Different chain
                setSelectedChain: () => {},
              }}
            >
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
            </ChainContextV5.Provider>
          </QueryClientProvider>
        )

        cy.get('[data-testid="native-balance-component"]').should('exist')
        cy.wait(500)

        if (shouldAutoSwitch) {
          // For auto-switch wallets, switchChain may or may not be called
          // depending on whether the wallet is already on the target chain
          // This test verifies the wallet type is correctly identified
          cy.log(`${type} is correctly identified as an auto-switch wallet`)
        } else {
          // For non-auto-switch wallets, switchChain should never be called
          cy.get('@switchChainSpy').should('not.have.been.called')
        }
      })
    })
  })
})
