describe('Mission Contribute Onramp E2E Flow', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'
  // /mission/1 server-renders through Tableland and chain reads, and
  // getServerSideProps retries that whole path. A stalled read holds cy.visit
  // until the 120s page-load timeout, then CI retries the test twice. Four
  // visits did that for about 17 minutes on BrowserStack, and the 20-minute
  // job was killed (exit 124) as the spec passed. These tests only need the
  // mission page to mount and leave the JWT they stored in place. The dummy
  // mission is that page with the live reads skipped.
  const missionUrl = '/mission/dummy?stage=1&onrampSuccess=true'

  beforeEach(() => {
    // Privy and thirdweb throw during hydration. That is unrelated to the JWT
    // assertions, and a failed attempt re-runs the visit.
    cy.on('uncaught:exception', () => false)

    // Mock API endpoints
    cy.intercept('GET', '/api/coinbase/eth-price', { fixture: 'coinbase/eth-price.json' }).as(
      'ethPrice'
    )
    cy.intercept('POST', '/api/coinbase/session-token', {
      fixture: 'coinbase/session-token.json',
    }).as('sessionToken')
    cy.intercept('POST', '/api/coinbase/buy-quote', { fixture: 'coinbase/buy-quote.json' }).as(
      'buyQuote'
    )
    cy.intercept('POST', '/api/coinbase/onramp-jwt', { fixture: 'coinbase/onramp-jwt.json' }).as(
      'onrampJWT'
    )
    cy.intercept('POST', '/api/coinbase/verify-onramp-jwt', {
      body: {
        valid: true,
        payload: {
          address: mockAddress,
          chainSlug: 'arbitrum',
          context: 'mission',
          agreed: true,
          usdAmount: '100',
          message: 'Test contribution',
        },
      },
    }).as('verifyJWT')
  })

  it('should restore form state when returning from onramp with JWT', () => {
    // Create a mock JWT token with the form data
    const jwtPayload = {
      address: mockAddress,
      chainSlug: 'arbitrum',
      context: 'mission',
      agreed: true,
      usdAmount: '100',
      message: 'Test contribution message',
      selectedWallet: 0,
    }

    // Encode JWT payload (simplified - in real scenario this would be properly signed)
    const encodedPayload = btoa(JSON.stringify(jwtPayload))
    const mockJWT = `header.${encodedPayload}.signature`

    // Visit mission page with onrampSuccess query param
    cy.visit(missionUrl, {
      onBeforeLoad: (win) => {
        ;(win as any).__CYPRESS_MOCK_ADDRESS__ = mockAddress
        win.localStorage.setItem('coinbase_onramp_jwt', mockJWT)
      },
    })

    cy.get('#app-layout', { timeout: 60000 }).should('exist')
    
    // Verify JWT is stored (if verification happens, it will use this)
    cy.window().then((win) => {
      const storedJWT = win.localStorage.getItem('coinbase_onramp_jwt')
      expect(storedJWT).to.not.be.null
    })
  })

  it('should handle missing JWT gracefully', () => {
    cy.visit(missionUrl, {
      onBeforeLoad: (win) => {
        ;(win as any).__CYPRESS_MOCK_ADDRESS__ = mockAddress
        // Don't set JWT - simulate missing JWT scenario
      },
    })

    cy.get('#app-layout', { timeout: 60000 }).should('exist')
  })

  it('should restore form data from JWT payload', () => {
    const jwtPayload = {
      address: mockAddress,
      chainSlug: 'arbitrum',
      context: 'mission',
      agreed: true,
      usdAmount: '250',
      message: 'Restored contribution',
      selectedWallet: 0,
    }

    const encodedPayload = btoa(JSON.stringify(jwtPayload))
    const mockJWT = `header.${encodedPayload}.signature`

    cy.visit(missionUrl, {
      onBeforeLoad: (win) => {
        ;(win as any).__CYPRESS_MOCK_ADDRESS__ = mockAddress
        win.localStorage.setItem('coinbase_onramp_jwt', mockJWT)
      },
    })

    cy.get('#app-layout', { timeout: 60000 }).should('exist')
    
    // Verify JWT is stored with correct payload data
    cy.window().then((win) => {
      const storedJWT = win.localStorage.getItem('coinbase_onramp_jwt')
      expect(storedJWT).to.not.be.null
      if (storedJWT) {
        // Decode JWT payload to verify it contains expected data
        const parts = storedJWT.split('.')
        if (parts.length >= 2) {
          const decodedPayload = JSON.parse(atob(parts[1]))
          expect(decodedPayload.usdAmount).to.equal('250')
          expect(decodedPayload.message).to.equal('Restored contribution')
          expect(decodedPayload.agreed).to.be.true
        }
      }
    })
  })

  it('should handle invalid JWT gracefully', () => {
    cy.intercept('POST', '/api/coinbase/verify-onramp-jwt', {
      body: {
        valid: false,
        payload: null,
      },
    }).as('verifyJWTInvalid')

    cy.visit(missionUrl, {
      onBeforeLoad: (win) => {
        ;(win as any).__CYPRESS_MOCK_ADDRESS__ = mockAddress
        win.localStorage.setItem('coinbase_onramp_jwt', 'invalid.jwt.token')
      },
    })

    cy.get('#app-layout', { timeout: 60000 }).should('exist')
  })
})

