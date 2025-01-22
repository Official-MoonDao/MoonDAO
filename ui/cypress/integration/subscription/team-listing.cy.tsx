import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_SLUG, CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import TeamABI from 'const/abis/Team.json'
import { MARKETPLACE_TABLE_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import { getContract } from 'thirdweb'
import { serverClient } from '@/lib/thirdweb/client'
import { daysFromNowTimestamp } from '@/lib/utils/timestamp'
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
      selectedChain: CYPRESS_CHAIN_V5,
      listing,
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
      refreshListings: cy.stub(),
      teamName: true,
      queriedListingId: undefined,
    }

    cy.mountNextRouter('/')
  })

  it('Renders the component', () => {
    cy.mount(
      <TestnetProviders>
        <TeamListing {...props} teamName />
      </TestnetProviders>
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
      <TestnetProviders>
        <TeamListing {...props} />
      </TestnetProviders>
    )

    cy.get('#listing-price').should((price) => {
      const parsedPrice = parseFloat(price.text())
      expect(parsedPrice.toFixed(5)).to.equal((+listing.price * 1.1).toFixed(5))
    })

    cy.get('#listing-savings').should(
      'have.text',
      `Save ${+listing.price * 0.1} ${listing.currency} with citizenship`
    )
  })

  it('Shows regular price for citizens', () => {
    cy.mount(
      <TestnetProviders>
        <TeamListing {...props} isCitizen />
      </TestnetProviders>
    )

    cy.get('#listing-price').should((price) => {
      const parsedPrice = parseFloat(price.text())
      expect(parsedPrice.toFixed(5)).to.equal((+listing.price).toFixed(5))
    })

    cy.get('#listing-original-price').should((price) => {
      const parsedPrice = parseFloat(price.text())
      expect(parsedPrice.toFixed(5)).to.equal((+listing.price * 1.1).toFixed(5))
    })
  })

  it('Opens the edit modal when the edit button is clicked', () => {
    cy.mount(
      <TestnetProviders>
        <TeamListing {...props} editable />
      </TestnetProviders>
    )

    cy.get('#edit-listing-button').click()
    cy.get('#team-marketplace-listing-modal-backdrop').should('exist')
  })

  it('Deletes the listing', () => {
    cy.mount(
      <TestnetProviders>
        <TeamListing {...props} editable />
      </TestnetProviders>
    )

    cy.get('#delete-listing-button').should('exist').click()
  })

  it("Hides the listing if it's expired", () => {
    const startTime = daysFromNowTimestamp(-2)
    const endTime = daysFromNowTimestamp(-1)
    cy.mount(
      <TestnetProviders>
        <TeamListing {...props} listing={{ ...listing, startTime, endTime }} />
      </TestnetProviders>
    )

    cy.get('#link-frame').should('not.exist')
  })

  it("Displays 'upcoming' message if the listing is upcoming and editable", () => {
    const startTime = daysFromNowTimestamp(1)
    const endTime = daysFromNowTimestamp(2)
    cy.mount(
      <TestnetProviders>
        <TeamListing
          {...props}
          listing={{ ...listing, startTime, endTime }}
          editable
        />
      </TestnetProviders>
    )

    cy.get('#listing-status').should(
      'have.text',
      `*This listing is not available for purchase until ${new Date(
        startTime * 1000
      ).toLocaleDateString()} ${new Date(
        startTime * 1000
      ).toLocaleTimeString()}`
    )
  })

  it('Displays the end time if the listing is timed', () => {
    const startTime = daysFromNowTimestamp(-1)
    const endTime = daysFromNowTimestamp(1)

    cy.mount(
      <TestnetProviders>
        <TeamListing {...props} listing={{ ...listing, startTime, endTime }} />
      </TestnetProviders>
    )

    cy.get('#listing-end-time').should('have.text', 'Offer ends in 1 day')
  })
})
