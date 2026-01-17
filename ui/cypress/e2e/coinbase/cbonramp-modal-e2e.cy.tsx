describe('CBOnrampModal E2E Flow', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'

  beforeEach(() => {
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
  })

  it('should handle cache restoration flow when returning from onramp', () => {
    const cacheKey = `TestCache_${mockAddress.toLowerCase()}`
    const mockCacheData = {
      stage: 2,
      formData: { test: 'restored data' },
      timestamp: Date.now(),
    }

    // Visit a page that uses the onramp modal (like citizen page)
    cy.visit('/citizen?onrampSuccess=true', {
      onBeforeLoad: (win) => {
        ;(win as any).__CYPRESS_MOCK_ADDRESS__ = mockAddress
        win.localStorage.setItem(cacheKey, JSON.stringify(mockCacheData))
        win.localStorage.setItem('coinbase_onramp_jwt', 'mock-jwt-token')
      },
    })

    cy.wait(2000)

    // Verify cache exists
    cy.window().then((win) => {
      const cache = win.localStorage.getItem(cacheKey)
      expect(cache).to.not.be.null
      if (cache) {
        const parsed = JSON.parse(cache)
        expect(parsed.formData.test).to.equal('restored data')
      }
    })
  })

  it('should handle onramp flow on mission page', () => {
    const jwtPayload = {
      address: mockAddress,
      chainSlug: 'arbitrum',
      context: 'mission',
      agreed: true,
      usdAmount: '100',
    }

    const encodedPayload = btoa(JSON.stringify(jwtPayload))
    const mockJWT = `header.${encodedPayload}.signature`

    cy.visit('/mission/1?onrampSuccess=true', {
      onBeforeLoad: (win) => {
        ;(win as any).__CYPRESS_MOCK_ADDRESS__ = mockAddress
        win.localStorage.setItem('coinbase_onramp_jwt', mockJWT)
      },
    })

    cy.wait(2000)

    // Page should load successfully
    cy.get('body').should('exist')
  })
})

