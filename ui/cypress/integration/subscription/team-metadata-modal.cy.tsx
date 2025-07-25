import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { getAttribute } from '@/lib/utils/nft'
import TeamMetadataModal from '@/components/subscription/TeamMetadataModal'

describe('<TeamMetadataModal /> ', () => {
  let nft: any
  let props: any

  before(() => {
    cy.fixture('nft/team-nft').then((tNFT) => {
      nft = tNFT
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
      <TestnetProviders>
        <TeamMetadataModal {...props} />
      </TestnetProviders>
    )
  })

  it('Renders the component and all stages', () => {
    cy.get('h1').contains('Update Team Info')
    cy.get('button').contains('Continue with this image').click()
    cy.get('button').contains('Yes, update email').should('exist')
    cy.get('button').contains('No, skip this step').should('exist').click()
    cy.get('p').contains('Name').should('exist')
  })

  it('Renders form inputs with correct initial values', () => {
    cy.get('button').contains('Continue with this image').click()
    cy.get('button').contains('No, skip this step').click()
    cy.get('#team-name-input').should('have.value', nft.metadata.name)
    cy.get('#team-bio-input').should('have.value', nft.metadata.description)
    cy.get('#team-twitter-input').should(
      'have.value',
      getAttribute(nft.metadata.attributes, 'twitter').value
    )
    cy.get('#team-communications-input').should(
      'have.value',
      getAttribute(nft.metadata.attributes, 'communications').value
    )
    cy.get('#team-website-input').should(
      'have.value',
      getAttribute(nft.metadata.attributes, 'website').value
    )
  })
})
