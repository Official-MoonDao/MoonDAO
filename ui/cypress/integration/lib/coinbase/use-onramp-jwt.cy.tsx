import TestnetProviders from '@/cypress/mock/TestnetProviders'
import useOnrampJWT from '@/lib/coinbase/useOnrampJWT'

const JWTWrapper = () => {
  const {
    generateJWT,
    verifyJWT,
    clearJWT,
    getStoredJWT,
    storedJWT,
    isGenerating,
    isVerifying,
    error,
  } = useOnrampJWT()

  return (
    <div>
      <div data-testid="is-generating">{isGenerating ? 'true' : 'false'}</div>
      <div data-testid="is-verifying">{isVerifying ? 'true' : 'false'}</div>
      <div data-testid="error">{error || ''}</div>
      <button
        data-testid="generate-jwt-btn"
        onClick={() => {
          generateJWT({
            address: '0x1234567890123456789012345678901234567890',
            chainSlug: 'arbitrum',
            context: 'test',
          })
        }}
      >
        Generate JWT
      </button>
      <button
        data-testid="verify-jwt-btn"
        onClick={() => {
          const token = getStoredJWT()
          if (token) {
            verifyJWT(token, '0x1234567890123456789012345678901234567890', undefined, 'test')
          }
        }}
      >
        Verify JWT
      </button>
      <button data-testid="clear-jwt-btn" onClick={clearJWT}>
        Clear JWT
      </button>
      <div data-testid="stored-jwt">{storedJWT || ''}</div>
    </div>
  )
}

describe('useOnrampJWT', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
    // Clear localStorage before each test
    cy.window().then((win) => {
      win.localStorage.clear()
    })
  })

  describe('JWT Generation', () => {
    it('generates JWT and stores in localStorage', () => {
      cy.intercept('POST', '/api/coinbase/onramp-jwt', {
        statusCode: 200,
        body: { jwt: 'mock-jwt-token-12345' },
      }).as('generateJWT')

      cy.mount(
        <TestnetProviders>
          <JWTWrapper />
        </TestnetProviders>
      )

      cy.get('[data-testid="generate-jwt-btn"]').click()
      cy.wait('@generateJWT')
      cy.get('[data-testid="stored-jwt"]').should('contain', 'mock-jwt-token-12345')
    })

    it('handles JWT generation error', () => {
      cy.intercept('POST', '/api/coinbase/onramp-jwt', {
        statusCode: 500,
        body: { error: 'Failed to generate JWT' },
      }).as('generateJWTError')

      cy.mount(
        <TestnetProviders>
          <JWTWrapper />
        </TestnetProviders>
      )

      cy.get('[data-testid="generate-jwt-btn"]').click()
      cy.wait('@generateJWTError')
      cy.get('[data-testid="error"]').should('contain', 'Failed to generate JWT')
    })
  })

  describe('JWT Verification', () => {
    beforeEach(() => {
      // Set up a mock JWT in localStorage
      cy.window().then((win) => {
        win.localStorage.setItem('onrampJWT', 'mock-jwt-token-12345')
      })
    })

    it('verifies JWT successfully with valid token', () => {
      cy.intercept('POST', '/api/coinbase/verify-onramp-jwt', {
        statusCode: 200,
        body: {
          valid: true,
          payload: {
            address: '0x1234567890123456789012345678901234567890',
            chainSlug: 'arbitrum',
            context: 'test',
            timestamp: Math.floor(Date.now() / 1000),
          },
        },
      }).as('verifyJWT')

      cy.mount(
        <TestnetProviders>
          <JWTWrapper />
        </TestnetProviders>
      )

      cy.get('[data-testid="verify-jwt-btn"]').click()
      cy.wait('@verifyJWT')
      cy.get('[data-testid="error"]').should('be.empty')
    })

    it('fails verification with invalid token', () => {
      cy.intercept('POST', '/api/coinbase/verify-onramp-jwt', {
        statusCode: 401,
        body: {
          valid: false,
          error: 'Invalid or expired token',
        },
      }).as('verifyJWTInvalid')

      cy.mount(
        <TestnetProviders>
          <JWTWrapper />
        </TestnetProviders>
      )

      cy.get('[data-testid="verify-jwt-btn"]').click()
      cy.wait('@verifyJWTInvalid')
      cy.get('[data-testid="error"]').should('contain', 'Invalid or expired')
    })

    it('fails verification with address mismatch', () => {
      cy.intercept('POST', '/api/coinbase/verify-onramp-jwt', {
        statusCode: 200,
        body: {
          valid: true,
          payload: {
            address: '0xDIFFERENTADDRESS1234567890123456789012345678',
            chainSlug: 'arbitrum',
            context: 'test',
            timestamp: Math.floor(Date.now() / 1000),
          },
        },
      }).as('verifyJWTAddressMismatch')

      cy.mount(
        <TestnetProviders>
          <JWTWrapper />
        </TestnetProviders>
      )

      cy.get('[data-testid="verify-jwt-btn"]').click()
      cy.wait('@verifyJWTAddressMismatch')
      cy.get('[data-testid="error"]').should('contain', 'Wallet address mismatch')
    })

    it('fails verification with context mismatch', () => {
      cy.intercept('POST', '/api/coinbase/verify-onramp-jwt', {
        statusCode: 200,
        body: {
          valid: true,
          payload: {
            address: '0x1234567890123456789012345678901234567890',
            chainSlug: 'arbitrum',
            context: 'different-context',
            timestamp: Math.floor(Date.now() / 1000),
          },
        },
      }).as('verifyJWTContextMismatch')

      cy.mount(
        <TestnetProviders>
          <JWTWrapper />
        </TestnetProviders>
      )

      cy.get('[data-testid="verify-jwt-btn"]').click()
      cy.wait('@verifyJWTContextMismatch')
      cy.get('[data-testid="error"]').should('contain', 'Context mismatch')
    })
  })

  describe('JWT Storage', () => {
    it('clears JWT from localStorage', () => {
      cy.window().then((win) => {
        win.localStorage.setItem('onrampJWT', 'mock-jwt-token-12345')
      })

      cy.mount(
        <TestnetProviders>
          <JWTWrapper />
        </TestnetProviders>
      )

      cy.get('[data-testid="stored-jwt"]').should('contain', 'mock-jwt-token-12345')
      cy.get('[data-testid="clear-jwt-btn"]').click()
      cy.get('[data-testid="stored-jwt"]').should('be.empty')
    })

    it('retrieves stored JWT from localStorage', () => {
      cy.window().then((win) => {
        win.localStorage.setItem('onrampJWT', 'mock-jwt-token-12345')
      })

      cy.mount(
        <TestnetProviders>
          <JWTWrapper />
        </TestnetProviders>
      )

      cy.get('[data-testid="stored-jwt"]').should('contain', 'mock-jwt-token-12345')
    })
  })
})

