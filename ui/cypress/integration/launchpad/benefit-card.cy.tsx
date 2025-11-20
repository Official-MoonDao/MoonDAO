import BenefitCard from '@/components/launchpad/BenefitCard'

describe('<BenefitCard />', () => {
  const defaultProps = {
    title: 'Test Benefit',
    description: 'Test Description',
    icon: '/test-icon.svg',
    gradientFrom: 'from-[#6C407D]/40',
    gradientTo: 'to-[#5F4BA2]/40',
  }

  it('Renders with title, description, and icon', () => {
    cy.mount(<BenefitCard {...defaultProps} />)

    cy.contains('Test Benefit').should('be.visible')
    cy.contains('Test Description').should('be.visible')
    cy.get('img[alt="Test Benefit"]').should('have.attr', 'src', '/test-icon.svg')
  })

  it('Applies correct gradient classes', () => {
    cy.mount(<BenefitCard {...defaultProps} />)

    cy.get('div').first().should('have.class', 'from-[#6C407D]/40')
    cy.get('div').first().should('have.class', 'to-[#5F4BA2]/40')
  })

  it('Handles hover states', () => {
    cy.mount(<BenefitCard {...defaultProps} />)

    cy.get('div').first().should('have.class', 'group')
    cy.get('div').first().should('have.class', 'hover:border-white/40')
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
    cy.get('img[alt="Custom Title"]').should('have.attr', 'src', '/custom-icon.svg')
  })

  it('Has correct structure with flex layout', () => {
    cy.mount(<BenefitCard {...defaultProps} />)

    cy.get('div').first().should('have.class', 'flex')
    cy.get('div').first().should('have.class', 'flex-col')
    cy.get('div').first().should('have.class', 'items-center')
    cy.get('div').first().should('have.class', 'text-center')
  })
})

