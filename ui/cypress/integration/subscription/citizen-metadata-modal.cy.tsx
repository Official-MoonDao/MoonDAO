import { PrivyProvider } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import { PrivyThirdwebSDKProvider } from '@/lib/privy/PrivyThirdwebSDKProvider'
import CitizenMetadataModal from '@/components/subscription/CitizenMetadataModal'

describe('<CitizenMetadataModal /> ', () => {
  let nft: any
  let props: any

  before(() => {
    cy.fixture('nft/citizen-nft').then((cNFT) => {
      nft = cNFT
    })
  })

  beforeEach(() => {
    props = {
      nft,
      selectedChain: { slug: 'sepolia' },
      setEnabled: cy.stub(),
    }
    cy.mountNextRouter('/')
    cy.mount(
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}>
        <PrivyThirdwebSDKProvider selectedChain={Sepolia}>
          <CitizenMetadataModal {...props} />
        </PrivyThirdwebSDKProvider>
      </PrivyProvider>
    )
  })

  it('Renders the component and all stages', () => {
    cy.get('h1').contains('Update Info')
    cy.get('button').contains('Next').click()
    cy.get('button').contains('Yes').should('exist')
    cy.get('button').contains('No').should('exist').click()
    cy.get('p').contains('Name').should('exist')
  })

  it('Renders form inputs with correct initial values', () => {
    cy.get('button').contains('Next').click()
    cy.get('button').contains('No').click()
    cy.get('input[placeholder="Enter your name"]').should(
      'have.value',
      'Test Name'
    )
    cy.get('input[placeholder="Enter your description"]').should(
      'have.value',
      'Test Description'
    )
    cy.get('input[placeholder="Enter your location"]').should(
      'have.value',
      'Test Location'
    )
    cy.get('input[placeholder="Enter your discord username"]').should(
      'have.value',
      'Test Discord'
    )
    cy.get('input[placeholder="Enter your twitter link"]').should(
      'have.value',
      'Test Twitter'
    )
    cy.get('input[placeholder="Enter your website link"]').should(
      'have.value',
      'Test Website'
    )
  })

  it('Closes the modal', () => {
    cy.get('#close-modal').click()
    cy.wrap(props.setEnabled).should('have.been.calledWith', false)
  })
})
