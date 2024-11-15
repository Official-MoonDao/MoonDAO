import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
import TeamListing, {
  TeamListing as TeamListingType,
} from '@/components/subscription/TeamListing'

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
      selectedChain: Sepolia,
      listing,
      teamContract: {
        erc721: {
          get: cy.stub().resolves({
            metadata: { name: 'Test Team Name' },
            owner: '0x123',
          }),
        },
      },
      marketplaceTableContract: {
        call: cy.stub().resolves(),
      },
      refreshListings: cy.stub(),
      teamName: true,
      queriedListingId: 1,
    }
  })

  it('Renders the component', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <TeamListing {...props} teamName />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('#listing-team-name').should('exist')
    cy.get('#main-header').should('have.text', props.listing.title)
    cy.get('#listing-description').should(
      'have.text',
      props.listing.description
    )
  })

  it('Shows markedup price for non-citizens', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <TeamListing {...props} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('#listing-price').should((price) => {
      const parsedPrice = parseFloat(price.text())
      expect(parsedPrice.toFixed(5)).to.equal((+listing.price * 1.1).toFixed(5))
    })
  })

  it('Shows regular price for citizens', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <TeamListing {...props} isCitizen />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('#listing-price').should((price) => {
      const parsedPrice = parseFloat(price.text())
      expect(parsedPrice.toFixed(5)).to.equal((+listing.price).toFixed(5))
    })
  })

  it('Opens the edit modal when the edit button is clicked', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <TeamListing {...props} editable />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('#edit-listing-button').click()
    cy.get('#team-marketplace-listing-modal-backdrop').should('exist')
  })

  it('Deletes the listing when the delete button is clicked', () => {
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <TeamListing {...props} editable />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )

    cy.get('#delete-listing-button').click()
    cy.wrap(props.marketplaceTableContract.call).should(
      'be.calledWith',
      'deleteFromTable',
      [listing.id, listing.teamId]
    )
  })
})
