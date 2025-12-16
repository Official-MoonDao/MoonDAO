import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_SLUG, CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import { MARKETPLACE_TABLE_ADDRESSES } from 'const/config'
import { Toaster } from 'react-hot-toast'
import { getContract } from 'thirdweb'
import { serverClient } from '@/lib/thirdweb/client'
import { TeamListing as TeamListingType } from '@/components/subscription/TeamListing'
import TeamMarketplaceListingModal from '@/components/subscription/TeamMarketplaceListingModal'

describe('<TeamMarketplaceListingModal />', () => {
  let listing: TeamListingType
  let props: any

  before(() => {
    cy.fixture('marketplace/listing').then((l) => {
      listing = l
    })
  })

  beforeEach(() => {
    props = {
      teamId: 0,
      setEnabled: cy.stub(),
      refreshListings: cy.stub(),
      marketplaceTableContract: getContract({
        client: serverClient,
        address: MARKETPLACE_TABLE_ADDRESSES[CYPRESS_CHAIN_SLUG],
        abi: MarketplaceTableABI as any,
        chain: CYPRESS_CHAIN_V5,
      }),
      edit: false,
      listing,
    }
    cy.mountNextRouter('/')
  })

  it('Renders the component', () => {
    cy.mount(
      <TestnetProviders>
        <TeamMarketplaceListingModal {...props} />
      </TestnetProviders>
    )
    cy.get('[data-testid="modal-title"]').should('contain', 'Create Listing')
  })
  it('Submits form with valid data', () => {
    cy.mount(
      <TestnetProviders>
        <TeamMarketplaceListingModal {...props} edit />
        <Toaster />
      </TestnetProviders>
    )

    cy.get('#listing-title-input').type('Test Listing Title')

    // Fill out the description
    cy.get('#listing-description-input').type('This is a test description.')

    // Fill out the price
    cy.get('#listing-price-input').type('100')

    // Select a currency
    cy.get('#listing-currency-input').select('ETH')

    // Check the shipping checkbox
    cy.get('#listing-shipping-input').check()

    // Check the timed checkbox and set start and end times
    cy.get('#listing-timed-input').check()
    cy.get('#listing-start-time-input').type('2024-12-01')
    cy.get('#listing-end-time-input').type('2024-12-31')

    // Submit the form
    cy.get('form').submit()
  })
})
