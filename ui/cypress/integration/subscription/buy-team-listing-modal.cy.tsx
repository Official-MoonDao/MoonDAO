import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { ZERO_ADDRESS } from 'const/config'
import BuyTeamListingModal from '@/components/subscription/BuyTeamListingModal'
import { TeamListing } from '@/components/subscription/TeamListing'

describe('<BuyTeamListingModal />', () => {
  let props: any
  let listing: TeamListing

  before(() => {
    cy.fixture('marketplace/listing').then((l) => {
      listing = l
    })
  })

  beforeEach(() => {
    props = {
      selectedChain: CYPRESS_CHAIN_V5,
      listing,
      recipient: ZERO_ADDRESS,
      setEnabled: cy.stub(),
    }

    cy.mountNextRouter('/')

    cy.mount(
      <TestnetProviders>
        <BuyTeamListingModal {...props} />
      </TestnetProviders>
    )
  })

  it('Renders the component', () => {
    cy.contains('h2', 'Buy a Listing').should('be.visible')
    cy.contains(listing.title).should('be.visible')
    cy.contains(listing.description).should('be.visible')
    cy.contains(`${listing.price} ${listing.currency}`).should('be.visible')
  })

  it('Shows markedup price for non-citizens', () => {
    const price = +listing.price * 1.1
    cy.get('#listing-price').should('have.text', `${price} ${listing.currency}`)
  })

  it('Shows regular price for citizens', () => {
    cy.mount(
      <TestnetProviders citizen={true}>
        <BuyTeamListingModal {...props} />
      </TestnetProviders>
    )

    cy.get('#listing-price').should(
      'have.text',
      `${listing.price} ${listing.currency}`
    )
  })
})
