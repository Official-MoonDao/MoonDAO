import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { ZERO_ADDRESS } from 'const/config'
import CitizenProvider from '@/lib/citizen/CitizenProvider'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
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
      selectedChain: Sepolia,
      listing,
      recipient: ZERO_ADDRESS,
      setEnabled: cy.stub(),
    }

    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <BuyTeamListingModal {...props} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )
  })

  it('Renders the component', () => {
    cy.contains('h2', 'Buy a Listing').should('be.visible')
    cy.contains(listing.title).should('be.visible')
    cy.contains(listing.description).should('be.visible')
    cy.contains(`${listing.price} ${listing.currency}`).should('be.visible')
  })

  it('Shows markedup price for non-citizens', () => {
    cy.get('#listing-price').should(
      'have.text',
      `${+listing.price * 1.1} ${listing.currency}`
    )
  })

  it('Shows regular price for citizens', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <CitizenProvider selectedChain={Sepolia} mock={true}>
            <BuyTeamListingModal {...props} />
          </CitizenProvider>
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('#listing-price').should(
      'have.text',
      `${listing.price} ${listing.currency}`
    )
  })
})
