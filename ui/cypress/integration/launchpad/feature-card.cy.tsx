import FeatureCard from '@/components/launchpad/FeatureCard'

describe('<FeatureCard />', () => {
  const defaultProps = {
    title: 'Global Access',
    description: 'Tap into a global crypto network with trillions of dollars at your fingertips.',
    icon: '/test-icon.svg',
    gradientFrom: 'from-[#6C407D]',
    gradientTo: 'to-[#5F4BA2]',
  }

  it('Renders title, description, and icon', () => {
    cy.mount(<FeatureCard {...defaultProps} />)

    cy.contains('Global Access').should('be.visible')
    cy.contains('Tap into a global crypto network').should('be.visible')
    cy.get('img[alt="Global Access"]').should('have.attr', 'src', '/test-icon.svg')
  })

  it('Displays content correctly with different props', () => {
    const customProps = {
      title: 'Trustless',
      description: 'All transactions are onchain.',
      icon: '/custom-icon.svg',
      gradientFrom: 'from-[#5F4BA2]',
      gradientTo: 'to-[#5159CC]',
    }

    cy.mount(<FeatureCard {...customProps} />)

    cy.contains('Trustless').should('be.visible')
    cy.contains('All transactions are onchain.').should('be.visible')
  })
})
