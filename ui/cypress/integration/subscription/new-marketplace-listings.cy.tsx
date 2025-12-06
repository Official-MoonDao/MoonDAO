import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_SLUG, CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import TeamABI from 'const/abis/Team.json'
import { MARKETPLACE_TABLE_ADDRESSES, TABLELAND_ENDPOINT, TEAM_ADDRESSES } from 'const/config'
import { getContract } from 'thirdweb'
import * as thirdweb from 'thirdweb'
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
    // Restore any previous stubs
    if ((thirdweb as any).readContract?.restore) {
      ;(thirdweb as any).readContract.restore()
    }

    // Mock readContract for getTableName and expiresAt
    cy.stub(thirdweb, 'readContract').callsFake(async (options: any) => {
      if (options.method === 'getTableName') {
        return Promise.resolve(mockTableName)
      }
      if (options.method === 'expiresAt') {
        return Promise.resolve(BigInt(futureTimestamp))
      }
      return Promise.resolve(null)
    })

    // Set up intercept to match the exact URL pattern used by SWR fetcher
    cy.intercept('GET', '**/api/tableland/query*', (req) => {
      req.reply({
        statusCode: 200,
        body: [listing, listing],
      })
    }).as('getNewMarketplaceListings')

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

    cy.mountNextRouter('/')
  })

  it('Renders the component and listings', () => {
    cy.mount(
      <TestnetProviders>
        <NewMarketplaceListings {...props} />
      </TestnetProviders>
    )

    cy.wait('@getNewMarketplaceListings', { timeout: 15000 })
    cy.contains('h3', 'Newest Listings', { timeout: 10000 }).should('be.visible')

    // Wait for listings to be processed and rendered - need to wait for async processing
    cy.get('#new-marketplace-listings-container', { timeout: 10000 }).should('exist')
    cy.get('#new-marketplace-listings-container', { timeout: 15000 })
      .children()
      .should('have.length', 2)
  })

  it('Displays the description text', () => {
    cy.mount(
      <TestnetProviders>
        <NewMarketplaceListings {...props} />
      </TestnetProviders>
    )
    cy.contains('Discover and trade exclusive items from space missions', {
      timeout: 10000,
    }).should('be.visible')
  })

  it('Has a View All Items button', () => {
    cy.mount(
      <TestnetProviders>
        <NewMarketplaceListings {...props} />
      </TestnetProviders>
    )
    cy.contains('button', 'View All Items', { timeout: 10000 }).should('be.visible')
  })
})
