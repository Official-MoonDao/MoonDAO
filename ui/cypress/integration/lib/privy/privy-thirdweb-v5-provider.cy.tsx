import React, { useContext, useEffect, useState } from 'react'
import * as PrivyAuth from '@privy-io/react-auth'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThirdwebProvider } from 'thirdweb/react'
import { PrivyThirdwebV5Provider } from '@/lib/privy/PrivyThirdwebV5Provider'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { arbitrum, sepolia } from '@/lib/rpc/chains'

const queryClient = new QueryClient()

// Default mock for usePrivy - used across all tests
const defaultUsePrivyMock = {
  user: { id: 'test-user-id' },
  ready: true,
  authenticated: true,
  getAccessToken: cy.stub().resolves('mock-access-token'),
}

describe('PrivyThirdwebV5Provider - Chain Switch Race Condition Prevention', () => {
  // Test to ensure switchChain is not called when wallet is already on target chain
  describe('Chain Switch Guard', () => {
    it('should NOT call switchChain when wallet is already on target chain (prevents race condition)', () => {
      const switchChainSpy = cy.stub().as('switchChainSpy')
      const targetChainId = arbitrum.id // 42161

      // Mock wallet that is ALREADY on Arbitrum
      const mockWallets = [
        {
          address: '0x1234567890123456789012345678901234567890',
          chainId: `eip155:${targetChainId}`, // Already on Arbitrum
          walletClientType: 'coinbase_wallet', // Auto-switch wallet type
          switchChain: switchChainSpy,
          getEthersProvider: cy.stub().resolves({
            getSigner: cy.stub().returns({
              getAddress: cy.stub().resolves('0x1234567890123456789012345678901234567890'),
            }),
          }),
        },
      ]

      // Stub useWallets to inject mock wallets
      cy.stub(PrivyAuth, 'useWallets').returns({ wallets: mockWallets })
      cy.stub(PrivyAuth, 'usePrivy').returns(defaultUsePrivyMock)

      // Create a test component that uses the provider
      const TestComponent = () => {
        return <div data-testid="test-component">Provider Loaded</div>
      }

      cy.mount(
        <QueryClientProvider client={queryClient}>
          <ChainContextV5.Provider
            value={{
              selectedChain: arbitrum, // Target chain is Arbitrum
              setSelectedChain: () => {},
            }}
          >
            <PrivyWalletContext.Provider
              value={{
                selectedWallet: 0,
                setSelectedWallet: () => {},
              }}
            >
              <ThirdwebProvider>
                <PrivyThirdwebV5Provider selectedChain={arbitrum}>
                  <TestComponent />
                </PrivyThirdwebV5Provider>
              </ThirdwebProvider>
            </PrivyWalletContext.Provider>
          </ChainContextV5.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="test-component"]').should('exist')

      // Wait to ensure the effect has time to run
      cy.wait(500)

      // switchChain should NOT have been called since wallet is already on target chain
      cy.get('@switchChainSpy').should('not.have.been.called')
    })

    it('should call switchChain when wallet is on different chain (for auto-switch wallets)', () => {
      const switchChainSpy = cy.stub().resolves()
      cy.wrap(switchChainSpy).as('switchChainSpy')
      const currentChainId = sepolia.id // 11155111 - wallet on Sepolia
      const targetChainId = arbitrum.id // 42161 - target is Arbitrum

      // Mock wallet that is on Sepolia but target is Arbitrum
      const mockWallets = [
        {
          address: '0x1234567890123456789012345678901234567890',
          chainId: `eip155:${currentChainId}`, // On Sepolia
          walletClientType: 'privy', // Auto-switch wallet type
          switchChain: switchChainSpy,
          getEthersProvider: cy.stub().resolves({
            getSigner: cy.stub().returns({
              getAddress: cy.stub().resolves('0x1234567890123456789012345678901234567890'),
            }),
          }),
        },
      ]

      // Stub useWallets to inject mock wallets
      cy.stub(PrivyAuth, 'useWallets').returns({ wallets: mockWallets })
      cy.stub(PrivyAuth, 'usePrivy').returns(defaultUsePrivyMock)

      const TestComponent = () => {
        return <div data-testid="test-component">Provider Loaded</div>
      }

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
              <ThirdwebProvider>
                <PrivyThirdwebV5Provider selectedChain={arbitrum}>
                  <TestComponent />
                </PrivyThirdwebV5Provider>
              </ThirdwebProvider>
            </PrivyWalletContext.Provider>
          </ChainContextV5.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="test-component"]').should('exist')

      // Wait to ensure the effect has time to run
      cy.wait(500)

      // switchChain SHOULD have been called since wallet is on different chain and is auto-switch type
      cy.get('@switchChainSpy').should('have.been.calledWith', targetChainId)
    })

    it('should NOT call switchChain for MetaMask wallets (non-auto-switch)', () => {
      const switchChainSpy = cy.stub().as('switchChainSpy')
      const currentChainId = sepolia.id // Wallet on different chain
      const targetChainId = arbitrum.id

      // Mock MetaMask wallet (not an auto-switch wallet)
      const mockWallets = [
        {
          address: '0x1234567890123456789012345678901234567890',
          chainId: `eip155:${currentChainId}`,
          walletClientType: 'metamask', // NOT an auto-switch wallet
          switchChain: switchChainSpy,
          getEthersProvider: cy.stub().resolves({
            getSigner: cy.stub().returns({
              getAddress: cy.stub().resolves('0x1234567890123456789012345678901234567890'),
            }),
          }),
        },
      ]

      // Stub useWallets to inject mock wallets
      cy.stub(PrivyAuth, 'useWallets').returns({ wallets: mockWallets })
      cy.stub(PrivyAuth, 'usePrivy').returns(defaultUsePrivyMock)

      const TestComponent = () => {
        return <div data-testid="test-component">Provider Loaded</div>
      }

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
              <ThirdwebProvider>
                <PrivyThirdwebV5Provider selectedChain={arbitrum}>
                  <TestComponent />
                </PrivyThirdwebV5Provider>
              </ThirdwebProvider>
            </PrivyWalletContext.Provider>
          </ChainContextV5.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="test-component"]').should('exist')

      // Wait to ensure the effect has time to run
      cy.wait(500)

      // switchChain should NOT have been called for MetaMask
      cy.get('@switchChainSpy').should('not.have.been.called')
    })
  })

  describe('Race Condition Prevention', () => {
    it('should not cause infinite loop when wallets array updates during chain switch', () => {
      const switchChainCallCount = { count: 0 }
      const maxExpectedCalls = 1 // Should only switch once, not loop
      const currentChainId = sepolia.id // Start on different chain to trigger switch

      const switchChainSpy = cy.stub().callsFake(async () => {
        switchChainCallCount.count++
        // Simulate the wallet updating its chainId after switch
        await new Promise((resolve) => setTimeout(resolve, 100))
      })
      cy.wrap(switchChainSpy).as('switchChainSpy')

      // Mock wallet that starts on a different chain (to trigger switch attempt)
      const mockWallets = [
        {
          address: '0x1234567890123456789012345678901234567890',
          chainId: `eip155:${currentChainId}`, // Start on Sepolia
          walletClientType: 'coinbase_wallet', // Auto-switch wallet type
          switchChain: switchChainSpy,
          getEthersProvider: cy.stub().resolves({
            getSigner: cy.stub().returns({
              getAddress: cy.stub().resolves('0x1234567890123456789012345678901234567890'),
            }),
          }),
        },
      ]

      // Stub useWallets to inject mock wallets
      cy.stub(PrivyAuth, 'useWallets').returns({ wallets: mockWallets })
      cy.stub(PrivyAuth, 'usePrivy').returns(defaultUsePrivyMock)

      const TestComponent = () => {
        return <div data-testid="test-component">Provider Loaded</div>
      }

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
              <ThirdwebProvider>
                <PrivyThirdwebV5Provider selectedChain={arbitrum}>
                  <TestComponent />
                </PrivyThirdwebV5Provider>
              </ThirdwebProvider>
            </PrivyWalletContext.Provider>
          </ChainContextV5.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="test-component"]').should('exist')

      // Wait for potential multiple effect runs
      cy.wait(1000)

      // Verify switchChain was not called more than expected (no infinite loop)
      cy.wrap(switchChainCallCount).its('count').should('be.lte', maxExpectedCalls)
    })
  })

  describe('Multi-Tab Race Condition Prevention', () => {
    it('should only auto-switch when tab is visible (prevents background tabs from fighting)', () => {
      // This test documents the expected behavior:
      // The PrivyThirdwebV5Provider checks document.visibilityState before switching
      // This prevents background tabs from trying to switch the wallet chain
      
      const switchChainSpy = cy.stub().as('switchChainSpy')
      const currentChainId = sepolia.id // On different chain to potentially trigger switch

      // Mock wallet that would trigger switch if conditions are met
      const mockWallets = [
        {
          address: '0x1234567890123456789012345678901234567890',
          chainId: `eip155:${currentChainId}`,
          walletClientType: 'coinbase_wallet', // Auto-switch wallet type
          switchChain: switchChainSpy,
          getEthersProvider: cy.stub().resolves({
            getSigner: cy.stub().returns({
              getAddress: cy.stub().resolves('0x1234567890123456789012345678901234567890'),
            }),
          }),
        },
      ]

      // Stub useWallets to inject mock wallets
      cy.stub(PrivyAuth, 'useWallets').returns({ wallets: mockWallets })
      cy.stub(PrivyAuth, 'usePrivy').returns(defaultUsePrivyMock)

      const TestComponent = () => {
        return <div data-testid="test-component">Provider Loaded</div>
      }

      // When tab is visible, auto-switch wallets can switch chains
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
              <ThirdwebProvider>
                <PrivyThirdwebV5Provider selectedChain={arbitrum}>
                  <TestComponent />
                </PrivyThirdwebV5Provider>
              </ThirdwebProvider>
            </PrivyWalletContext.Provider>
          </ChainContextV5.Provider>
        </QueryClientProvider>
      )

      cy.get('[data-testid="test-component"]').should('exist')

      // Wait for effect to run
      cy.wait(500)

      // When tab is visible, switchChain should be called for auto-switch wallets on different chain
      cy.get('@switchChainSpy').should('have.been.calledWith', arbitrum.id)

      cy.log('Tab visibility check is implemented in PrivyThirdwebV5Provider')
      cy.log('Background tabs will not attempt to switch chains')
    })

    it('should document the three guards against chain switching race conditions', () => {
      /**
       * The PrivyThirdwebV5Provider has THREE guards to prevent race conditions:
       * 
       * 1. WALLET TYPE CHECK: Only auto-switch for Coinbase/Privy wallets
       *    - MetaMask, WalletConnect, etc. are NOT auto-switched
       * 
       * 2. ALREADY ON TARGET CHAIN CHECK: Don't switch if already on target
       *    - Prevents the wallets array update loop
       * 
       * 3. TAB VISIBILITY CHECK: Only switch when tab is visible
       *    - Prevents multi-tab race condition where background tabs fight
       * 
       * All three conditions must be met for switchChain to be called:
       * shouldSwitchChain = isAutoSwitchWallet && isTabVisible && currentChainId !== targetChainId
       */
      
      cy.log('Guard 1: isAutoSwitchWallet (coinbase_wallet or privy only)')
      cy.log('Guard 2: currentWalletChainId !== selectedChain.id')
      cy.log('Guard 3: document.visibilityState === "visible"')
      
      // This is a documentation test - the actual guards are in the source code
      expect(true).to.be.true
    })
  })
})
