// NEXT_PUBLIC_MOCK_ONRAMP must be set in .env.local for these tests

describe('Onramp & Auto-Transaction E2E Tests', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'

  before(() => {
    // Ensure dev server is running before tests
    cy.request({
      url: '/',
      failOnStatusCode: false,
    }).then((response) => {
      if (response.status === 404) {
        throw new Error(
          'Dev server is not running. Please start it with `yarn dev` before running these tests.'
        )
      }
    })
  })

  beforeEach(() => {
    // Clear localStorage after each test
    cy.window().then((win) => {
      win.localStorage.clear()
    })

    // Mock all Coinbase API endpoints
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

    cy.intercept('POST', '/api/coinbase/verify-onramp-jwt', (req) => {
      const referer = req.headers.referer || ''
      let context = 'citizen'

      if (referer.includes('/team') || referer.includes('team')) {
        context = 'team'
      } else if (referer.includes('/mission') || referer.includes('mission')) {
        context = 'mission'
      } else if (referer.includes('/citizen') || referer.includes('citizen')) {
        context = 'citizen'
      }

      req.reply({
        statusCode: 200,
        body: {
          valid: true,
          payload: {
            address: mockAddress.toLowerCase(),
            chainSlug: 'sepolia',
            context: context,
            timestamp: Date.now(),
          },
        },
      })
    }).as('verifyJWT')
  })

  afterEach(() => {
    // Clean up localStorage after each test
    cy.window().then((win) => {
      win.localStorage.clear()
    })
  })

  const waitForAppReady = () => {
    cy.get('body', { timeout: 10000 }).should('be.visible')
    cy.window().its('__NEXT_DATA__').should('exist')
    cy.window().its('__NEXT_DATA__.page').should('exist')
  }

  describe('CreateCitizen Onramp Flow', () => {
    it('should trigger onramp modal when balance is insufficient', () => {
      const cachedFormState = {
        stage: 2,
        formData: {
          citizenData: {
            name: 'Test Citizen',
            email: 'test@example.com',
            description: 'Test description',
            location: 'Test Location',
            view: 'public',
            discord: 'test#1234',
            website: 'https://test.com',
            twitter: '@test',
            formResponseId: 'test-response-id',
          },
          citizenImage: null,
          inputImage: null,
          agreedToCondition: false,
        },
        timestamp: Date.now(),
      }

      cy.visitWithMockWallet('/citizen?onrampSuccess=true', mockAddress, {
        timeout: 60000,
        localStorage: {
          [`CreateCitizenCacheV1_${mockAddress.toLowerCase()}`]: JSON.stringify(cachedFormState),
          onrampJWT: 'mock-jwt-token-12345',
        },
      })
      waitForAppReady()

      cy.window().its('__NEXT_DATA__.page').should('exist')

      cy.window().then((win) => {
        const mockAddr = (win as any).__CYPRESS_MOCK_ADDRESS__
        expect(mockAddr).to.eq(mockAddress)
      })

      const cacheKey = `CreateCitizenCacheV1_${mockAddress.toLowerCase()}`
      cy.window().then((win) => {
        win.localStorage.setItem(cacheKey, JSON.stringify(cachedFormState))
        win.localStorage.setItem('onrampJWT', 'mock-jwt-token-12345')
      })

      cy.window().should((win) => {
        const cached = win.localStorage.getItem(cacheKey)
        expect(cached).to.not.be.null
        const parsed = JSON.parse(cached!)
        expect(parsed.stage).to.eq(2)
        expect(parsed.formData).to.exist
      })

      cy.window().should((win) => {
        const jwt = win.localStorage.getItem('onrampJWT')
        expect(jwt).to.not.be.null
        expect(jwt).to.eq('mock-jwt-token-12345')
      })

      cy.wait('@verifyJWT', { timeout: 30000 }).then((interception) => {
        expect(interception.response).to.not.be.undefined
        if (interception.response) {
          expect(interception.response.body.valid).to.be.true
          const payload = interception.response.body.payload
          expect(payload.chainSlug).to.eq('sepolia')
          expect(payload.context).to.eq('citizen')
          expect(payload.address.toLowerCase()).to.eq(mockAddress.toLowerCase())
        }
      })

      cy.window().then((win) => {
        const restoredCache = win.localStorage.getItem(cacheKey)
        expect(restoredCache).to.not.be.null
        if (restoredCache) {
          const cacheData = JSON.parse(restoredCache)
          expect(cacheData.formData.citizenData.name).to.eq('Test Citizen')
          expect(cacheData.stage).to.eq(2)
        }
      })
    })

    it('should complete full flow: form -> onramp -> return -> restore -> execute', () => {
      const cachedFormState = {
        stage: 2,
        formData: {
          citizenData: {
            name: 'Test Citizen',
            email: 'test@example.com',
            description: 'Test description',
            location: 'Test Location',
            view: 'public',
            discord: 'test#1234',
            website: 'https://test.com',
            twitter: '@test',
            formResponseId: 'test-response-id',
          },
          citizenImage: null,
          inputImage: null,
          agreedToCondition: true,
        },
        timestamp: Date.now(),
      }

      cy.visitWithMockWallet('/citizen?onrampSuccess=true', mockAddress, {
        timeout: 60000,
        localStorage: {
          [`CreateCitizenCacheV1_${mockAddress.toLowerCase()}`]: JSON.stringify(cachedFormState),
          onrampJWT: 'mock-jwt-token-12345',
        },
      })

      cy.url().should('include', 'onrampSuccess=true')
      waitForAppReady()

      cy.wait('@verifyJWT', { timeout: 20000 }).then((interception) => {
        expect(interception.response).to.not.be.undefined
        if (interception.response) {
          expect(interception.response.body.valid).to.be.true
          expect(interception.response.body.payload.context).to.eq('citizen')
          expect(interception.response.body.payload.address.toLowerCase()).to.eq(
            mockAddress.toLowerCase()
          )
        }
      })

      cy.window().then((win) => {
        const restoredCache = win.localStorage.getItem(
          `CreateCitizenCacheV1_${mockAddress.toLowerCase()}`
        )
        expect(restoredCache).to.not.be.null
        if (restoredCache) {
          const cacheData = JSON.parse(restoredCache)
          expect(cacheData.formData.citizenData.name).to.eq('Test Citizen')
          expect(cacheData.formData.agreedToCondition).to.be.true
          expect(cacheData.stage).to.eq(2)
        }
      })

      // Wait for the hook to process
      cy.window()
        .then((win) => win.localStorage.getItem('onrampJWT'))
        .should('be.null', { timeout: 15000 })

      cy.url({ timeout: 10000 }).should('not.include', 'onrampSuccess=true')
    })

    it('should restore form state and execute auto-transaction after onramp return', () => {
      const cachedFormState = {
        stage: 2,
        formData: {
          citizenData: {
            name: 'Test Citizen',
            email: 'test@example.com',
            description: 'Test description',
            location: 'Test Location',
            view: 'public',
            discord: 'test#1234',
            website: 'https://test.com',
            twitter: '@test',
            formResponseId: 'test-response-id',
          },
          citizenImage: null,
          inputImage: null,
          agreedToCondition: true,
        },
        timestamp: Date.now(),
      }

      cy.visitWithMockWallet('/citizen?onrampSuccess=true', mockAddress, {
        timeout: 60000,
        localStorage: {
          [`CreateCitizenCacheV1_${mockAddress.toLowerCase()}`]: JSON.stringify(cachedFormState),
          onrampJWT: 'mock-jwt-token-12345',
        },
      })

      cy.url().should('include', 'onrampSuccess=true')
      waitForAppReady()

      cy.wait('@verifyJWT', { timeout: 20000 }).then((interception) => {
        expect(interception.response).to.not.be.undefined
        if (interception.response) {
          expect(interception.response.body.valid).to.be.true
          expect(interception.response.body.payload.context).to.eq('citizen')
          expect(interception.response.body.payload.address.toLowerCase()).to.eq(
            mockAddress.toLowerCase()
          )
        }
      })

      cy.window().then((win) => {
        const restoredCache = win.localStorage.getItem(
          `CreateCitizenCacheV1_${mockAddress.toLowerCase()}`
        )
        expect(restoredCache).to.not.be.null
        if (restoredCache) {
          const cacheData = JSON.parse(restoredCache)
          expect(cacheData.formData.citizenData.name).to.eq('Test Citizen')
          expect(cacheData.formData.agreedToCondition).to.be.true
          expect(cacheData.stage).to.eq(2)
        }
      })

      cy.window()
        .then((win) => win.localStorage.getItem('onrampJWT'))
        .should('be.null', { timeout: 10000 })

      cy.url({ timeout: 10000 }).should('not.include', 'onrampSuccess=true')
    })
  })

  describe('CreateTeam Onramp Flow', () => {
    it('should trigger onramp modal when balance is insufficient', () => {
      const cachedFormState = {
        stage: 2,
        formData: {
          teamData: {
            name: 'Test Team',
            description: 'Test team description',
            twitter: '@testteam',
            communications: 'Discord',
            website: 'https://testteam.com',
            view: 'public',
            formResponseId: 'test-response-id',
          },
          teamImage: null,
          agreedToCondition: false,
        },
        timestamp: Date.now(),
      }

      cy.visitWithMockWallet('/team?onrampSuccess=true', mockAddress, {
        timeout: 60000,
        localStorage: {
          [`CreateTeamCacheV1_${mockAddress.toLowerCase()}`]: JSON.stringify(cachedFormState),
          onrampJWT: 'mock-jwt-token-12345',
        },
      })
      waitForAppReady()

      cy.window().its('__NEXT_DATA__.page').should('exist')

      cy.window().then((win) => {
        const mockAddr = (win as any).__CYPRESS_MOCK_ADDRESS__
        expect(mockAddr).to.eq(mockAddress)
      })

      const cacheKey = `CreateTeamCacheV1_${mockAddress.toLowerCase()}`
      cy.window().then((win) => {
        win.localStorage.setItem(cacheKey, JSON.stringify(cachedFormState))
        win.localStorage.setItem('onrampJWT', 'mock-jwt-token-12345')
      })

      cy.window().should((win) => {
        const cached = win.localStorage.getItem(cacheKey)
        expect(cached).to.not.be.null
        const parsed = JSON.parse(cached!)
        expect(parsed.stage).to.eq(2)
        expect(parsed.formData).to.exist
      })

      cy.window().should((win) => {
        const jwt = win.localStorage.getItem('onrampJWT')
        expect(jwt).to.not.be.null
        expect(jwt).to.eq('mock-jwt-token-12345')
      })

      cy.wait('@verifyJWT', { timeout: 30000 }).then((interception) => {
        expect(interception.response).to.not.be.undefined
        if (interception.response) {
          expect(interception.response.body.valid).to.be.true
          const payload = interception.response.body.payload
          expect(payload.chainSlug).to.eq('sepolia')
          expect(payload.context).to.eq('team')
          expect(payload.address.toLowerCase()).to.eq(mockAddress.toLowerCase())
        }
      })

      cy.window().then((win) => {
        const restoredCache = win.localStorage.getItem(cacheKey)
        expect(restoredCache).to.not.be.null
        if (restoredCache) {
          const cacheData = JSON.parse(restoredCache)
          expect(cacheData.formData.teamData.name).to.eq('Test Team')
          expect(cacheData.stage).to.eq(2)
        }
      })
    })

    it('should restore form state and execute auto-transaction after onramp return', () => {
      const cachedFormState = {
        stage: 2,
        formData: {
          teamData: {
            name: 'Test Team',
            description: 'Test team description',
            twitter: '@testteam',
            communications: 'Discord',
            website: 'https://testteam.com',
            view: 'public',
            formResponseId: 'test-response-id',
          },
          teamImage: null,
          agreedToCondition: true,
        },
        timestamp: Date.now(),
      }

      cy.visitWithMockWallet('/team?onrampSuccess=true', mockAddress, {
        timeout: 60000,
        localStorage: {
          [`CreateTeamCacheV1_${mockAddress.toLowerCase()}`]: JSON.stringify(cachedFormState),
          onrampJWT: 'mock-jwt-token-12345',
        },
      })

      waitForAppReady()
      cy.wait('@verifyJWT', { timeout: 20000 }).then((interception) => {
        expect(interception.response).to.not.be.undefined
        if (interception.response && interception.response.body) {
          expect(interception.response.body.valid).to.be.true
          expect(interception.response.body.payload.context).to.eq('team')
        }
      })

      cy.window().then((win) => {
        const restoredCache = win.localStorage.getItem(
          `CreateTeamCacheV1_${mockAddress.toLowerCase()}`
        )
        expect(restoredCache).to.not.be.null
        if (restoredCache) {
          const cacheData = JSON.parse(restoredCache)
          expect(cacheData.formData.teamData.name).to.eq('Test Team')
          expect(cacheData.formData.agreedToCondition).to.be.true
        }
      })

      cy.window()
        .then((win) => win.localStorage.getItem('onrampJWT'))
        .should('be.null', { timeout: 10000 })

      cy.url({ timeout: 10000 }).should('not.include', 'onrampSuccess=true')
    })
  })

  describe('Mission Contribution Onramp Flow', () => {
    it('should show CBOnramp component when ETH deficit exists', () => {
      cy.visitWithMockWallet('/mission/dummy?onrampSuccess=true', mockAddress, {
        timeout: 60000,
        failOnStatusCode: false,
        localStorage: {
          onrampJWT: 'mock-jwt-token-12345',
        },
      })

      waitForAppReady()

      cy.wait('@verifyJWT', { timeout: 20000 }).then((interception) => {
        expect(interception.response).to.not.be.undefined
        if (interception.response && interception.response.body) {
          expect(interception.response.body.valid).to.be.true
          expect(interception.response.body.payload.context).to.eq('mission')
        }
      })

      cy.window().should((win) => {
        const jwt = win.localStorage.getItem('onrampJWT')
        expect(jwt).to.not.be.null
        expect(jwt).to.eq('mock-jwt-token-12345')
      })
    })

    it('should restore form state and execute auto-transaction after onramp return', () => {
      cy.intercept('POST', '/api/mission/contribution-notification', {
        statusCode: 200,
        body: { message: 'Success' },
      }).as('contributionNotification')

      cy.visitWithMockWallet('/mission/dummy?onrampSuccess=true', mockAddress, {
        timeout: 60000,
        failOnStatusCode: false,
        localStorage: {
          onrampJWT: 'mock-jwt-token-12345',
        },
      })

      cy.url().should('include', 'onrampSuccess=true')
      waitForAppReady()

      cy.wait('@verifyJWT', { timeout: 20000 }).then((interception) => {
        expect(interception.response).to.not.be.undefined
        if (interception.response && interception.response.body) {
          expect(interception.response.body.valid).to.be.true
          expect(interception.response.body.payload.context).to.eq('mission')
        }
      })
    })
  })

  describe('Edge Cases', () => {
    it('should not proceed if agreedToCondition is false', () => {
      const cachedFormState = {
        stage: 2,
        formData: {
          citizenData: {
            name: 'Test Citizen',
            email: 'test@example.com',
            description: 'Test',
            location: 'Test',
            view: 'public',
            discord: '',
            website: '',
            twitter: '',
            formResponseId: '',
          },
          citizenImage: null,
          inputImage: null,
          agreedToCondition: false,
        },
        timestamp: Date.now(),
      }

      cy.visitWithMockWallet('/citizen?onrampSuccess=true', mockAddress, {
        timeout: 60000,
        localStorage: {
          [`CreateCitizenCacheV1_${mockAddress.toLowerCase()}`]: JSON.stringify(cachedFormState),
          onrampJWT: 'mock-jwt-token-12345',
        },
      })

      waitForAppReady()

      cy.wait('@verifyJWT', { timeout: 20000 }).then((interception) => {
        expect(interception.response).to.not.be.undefined
        if (interception.response) {
          expect(interception.response.body.valid).to.be.true
        }
      })

      cy.window()
        .then((win) => win.localStorage.getItem('onrampJWT'))
        .should('be.null', { timeout: 10000 })

      cy.url({ timeout: 10000 }).should('not.include', 'onrampSuccess=true')

      cy.window().then((win) => {
        const restoredCache = win.localStorage.getItem(
          `CreateCitizenCacheV1_${mockAddress.toLowerCase()}`
        )
        expect(restoredCache).to.not.be.null
        if (restoredCache) {
          const cacheData = JSON.parse(restoredCache)
          expect(cacheData.formData.agreedToCondition).to.be.false
          expect(cacheData.formData.citizenData.name).to.eq('Test Citizen')
        }
      })
      cy.url().should('include', '/citizen')
    })
  })
})
