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
      address: '0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b',
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
    cy.contains('Explore Map').should('exist')
    cy.contains('Unlock Roles').should('exist')
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
