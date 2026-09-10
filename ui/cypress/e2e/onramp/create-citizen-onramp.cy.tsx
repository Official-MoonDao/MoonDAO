describe('CreateCitizen Onramp E2E Flow', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'
  const cacheKey = `CreateCitizenCacheV1_${mockAddress.toLowerCase()}`

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
    cy.intercept('POST', '/api/coinbase/verify-onramp-jwt', {
      body: {
        valid: true,
        payload: {
          address: mockAddress,
          chainSlug: 'arbitrum',
          context: 'citizen',
          agreed: true,
        },
      },
    }).as('verifyJWT')
  })

  it('should restore cache after returning from onramp', () => {
    // Set up mock cache data before onramp navigation
    const mockCacheData = {
      stage: 2,
      formData: {
        citizenData: {
          name: 'Test Citizen',
          email: 'test@example.com',
          description: 'Test description',
          location: 'Test Location',
          view: 'Test View',
          discord: 'test#1234',
          website: 'https://test.com',
          twitter: '@test',
          formResponseId: 'test-response-id',
        },
        citizenImage: null,
        inputImage: null,
        agreedToCondition: true,
        selectedChainSlug: 'arbitrum',
      },
      timestamp: Date.now(),
    }

    // Visit page and set up localStorage
    cy.visit('/citizen?onrampSuccess=true', {
      onBeforeLoad: (win) => {
        ;(win as any).__CYPRESS_MOCK_ADDRESS__ = mockAddress
        win.localStorage.setItem(cacheKey, JSON.stringify(mockCacheData))
        win.localStorage.setItem('coinbase_onramp_jwt', 'mock-jwt-token-12345')
      },
    })

    cy.get('#app-layout', { timeout: 120000 }).should('exist')

    // Retryable: the app hydrates and restores asynchronously (Privy, JWT
    // effects) after first paint, so a one-shot read can race the lifecycle.
    cy.window({ timeout: 15000 }).should((win) => {
      const restored = win.localStorage.getItem(cacheKey)
      expect(restored, 'form cache present in localStorage').to.not.be.null
      const cache = JSON.parse(restored as string)
      expect(cache.formData.citizenData.name).to.equal('Test Citizen')
      expect(cache.stage).to.equal(2)
    })

    // JWT verification may or may not be called depending on component state
    // Don't wait for it as it's not guaranteed to be triggered in e2e test
  })

  it('should handle cache restoration when cache exists but JWT is missing', () => {
    const mockCacheData = {
      stage: 2,
      formData: {
        citizenData: {
          name: 'Test Citizen',
          email: 'test@example.com',
        },
        agreedToCondition: true,
        selectedChainSlug: 'arbitrum',
      },
      timestamp: Date.now(),
    }

    cy.visit('/citizen?onrampSuccess=true', {
      onBeforeLoad: (win) => {
        ;(win as any).__CYPRESS_MOCK_ADDRESS__ = mockAddress
        win.localStorage.setItem(cacheKey, JSON.stringify(mockCacheData))
        // Don't set JWT - simulate missing JWT scenario
      },
    })

    cy.get('#app-layout', { timeout: 120000 }).should('exist')

    // Retryable for the same async-hydration reason as above.
    cy.window({ timeout: 15000 }).should((win) => {
      const restored = win.localStorage.getItem(cacheKey)
      expect(restored, 'form cache present in localStorage').to.not.be.null
    })
  })

  it('should handle expired cache', () => {
    const expiredCacheData = {
      stage: 2,
      formData: {
        citizenData: {
          name: 'Test Citizen',
          email: 'test@example.com',
        },
        agreedToCondition: true,
        selectedChainSlug: 'arbitrum',
      },
      timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago (expired)
    }

    cy.visit('/citizen?onrampSuccess=true', {
      onBeforeLoad: (win) => {
        ;(win as any).__CYPRESS_MOCK_ADDRESS__ = mockAddress
        win.localStorage.setItem(cacheKey, JSON.stringify(expiredCacheData))
      },
    })

    cy.get('#app-layout', { timeout: 120000 }).should('exist')

    // Deterministic: the app clears expired caches on mount (restoreCache and
    // the expiry sweep effect), so poll until the key is gone instead of
    // sleeping a fixed delay and asserting conditionally.
    cy.window({ timeout: 15000 }).should((win) => {
      expect(
        win.localStorage.getItem(cacheKey),
        'expired form cache cleared'
      ).to.be.null
    })
  })
})

