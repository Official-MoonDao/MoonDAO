import getMarketplaceListings from '@/lib/subscription/getMarketplaceListings'

describe('Marketplace', () => {
  beforeEach(() => {
    cy.visit('/marketplace')
  })

  it('Renders the marketplace', () => {
    cy.get('h1').should('exist').should('have.text', 'Marketplace')
  })

  it('Should upcharge for non-citizens', () => {
    cy.get('#link-frame').eq(0).should('exist')

    cy.wrap(getMarketplaceListings()).then((listings: any) => {
      const originalListingPrice = listings[0].price

      cy.get('#listing-price')
        .eq(0)
        .should((price) => {
          const parsedPrice = parseFloat(price.text())
          expect(parsedPrice.toFixed(5)).to.equal(
            (originalListingPrice * 1.1).toFixed(5)
          )
        })
    })
  })
})
