import BenefitCard from '@/components/launchpad/BenefitCard'

describe('<BenefitCard />', () => {
  const defaultProps = {
    title: 'Test Benefit',
    description: 'Test Description',
    icon: '/test-icon.svg',
    gradientFrom: 'from-[#6C407D]/40',
    gradientTo: 'to-[#5F4BA2]/40',
  }

  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('Renders with title, description, and icon', () => {
    cy.mount(<BenefitCard {...defaultProps} />)

    cy.contains('Test Benefit').should('be.visible')
    cy.contains('Test Description').should('be.visible')
    cy.get('img').should('have.attr', 'src').and('include', '/test-icon.svg')
  })

  it('Displays content correctly with different props', () => {
    const customProps = {
      title: 'Custom Title',
      description: 'Custom Description',
      icon: '/custom-icon.svg',
      gradientFrom: 'from-[#5F4BA2]/60',
      gradientTo: 'to-[#5159CC]/60',
    }

    cy.mount(<BenefitCard {...customProps} />)

    cy.contains('Custom Title').should('be.visible')
    cy.contains('Custom Description').should('be.visible')
    cy.get('img').should('have.attr', 'src').and('include', '/custom-icon.svg')
  })
})
