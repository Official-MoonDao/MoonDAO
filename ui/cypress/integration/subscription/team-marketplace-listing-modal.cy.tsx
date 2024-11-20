import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { Toaster } from 'react-hot-toast'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
import { TeamListing as TeamListingType } from '@/components/subscription/TeamListing'
import TeamMarketplaceListingModal from '@/components/subscription/TeamMarketplaceListingModal'

describe('<TeamListing />', () => {
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
      marketplaceTableContract: {
        call: cy.stub().resolves({ receipt: true }),
      },
      edit: false,
      listing,
    }
  })

  it('Renders the component', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <TeamMarketplaceListingModal {...props} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )
    cy.get('h2').should('contain', 'Add a Listing')
  })
  it('Displays error when required fields are empty', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <TeamMarketplaceListingModal {...props} />
          <Toaster />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )
    cy.get('form').submit()
    cy.get('div').should('contain', 'Please fill out all fields')
  })
  it('Submits form with valid data', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <TeamMarketplaceListingModal {...props} edit />
          <Toaster />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
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

    // Assert that the onSubmit function was called
    cy.wrap(props.marketplaceTableContract.call).should('be.called')
  })
})
