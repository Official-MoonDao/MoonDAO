import AchievementCard from '@/components/launchpad/AchievementCard'

describe('<AchievementCard />', () => {
  const defaultProps = {
    value: '$8',
    label: 'Million',
    description: 'Dollars raised through decentralized funding.',
    icon: '/test-icon.svg',
    gradientFrom: 'from-[#6C407D]/20',
    gradientTo: 'to-[#5F4BA2]/20',
  }

  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('Renders value, label, and description', () => {
    cy.mount(<AchievementCard {...defaultProps} />)

    cy.contains('$8').should('be.visible')
    cy.contains('Million').should('be.visible')
    cy.contains('Dollars raised through decentralized funding.').should('be.visible')
  })

  it('Displays numeric values correctly', () => {
    const numericProps = {
      value: 12000,
      label: 'holders',
      description: '$MOONEY token holders.',
      icon: '/test-icon.svg',
      gradientFrom: 'from-[#4660E7]/20',
      gradientTo: 'to-[#6C407D]/20',
    }

    cy.mount(<AchievementCard {...numericProps} />)

    cy.contains('12000').should('be.visible')
    cy.contains('holders').should('be.visible')
  })

  it('Renders icon correctly', () => {
    cy.mount(<AchievementCard {...defaultProps} />)

    cy.get('img').should('have.attr', 'src').and('include', '/test-icon.svg')
  })
})
