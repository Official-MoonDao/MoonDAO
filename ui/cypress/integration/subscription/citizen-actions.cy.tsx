import { ZERO_ADDRESS } from 'const/config'
import CitizenActions from '@/components/subscription/CitizenActions'

describe('<CitizenActions />', () => {
  let props: any
  let nft: any
  let incompleteNft: any
  before(() => {
    cy.fixture('nft/citizen-nft').then((n) => {
      nft = n
    })
    cy.fixture('nft/incomplete-citizen-nft').then((n) => {
      incompleteNft = n
    })
  })

  beforeEach(() => {
    props = {
      address: ZERO_ADDRESS,
      nft,
    }

    cy.mountNextRouter('/')
    cy.mount(<CitizenActions {...props} />)
  })

  it('Renders component', () => {
    cy.get('div#team-actions-container').should('exist')
    cy.contains('Create Project').should('exist')
    cy.contains('Browse Jobs').should('exist')
    cy.contains('Get Rewards').should('exist')
  })

  it('Displays complete profile action if incomplete profile', () => {
    cy.mount(<CitizenActions {...props} nft={incompleteNft} />)
    cy.contains('Complete Profile').should('exist')
  })
})
