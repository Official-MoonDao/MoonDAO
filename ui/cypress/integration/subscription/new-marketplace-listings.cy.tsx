import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { TABLELAND_ENDPOINT, ZERO_ADDRESS } from 'const/config'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
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
      teamContract: {
        call: cy.stub().callsFake((method, args) => {
          if (method === 'expiresAt') {
            return Promise.resolve({
              toNumber: () => 1234567890,
            })
          }
          return Promise.resolve('TestTeamTable')
        }),
        getAddress: cy.stub().resolves(ZERO_ADDRESS),
        erc721: {
          get: cy.stub().resolves({
            metadata: {
              name: 'Test Listing',
            },
            owner: ZERO_ADDRESS,
          }),
        },
      },
      marketplaceTableContract: {
        call: cy.stub().resolves('TestMarketplaceTable'),
        getAddress: cy.stub().resolves(ZERO_ADDRESS),
      },
    }

    cy.intercept('GET', `${TABLELAND_ENDPOINT}?statement=*`, {
      statusCode: 200,
      body: [listing, listing],
    }).as('getNewMarketplaceListings')

    cy.mountNextRouter('/')
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <NewMarketplaceListings {...props} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
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
