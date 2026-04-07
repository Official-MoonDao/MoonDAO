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
      setEnabled: cy.stub().as('setEnabled'),
    }
    cy.mountNextRouter('/')
    cy.mount(
      <TestnetProviders>
        <CitizenMetadataModal {...props} />
      </TestnetProviders>
    )
  })

  it('Renders the modal with correct title', () => {
    cy.get('[data-testid="modal-title"]').contains('Edit Profile')
  })

  it('Renders all sections on a single panel', () => {
    cy.contains('Profile Picture').should('be.visible')
    cy.contains('Basic Information').should('be.visible')
    cy.contains('Update Email').should('be.visible')
    cy.contains('I acknowledge that this info will be stored permanently onchain.').should(
      'be.visible'
    )
    cy.contains('Update Profile').should('be.visible')
    cy.contains('Danger Zone').should('be.visible')
  })

  it('Does not display any existing citizen image', () => {
    cy.get('img[src*="ipfs"]').should('not.exist')
  })

  it('Does not render a Continue button', () => {
    cy.contains('button', 'Continue').should('not.exist')
  })

  it('Does not render stage-navigation buttons', () => {
    cy.contains('button', 'Next: Update Profile Picture').should('not.exist')
    cy.contains('button', 'Skip for Now').should('not.exist')
  })

  it('Renders form inputs with correct initial values', () => {
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
    cy.get('#citizen-instagram-input').should(
      'have.value',
      getAttribute(nft.metadata.attributes, 'instagram').value
    )
    cy.get('#citizen-linkedin-input').should(
      'have.value',
      getAttribute(nft.metadata.attributes, 'linkedin').value
    )
    cy.get('#citizen-website-input').should(
      'have.value',
      getAttribute(nft.metadata.attributes, 'website').value
    )
  })

  it('Allows editing form fields', () => {
    cy.get('#citizen-name-input').clear().type('New Name')
    cy.get('#citizen-name-input').should('have.value', 'New Name')

    cy.get('#citizen-bio-input').clear().type('New Bio')
    cy.get('#citizen-bio-input').should('have.value', 'New Bio')

    cy.get('#citizen-location-input').clear().type('New Location')
    cy.get('#citizen-location-input').should('have.value', 'New Location')

    cy.get('#citizen-discord-input').clear().type('newdiscord')
    cy.get('#citizen-discord-input').should('have.value', 'newdiscord')
  })

  it('Keeps Update Profile button disabled until checkbox is checked', () => {
    cy.contains('Update Profile')
      .closest('button')
      .should('be.disabled')

    cy.get('input[type="checkbox"]').check({ force: true })

    cy.contains('Update Profile')
      .closest('button')
      .should('not.be.disabled')
  })

  it('Toggles the Update Email section', () => {
    cy.get('.typeform-widget-container').should('not.exist')

    cy.contains('button', 'Update Email').click()
    cy.get('.typeform-widget-container').should('exist')

    cy.contains('button', 'Update Email').click()
    cy.get('.typeform-widget-container').should('not.exist')
  })

  it('Renders the Danger Zone with delete functionality', () => {
    cy.contains('Danger Zone').should('be.visible')
    cy.contains('Deleting your profile data is permanent').should('be.visible')
    cy.contains('button', 'Delete Data').should('be.visible')
  })

  it('Danger Zone delete button shows confirmation before deleting', () => {
    cy.contains('button', 'Delete Data').click()
    cy.contains('Are you sure you want to delete this data?').should('be.visible')
    cy.contains('This action cannot be undone').should('be.visible')
    cy.contains('button', 'Cancel').should('be.visible')
  })

  it('Danger Zone confirmation can be cancelled', () => {
    cy.contains('button', 'Delete Data').click()
    cy.contains('Are you sure you want to delete this data?').should('be.visible')
    cy.contains('button', 'Cancel').click()
    cy.contains('Are you sure you want to delete this data?').should('not.exist')
    cy.contains('button', 'Delete Data').should('be.visible')
  })

  it('Closes the modal via the close button', () => {
    cy.get('[data-testid="modal-close"]').first().click()
    cy.get('@setEnabled').should('have.been.calledWith', false)
  })
})
