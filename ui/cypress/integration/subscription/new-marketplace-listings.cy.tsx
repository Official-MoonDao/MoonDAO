import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_SLUG, CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  MARKETPLACE_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import { getContract } from 'thirdweb'
import { serverClient } from '@/lib/thirdweb/client'
import NewMarketplaceListings from '@/components/subscription/NewMarketplaceListings'
import { TeamListing } from '@/components/subscription/TeamListing'

describe('<NewMarketplaceListings />', () => {
  let props: any
  let listing: TeamListing
  const mockTableName = 'marketplace_table_12345'
  const futureTimestamp = Math.floor(Date.now() / 1000) + 86400 // 24 hours in the future

  before(() => {
    cy.fixture('marketplace/listing').then((l) => {
      listing = l
    })
  })

  beforeEach(() => {
    props = {
      selectedChain: CYPRESS_CHAIN_V5,
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
      initialListings: [],
    }

    cy.mountNextRouter('/')
  })

  it('Renders the component with initial listings', () => {
    cy.fixture('marketplace/listing').then((listing) => {
      props.initialListings = [listing, listing]
      
      cy.mount(
        <TestnetProviders>
          <NewMarketplaceListings {...props} />
        </TestnetProviders>
      )

      cy.contains('h3', 'Newest Listings').should('be.visible')
      
      cy.get('#new-marketplace-listings-container')
        .children()
        .should('have.length', 2)
        .should('be.visible')
    })
  })

  it('Displays empty state when no listings', () => {
    cy.mount(
      <TestnetProviders>
        <NewMarketplaceListings {...props} />
      </TestnetProviders>
    )

    cy.contains('No active listings yet').should('be.visible')
    cy.contains('Check back soon for new marketplace items').should('be.visible')
  })

  it('Displays the description text', () => {
    cy.mount(
      <TestnetProviders>
        <NewMarketplaceListings {...props} />
      </TestnetProviders>
    )

    cy.contains('Discover and trade exclusive items from space missions').should(
      'be.visible'
    )
  })

  it('Has a View All Items button', () => {
    cy.mount(
      <TestnetProviders>
        <NewMarketplaceListings {...props} />
      </TestnetProviders>
    )

    cy.contains('button', 'View All Items').should('be.visible')
  })
})
