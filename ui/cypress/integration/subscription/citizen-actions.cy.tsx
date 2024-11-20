import { ZERO_ADDRESS } from 'const/config'
import CitizenActions from '@/components/subscription/CitizenActions'

describe('<CitizenActions />', () => {
  let props: any
  let nft: any

  before(() => {
    cy.fixture('nft/citizen-nft').then((n) => {
      nft = n
    })
  })

  beforeEach(() => {
    props = {
      address: ZERO_ADDRESS,
      nft,
    }

    cy.mountNextRouter('/')
    cy.mount(<CitizenActions {...props} mooneyBalance={0} vmooneyBalance={0} />)
  })

  it('Renders component', () => {
    cy.get('#citizen-actions-container').should('exist')
    cy.contains('Create Project').should('exist')
    cy.contains('Get Mooney').should('exist')
    cy.contains('Create Project').should('exist')
    cy.contains('Get Rewards').should('exist')
    cy.contains('Explore the Network Map').should('exist')
    cy.contains('Connect to Guild.xyz').should('exist')
    cy.contains('Create a Team').should('exist')
  })

  it('Displays complete profile action if incomplete profile', () => {
    cy.mount(<CitizenActions {...props} incompleteProfile />)
    cy.contains('Complete Profile').should('exist')
  })

  it('Displays lock action if user has mooney but no vmooney', () => {
    cy.mount(
      <CitizenActions {...props} mooneyBalance={100} vmooneyBalance={0} />
    )
    cy.contains('Lock to Vote').should('exist')
  })
})
