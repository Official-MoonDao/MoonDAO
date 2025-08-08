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
      setCitizenMetadataModalEnabled: cy.stub(),
    }

    cy.mountNextRouter('/')
    cy.mount(<CitizenActions {...props} mooneyBalance={0} vmooneyBalance={0} />)
  })

  it('Renders component', () => {
    cy.get('#citizen-actions-container').should('exist')
    cy.contains('Create Project').should('exist')
    cy.contains('Get Mooney').should('exist')
    cy.contains('Submit Contribution').should('exist')
    cy.contains('Explore Map').should('exist')
    cy.contains('Link Discord').should('exist')
    cy.contains('Create a Team').should('exist')
    cy.contains('Share on X').should('exist')
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

  it('Does not show Get Mooney action if user has mooney or vmooney', () => {
    cy.mount(
      <CitizenActions {...props} mooneyBalance={100} vmooneyBalance={0} />
    )
    cy.contains('Get Mooney').should('not.exist')
  })

  it('Does not show Get Mooney action if user has vmooney', () => {
    cy.mount(
      <CitizenActions {...props} mooneyBalance={0} vmooneyBalance={50} />
    )
    cy.contains('Get Mooney').should('not.exist')
  })

  it('Shows Discord link action by default', () => {
    cy.mount(<CitizenActions {...props} />)
    cy.contains('Link Discord').should('exist')
    cy.contains('Link your Discord account to get roles').should('exist')
  })

  it('Does not show Create a Team action for team members', () => {
    cy.mount(<CitizenActions {...props} isTeamMember={true} />)
    cy.contains('Create a Team').should('not.exist')
  })

  it('Only renders if address matches NFT owner', () => {
    const differentProps = {
      ...props,
      address: '0xDifferentAddress',
    }
    cy.mount(<CitizenActions {...differentProps} />)
    cy.get('#citizen-actions-container').should('be.empty')
  })
})
