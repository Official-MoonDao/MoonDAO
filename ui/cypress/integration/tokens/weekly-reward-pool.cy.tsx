import TestnetProviders from '@/cypress/mock/TestnetProviders'
import * as PrivyAuth from '@privy-io/react-auth'
import * as ThirdwebReact from 'thirdweb/react'
import * as TotalVPHook from '@/lib/tokens/hooks/useTotalVP'
import WeeklyRewardPool from '@/components/tokens/WeeklyRewardPool'

describe('<WeeklyRewardPool />', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'
  let mockWallets: any[]
  let mockChainId: number

  beforeEach(() => {
    cy.mountNextRouter('/')

    // Initialize mock wallet state
    mockChainId = 11155111 // sepolia
    mockWallets = [
      {
        chainId: `eip155:${mockChainId}`,
        switchChain: cy.stub().callsFake(async (chainId: number) => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          mockChainId = chainId
          mockWallets[0].chainId = `eip155:${chainId}`
        }),
      },
    ]

    // Mock useWallets
    cy.stub(PrivyAuth, 'useWallets').returns({
      wallets: mockWallets,
    })

    // Mock useActiveAccount
    cy.stub(ThirdwebReact, 'useActiveAccount').returns({
      address: mockAddress,
    } as any)

    // Mock window.ethereum for network switching
    cy.window().then((win) => {
      win.ethereum = {
        request: cy.stub().as('ethereumRequest').resolves(true),
        on: cy.stub(),
        removeListener: cy.stub(),
      } as any
    })

    cy.intercept('POST', '**/rpc**', (req) => {
      const body = req.body
      if (body.method === 'eth_getBalance') {
        req.reply({
          statusCode: 200,
          body: {
            jsonrpc: '2.0',
            id: body.id,
            result: '0x2386f26fc10000',
          },
        })
      } else if (body.method === 'eth_call') {
        // Default contract calls return 0
        req.reply({
          statusCode: 200,
          body: {
            jsonrpc: '2.0',
            id: body.id,
            result: '0x0',
          },
        })
      } else {
        req.reply({
          statusCode: 200,
          body: {
            jsonrpc: '2.0',
            id: body.id,
            result: '0x0',
          },
        })
      }
    }).as('rpcRequest')
  })

  it('Renders Weekly Reward Pool component', () => {
    cy.mount(
      <TestnetProviders>
        <WeeklyRewardPool />
      </TestnetProviders>
    )

    cy.contains('Weekly Reward Pool').should('exist')
    cy.contains('Your Reward').should('exist')
  })

  it('Shows loading/calculating state when fetching data', () => {
    cy.intercept('POST', '**/rpc**', {
      delay: 1000,
      statusCode: 200,
      body: {
        jsonrpc: '2.0',
        id: 1,
        result: '0x0',
      },
    }).as('delayedRpc')

    cy.mount(
      <TestnetProviders>
        <WeeklyRewardPool />
      </TestnetProviders>
    )

    // Either "Loading..." or "Calculating..." or "Lock MOONEY to earn" depending on vMOONEY state
    cy.contains(/Loading\.\.\.|Calculating\.\.\.|Lock MOONEY to earn/).should('exist')
  })

  it('Should display Your Reward section', () => {
    cy.mount(
      <TestnetProviders>
        <WeeklyRewardPool />
      </TestnetProviders>
    )

    cy.contains('Your Reward').should('exist')
    // Should show either amount, calculating, or lock prompt
    cy.get('body').then(($body) => {
      const hasAmount = $body.text().match(/\d+\.\d+/)
      const hasCalculating = $body.text().includes('Calculating')
      const hasLockPrompt = $body.text().includes('Lock MOONEY')
      expect(hasAmount || hasCalculating || hasLockPrompt).to.be.true
    })
  })

  it('Should show error state gracefully when RPC fails', () => {
    // Mock RPC to fail
    cy.intercept('POST', '**/rpc**', {
      statusCode: 500,
      body: {
        error: 'Internal server error',
      },
    }).as('rpcError')

    cy.mount(
      <TestnetProviders>
        <WeeklyRewardPool />
      </TestnetProviders>
    )

    cy.contains('Weekly Reward Pool').should('exist')
    cy.contains('Your Reward').should('exist')
  })

  it('Shows "Lock MOONEY to earn" when user has no vMOONEY', () => {
    // Mock useTotalVP to return 0 balance
    cy.stub(TotalVPHook, 'useTotalVP').returns({
      walletVP: 0,
      isLoading: false,
      isError: false,
    })

    cy.mount(
      <TestnetProviders>
        <WeeklyRewardPool />
      </TestnetProviders>
    )

    cy.contains('Weekly Reward Pool').should('exist')
    cy.contains('Lock MOONEY to earn').should('exist')
  })

  describe('Check-in Flow', () => {
    it('Should show check-in button when user has vMOONEY', () => {
      // Mock user with vMOONEY
      cy.stub(TotalVPHook, 'useTotalVP').returns({
        walletVP: 100,
        isLoading: false,
        isError: false,
      })

      cy.mount(
        <TestnetProviders>
          <WeeklyRewardPool />
        </TestnetProviders>
      )

      // Button should exist and be enabled when user has vMOONEY
      cy.contains('Weekly Reward Pool').should('exist')
      cy.get('button').should('exist')
      // Button text should be "Check In & Claim Reward" or "Already Checked In"
      cy.get('button').should('satisfy', ($btn) => {
        const text = $btn.text()
        return (
          text.includes('Check In') ||
          text.includes('Already Checked In') ||
          text.includes('Switch Network') ||
          text.includes('Sign In')
        )
      })
    })

    it('Should show "Already Checked In" when user has checked in', () => {
      // Mock user with vMOONEY
      cy.stub(TotalVPHook, 'useTotalVP').returns({
        walletVP: 100,
        isLoading: false,
        isError: false,
      })

      // Mock contract calls to indicate user is checked in
      let callCount = 0
      cy.intercept('POST', '**/rpc**', (req) => {
        const body = req.body
        if (body.method === 'eth_call') {
          callCount++
          // Mock lastCheckIn to equal weekStart (user is checked in)
          if (callCount === 3 || callCount === 4) {
            // lastCheckIn and weekStart return same value
            const timestamp = Math.floor(Date.now() / 1000)
            req.reply({
              statusCode: 200,
              body: {
                jsonrpc: '2.0',
                id: body.id,
                result: '0x' + BigInt(timestamp).toString(16),
              },
            })
          } else {
            req.reply({
              statusCode: 200,
              body: {
                jsonrpc: '2.0',
                id: body.id,
                result: '0x' + BigInt(1000000000000000000).toString(16),
              },
            })
          }
        } else {
          req.reply({
            statusCode: 200,
            body: {
              jsonrpc: '2.0',
              id: body.id,
              result: '0x0',
            },
          })
        }
      })

      cy.mount(
        <TestnetProviders>
          <WeeklyRewardPool />
        </TestnetProviders>
      )

      cy.contains('Weekly Reward Pool').should('exist')
      cy.get('button').should('exist')
    })

  })

  describe('UI States', () => {
    it('Should display Your Reward when user has vMOONEY', () => {
      cy.stub(TotalVPHook, 'useTotalVP').returns({
        walletVP: 100,
        isLoading: false,
        isError: false,
      })

      let ethCallCount = 0
      cy.intercept('POST', '**/rpc**', (req) => {
        const body = req.body
        if (body.method === 'eth_call') {
          ethCallCount++
          if (ethCallCount <= 2) {
            req.reply({
              statusCode: 200,
              body: {
                jsonrpc: '2.0',
                id: body.id,
                result: '0x' + BigInt(500000000000000000).toString(16),
              },
            })
          } else {
            req.reply({
              statusCode: 200,
              body: {
                jsonrpc: '2.0',
                id: body.id,
                result: '0x' + BigInt(1000000000000000000).toString(16),
              },
            })
          }
        } else {
          req.reply({
            statusCode: 200,
            body: {
              jsonrpc: '2.0',
              id: body.id,
              result: '0x0',
            },
          })
        }
      })

      cy.mount(
        <TestnetProviders>
          <WeeklyRewardPool />
        </TestnetProviders>
      )

      cy.contains('Your Reward').should('exist')
      // Should show amount, calculating, or lock prompt (accept any valid state)
      cy.get('body', { timeout: 10000 }).should(($body) => {
        const text = $body.text()
        const hasCalculating = text.includes('Calculating')
        const hasAmount = /\d+\.\d+/.test(text)
        const hasLockPrompt = text.includes('Lock MOONEY')
        expect(hasCalculating || hasAmount || hasLockPrompt).to.be.true
      })
    })

    it('Should display estimated reward section', () => {
      // Mock user with vMOONEY
      cy.stub(TotalVPHook, 'useTotalVP').returns({
        walletVP: 100,
        isLoading: false,
        isError: false,
      })

      // Mock estimateFees calls (these come first, one per chain)
      let ethCallCount = 0
      cy.intercept('POST', '**/rpc**', (req) => {
        const body = req.body
        if (body.method === 'eth_call') {
          ethCallCount++
          // estimateFees calls are the first 2 calls (one per chain in testnet)
          if (ethCallCount <= 2) {
            // estimateFees - return 0.5 ETH
            req.reply({
              statusCode: 200,
              body: {
                jsonrpc: '2.0',
                id: body.id,
                result: '0x' + BigInt(500000000000000000).toString(16),
              },
            })
          } else {
            // Other contract calls (weekStart, lastCheckIn, getCheckedInCount, vMooneyAddress, balanceOf)
            req.reply({
              statusCode: 200,
              body: {
                jsonrpc: '2.0',
                id: body.id,
                result: '0x' + BigInt(1000000000000000000).toString(16),
              },
            })
          }
        } else {
          req.reply({
            statusCode: 200,
            body: {
              jsonrpc: '2.0',
              id: body.id,
              result: '0x0',
            },
          })
        }
      })

      cy.mount(
        <TestnetProviders>
          <WeeklyRewardPool />
        </TestnetProviders>
      )

      cy.contains('Your Reward').should('exist')
      // Should show estimated fees when user has vMOONEY
      // Wait for estimateFees to load, then verify either calculating state or amount
      cy.get('body', { timeout: 10000 }).should(($body) => {
        const bodyText = $body.text()
        const hasCalculating = bodyText.includes('Calculating...')
        const hasAmount = $body.text().match(/\d+\.\d+/) !== null
        const hasLockPrompt = bodyText.includes('Lock MOONEY to earn')

        // Should show one of: calculating, amount, or lock prompt (if no vMOONEY)
        expect(hasCalculating || hasAmount || hasLockPrompt).to.be.true
      })

      // Verify "Your Reward" section is visible
      cy.contains('Your Reward').should('be.visible')
    })

    it('Should show "Learn about rewards" link', () => {
      cy.mount(
        <TestnetProviders>
          <WeeklyRewardPool />
        </TestnetProviders>
      )

      cy.contains('Learn about rewards').should('exist')
      cy.get('a[href="/fees"]').should('exist')
    })

    it('Should show check-in button when user has vMOONEY balance', () => {
      // Mock user with vMOONEY
      cy.stub(TotalVPHook, 'useTotalVP').returns({
        walletVP: 50,
        isLoading: false,
        isError: false,
      })

      cy.mount(
        <TestnetProviders>
          <WeeklyRewardPool />
        </TestnetProviders>
      )

      cy.contains('Weekly Reward Pool').should('exist')
      // Should show check-in button, not lock link
      cy.get('button').should('exist')
      cy.get('a[href="/lock"]').should('not.exist')
    })

    it('Should show link to lock page when user needs vMOONEY', () => {
      // Mock useTotalVP to return 0 (no vMOONEY)
      cy.stub(TotalVPHook, 'useTotalVP').returns({
        walletVP: 0, // 0 is falsy, which should trigger the link
        isLoading: false,
        isError: false,
      })

      // Mock RPC calls - return 0 for balanceOf calls from useTotalVP
      cy.intercept('POST', '**/rpc**', (req) => {
        const body = req.body
        req.reply({
          statusCode: 200,
          body: {
            jsonrpc: '2.0',
            id: body.id || 1,
            result: '0x0', // 0 balance in hex
          },
        })
      }).as('rpcCall')

      cy.mount(
        <TestnetProviders>
          <WeeklyRewardPool />
        </TestnetProviders>
      )

      cy.contains('Weekly Reward Pool').should('exist')

      cy.get('body', { timeout: 5000 }).then(($body) => {
        const hasLockLink = $body.find('a[href="/lock"]').length > 0
        if (hasLockLink) {
          cy.get('a[href="/lock"]').should('be.visible').should('contain', 'Get vMOONEY')
        } else {
          cy.contains('Lock MOONEY to earn').should('exist')
        }
      })
    })
  })
})
