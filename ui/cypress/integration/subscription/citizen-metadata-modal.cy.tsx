import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { getAttribute } from '@/lib/utils/nft'
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
      <TestnetProviders>
        <CitizenMetadataModal {...props} />
      </TestnetProviders>
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
    cy.get('#citizen-name-input').should('have.value', nft.metadata.name)
    cy.get('#citizen-bio-input').should('have.value', nft.metadata.description)
    cy.get('#citizen-location-input').should(
      'have.value',
      getAttribute(nft.metadata.attributes, 'location').value
    )
    cy.get('#citizen-discord-input').should(
      'have.value',
      getAttribute(nft.metadata.attributes, 'discord').value
    )
    cy.get('#citizen-twitter-input').should(
      'have.value',
      getAttribute(nft.metadata.attributes, 'twitter').value
    )
    cy.get('#citizen-website-input').should(
      'have.value',
      getAttribute(nft.metadata.attributes, 'website').value
    )
  })
})
