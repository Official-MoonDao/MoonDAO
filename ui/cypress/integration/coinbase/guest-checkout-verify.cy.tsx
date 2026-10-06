import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { CBHeadlessOnramp } from '@/components/coinbase/CBHeadlessOnramp'

describe('Coinbase guest checkout verification', () => {
  const address = '0x1234567890123456789012345678901234567890'

  beforeEach(() => {
    cy.mountNextRouter('/')
    cy.intercept('GET', '/api/coinbase/eth-price', { price: 3000 }).as('ethPrice')
    cy.intercept('POST', '/api/coinbase/buy-quote', {
      quote: {
        payment_subtotal: { value: '9' },
        payment_total: { value: '10' },
      },
    }).as('buyQuote')
  })

  it('keeps phone and email fields in the card so iOS can type into them', () => {
    cy.mount(
      <TestnetProviders>
        <CBHeadlessOnramp address={address} selectedChain={CYPRESS_CHAIN_V5} ethAmount={0.01} />
      </TestnetProviders>
    )

    cy.contains('Add phone').should('not.exist')
    cy.contains('Add email').should('not.exist')
    cy.contains('Verify your details').should('exist')

    cy.get('[data-testid="onramp-phone-input"]')
      .should('be.visible')
      .type('5551234567')
      .should('have.value', '5551234567')

    cy.get('[data-testid="onramp-email-input"]')
      .should('be.visible')
      .type('guest@example.com')
      .should('have.value', 'guest@example.com')

    cy.get('[data-testid="onramp-phone-input"]').focus().type('{selectall}5550001111')
    cy.get('[data-testid="onramp-phone-input"]').should('have.value', '5550001111')

    cy.contains('button', 'Text me a code').click()
    cy.contains('Sign in first, then verify your details here.').should('be.visible')
    cy.get('[data-testid="onramp-phone-input"]').should('be.visible')
  })
})
