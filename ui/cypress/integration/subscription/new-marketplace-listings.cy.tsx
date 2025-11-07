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
import * as thirdweb from 'thirdweb'

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
    // Mock readContract for getTableName and expiresAt
    cy.stub(thirdweb, 'readContract').callsFake(async (options: any) => {
      if (options.method === 'getTableName') {
        return mockTableName
      }
      if (options.method === 'expiresAt') {
        return BigInt(futureTimestamp)
      }
      return null
    })

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

    cy.contains('h3', 'Newest Listings').should('be.visible')
    
    // Wait for listings to be processed and rendered
    cy.get('#new-marketplace-listings-container')
      .children()
      .should('have.length', 2)
      .should('be.visible')
  })

  it('Displays the description text', () => {
    cy.contains('Discover and trade exclusive items from space missions').should(
      'be.visible'
    )
  })

  it('Has a View All Items button', () => {
    cy.contains('button', 'View All Items').should('be.visible')
  })
})
