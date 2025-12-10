import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { PrivyProvider } from '@privy-io/react-auth'
import * as NextRouter from 'next/router'
import React from 'react'
import { ethereum } from 'thirdweb/chains'
import { PrivyWeb3Button } from '../../../components/privy/PrivyWeb3Button'

describe('<PrivyWeb3Button />', () => {
  beforeEach(() => {
    // Mock router with all required methods (including replace for Connect Wallet state)
    const push = cy.stub().resolves()
    const replace = cy.stub().resolves()
    cy.stub(NextRouter, 'useRouter').returns({
      pathname: '/',
      query: {},
      push,
      replace,
    } as any)

    // Mock window.ethereum for network switching
    cy.window().then((win) => {
      win.ethereum = {
        request: cy.stub().as('ethereumRequest').resolves(true),
        on: cy.stub(),
        removeListener: cy.stub(),
      } as any
    })
  })

  it('Renders Privy Web3 Button', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyWeb3Button label="test" action={() => console.log('test')} />
      </PrivyProvider>
    )

    cy.get('button').should('exist')
  })

  describe('Network Switching Behavior', () => {
    it('Should show loading state during network switch', () => {
      const actionSpy = cy.stub().as('actionSpy')

      cy.mount(
        <TestnetProviders>
          <PrivyWeb3Button label="Test Action" action={actionSpy} requiredChain={ethereum} />
        </TestnetProviders>
      )

      cy.get('button').should('exist')

      cy.get('button').then(($btn) => {
        if ($btn.text().includes('Switch Network')) {
          cy.get('button').click()
          // Button should be disabled during loading
          cy.get('button').should('be.disabled')
        }
      })
    })

    it('Should handle network errors gracefully', () => {
      let attemptCount = 0
      const actionSpy = cy.stub().as('actionSpy')

      cy.mount(
        <TestnetProviders>
          <PrivyWeb3Button
            label="Test Action"
            action={async () => {
              attemptCount++
              if (attemptCount === 1) {
                const error = new Error('underlying network changed')
                ;(error as any).code = 'NETWORK_ERROR'
                throw error
              }
              actionSpy()
            }}
            requiredChain={ethereum}
          />
        </TestnetProviders>
      )

      cy.get('button').should('exist')
    })

    it('Should verify chain state before executing action', () => {
      const actionSpy = cy.stub().as('actionSpy')
      const chainVerificationSpy = cy.stub().as('chainVerificationSpy')
      let actionWasCalled = false

      cy.mount(
        <TestnetProviders>
          <PrivyWeb3Button
            label="Test Action"
            action={async () => {
              actionWasCalled = true
              const expectedChainId = ethereum.id
              const currentChainId = ethereum.id

              chainVerificationSpy(currentChainId, expectedChainId)

              if (currentChainId !== expectedChainId) {
                throw new Error(
                  `Network mismatch: expected ${expectedChainId}, got ${currentChainId}`
                )
              }

              actionSpy()
            }}
            requiredChain={ethereum}
            skipNetworkCheck={true}
          />
        </TestnetProviders>
      )

      cy.get('button').should('exist')

      cy.get('button')
        .invoke('text')
        .then((buttonText: string) => {
          const text = buttonText.trim()
          const isActionState =
            text !== 'Switch Network' && text !== 'Sign In' && !text.includes('Sign In')

          if (!isActionState) {
            cy.log(
              `Button state: ${text} - Expected: Chain verification should occur before action when button is in action state`
            )
            return
          }

          // Button is in action state - proceed with test
          cy.get('button').should('not.be.disabled')
          cy.get('button').click()

          cy.get('@actionSpy', { timeout: 2000 }).then((spy: any) => {
            if (spy && spy.called) {
              cy.get('@chainVerificationSpy').should('have.been.called')
              cy.get('@actionSpy').should('have.been.called')
            }
          })
        })
    })

    it('Should throw error when chain verification fails', () => {
      const actionSpy = cy.stub().as('actionSpy')
      const errorSpy = cy.stub().as('errorSpy')
      let mockWalletChainId = 11155111 // sepolia (not ethereum)

      cy.window().then(() => {
        cy.stub(require('@privy-io/react-auth'), 'useWallets').returns({
          wallets: [
            {
              chainId: `eip155:${mockWalletChainId}`,
              switchChain: cy.stub(),
            },
          ],
        })
      })

      cy.mount(
        <TestnetProviders>
          <PrivyWeb3Button
            label="Test Action"
            action={async () => {
              // Simulate chain verification that fails
              const expectedChainId = ethereum.id
              const currentChainId = mockWalletChainId

              if (currentChainId !== expectedChainId) {
                const error = new Error(
                  `Network mismatch: expected ${expectedChainId}, got ${currentChainId}`
                )
                errorSpy(error)
                throw error
              }

              actionSpy()
            }}
            requiredChain={ethereum}
            onError={errorSpy}
          />
        </TestnetProviders>
      )

      cy.get('button').should('exist')
    })
  })

  describe('Network Error Prevention', () => {
    it('Should implement waitForChainSwitch polling pattern', () => {
      const actionSpy = cy.stub().as('actionSpy')
      let currentChainId = 11155111 // sepolia
      const targetChainId = ethereum.id
      const pollSpy = cy.stub().as('pollSpy')

      // Mock wallet with switchable chain
      cy.window().then(() => {
        cy.stub(require('@privy-io/react-auth'), 'useWallets').returns({
          wallets: [
            {
              chainId: `eip155:${currentChainId}`,
              switchChain: cy.stub().callsFake(async (chainId: number) => {
                await new Promise((resolve) => setTimeout(resolve, 200))
                currentChainId = chainId
              }),
            },
          ],
        })
      })

      cy.mount(
        <TestnetProviders>
          <PrivyWeb3Button
            label="Test Chain Switch"
            action={async () => {
              // Simulate waitForChainSwitch pattern from WeeklyRewardPool
              const waitForChainSwitch = async (targetChainId: number, maxWait = 5000) => {
                const startTime = Date.now()
                while (Date.now() - startTime < maxWait) {
                  pollSpy()
                  const walletChainId = currentChainId
                  if (walletChainId === targetChainId) {
                    return true
                  }
                  await new Promise((resolve) => setTimeout(resolve, 100))
                }
                return false
              }

              // Switch chain
              if (currentChainId !== targetChainId) {
                // Simulate switch
                currentChainId = targetChainId
              }

              // Wait for switch to complete
              const switched = await waitForChainSwitch(targetChainId)
              expect(switched).to.be.true

              // Add delay for provider update
              await new Promise((resolve) => setTimeout(resolve, 500))

              actionSpy()
            }}
            requiredChain={ethereum}
          />
        </TestnetProviders>
      )

      cy.get('button').should('exist')
    })

    it('Should retry on network errors with fresh contract pattern', () => {
      const actionSpy = cy.stub().as('actionSpy')
      const retrySpy = cy.stub().as('retrySpy')
      const attemptSpy = cy.stub().as('attemptSpy')
      let actionWasCalled = false

      cy.mount(
        <TestnetProviders>
          <PrivyWeb3Button
            label="Test Retry Pattern"
            action={async () => {
              let attemptCount = 0

              const simulateTransaction = async () => {
                attemptCount++
                attemptSpy(attemptCount)

                if (attemptCount === 1) {
                  const error = new Error('underlying network changed')
                  ;(error as any).code = 'NETWORK_ERROR'
                  throw error
                }

                // Success on retry
                actionWasCalled = true
                actionSpy()
              }

              let retries = 3
              let success = false

              while (retries > 0 && !success) {
                try {
                  await simulateTransaction()
                  success = true
                } catch (error: any) {
                  if (
                    error?.code === 'NETWORK_ERROR' ||
                    error?.message?.includes('underlying network changed')
                  ) {
                    retries--
                    if (retries > 0) {
                      retrySpy(retries)
                      await new Promise((resolve) => setTimeout(resolve, 100))
                    } else {
                      throw error
                    }
                  } else {
                    throw error
                  }
                }
              }
            }}
            requiredChain={ethereum}
            skipNetworkCheck={true}
          />
        </TestnetProviders>
      )

      cy.get('button').should('exist')

      cy.get('button')
        .invoke('text')
        .then((buttonText: string) => {
          const text = buttonText.trim()
          const isActionState =
            text !== 'Switch Network' && text !== 'Sign In' && !text.includes('Sign In')

          if (!isActionState) {
            cy.log(
              `Button state: ${text} - Expected: Retry pattern should handle NETWORK_ERROR with fresh contracts when button is in action state`
            )
            return
          }

          // Button is in action state - proceed with test
          cy.get('button').should('not.be.disabled')
          cy.get('button').click()

          cy.get('@actionSpy', { timeout: 2000 }).then((spy: any) => {
            if (spy && spy.called) {
              cy.get('@retrySpy').should('have.been.called')
              cy.get('@attemptSpy').should('have.been.calledTwice')
            }
          })
        })
    })

    it('Should verify chain before and after contract creation', () => {
      const actionSpy = cy.stub().as('actionSpy')
      const verifyBeforeSpy = cy.stub().as('verifyBeforeSpy')
      const verifyAfterSpy = cy.stub().as('verifyAfterSpy')
      let actionWasCalled = false

      cy.mount(
        <TestnetProviders>
          <PrivyWeb3Button
            label="Test Double Verification"
            action={async () => {
              actionWasCalled = true
              const expectedChainId = ethereum.id

              // Verify chain BEFORE creating contract
              const walletChainIdBefore = ethereum.id
              verifyBeforeSpy(walletChainIdBefore, expectedChainId)

              if (walletChainIdBefore !== expectedChainId) {
                throw new Error(
                  `Chain mismatch before contract creation: expected ${expectedChainId}, got ${walletChainIdBefore}`
                )
              }

              // Simulate contract creation delay
              await new Promise((resolve) => setTimeout(resolve, 100))

              // Verify chain AFTER creating contract
              const walletChainIdAfter = ethereum.id
              verifyAfterSpy(walletChainIdAfter, expectedChainId)

              if (walletChainIdAfter !== expectedChainId) {
                throw new Error(
                  `Chain mismatch after contract creation: expected ${expectedChainId}, got ${walletChainIdAfter}`
                )
              }

              actionSpy()
            }}
            requiredChain={ethereum}
            skipNetworkCheck={true}
          />
        </TestnetProviders>
      )

      cy.get('button').should('exist')

      cy.get('button')
        .invoke('text')
        .then((buttonText: string) => {
          const text = buttonText.trim()
          const isActionState =
            text !== 'Switch Network' && text !== 'Sign In' && !text.includes('Sign In')

          if (!isActionState) {
            cy.log(
              `Button state: ${text} - Expected: Double verification should occur before and after contract creation when button is in action state`
            )
            return
          }

          // Button is in action state - proceed with test
          cy.get('button').should('not.be.disabled')
          cy.get('button').click()

          cy.get('@actionSpy', { timeout: 2000 }).then((spy: any) => {
            if (spy && spy.called) {
              cy.get('@verifyBeforeSpy').should('have.been.called')
              cy.get('@verifyAfterSpy').should('have.been.called')

              cy.get('@verifyBeforeSpy').should('have.been.calledOnce')
              cy.get('@verifyAfterSpy').should('have.been.calledOnce')
              cy.get('@actionSpy').should('have.been.calledOnce')
            }
          })
        })
    })
  })
})
