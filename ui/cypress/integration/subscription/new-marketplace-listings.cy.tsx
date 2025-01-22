import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_SLUG, CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  MARKETPLACE_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
  TEAM_ADDRESSES,
} from 'const/config'
import { getContract } from 'thirdweb'
import { serverClient } from '@/lib/thirdweb/client'
import NewMarketplaceListings from '@/components/subscription/NewMarketplaceListings'
import { TeamListing } from '@/components/subscription/TeamListing'

describe('<NewMarketplaceListings />', () => {
  let props: any
  let listing: TeamListing

  before(() => {
    cy.fixture('marketplace/listing').then((l) => {
      listing = l
    })
  })

  beforeEach(() => {
    props = {
      teamContract: getContract({
        client: serverClient,
        address: TEAM_ADDRESSES[CYPRESS_CHAIN_SLUG],
        abi: TeamABI as any,
        chain: CYPRESS_CHAIN_V5,
      }),
      marketplaceTableContract: getContract({
        client: serverClient,
        address: MARKETPLACE_TABLE_ADDRESSES[CYPRESS_CHAIN_SLUG],
        abi: MarketplaceTableABI as any,
        chain: CYPRESS_CHAIN_V5,
      }),
    }

    cy.intercept('GET', `/api/tableland/query?statement=*`, {
      statusCode: 200,
      body: [listing, listing],
    }).as('getNewMarketplaceListings')

    cy.mountNextRouter('/')
    cy.mount(
      <TestnetProviders>
        <NewMarketplaceListings {...props} />
      </TestnetProviders>
    )
  })

  it('Renders the component and listings', () => {
    cy.wait('@getNewMarketplaceListings')

    cy.get('.header').contains('Newest Listings')
    cy.get('#new-marketplace-listings-container')
      .children()
      .should('have.length', 2)
  })
})
