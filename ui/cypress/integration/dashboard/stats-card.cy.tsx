import { UserGroupIcon } from '@heroicons/react/24/outline'
import StatsCard from '@/components/dashboard/StatsCard'

describe('<StatsCard />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('Renders with title and value', () => {
    cy.mount(<StatsCard title="Active Users" value={1234} />)

    cy.contains('Active Users').should('be.visible')
    cy.contains('1,234').should('be.visible')
  })

  it('Renders with subtitle', () => {
    cy.mount(<StatsCard title="Total Revenue" value="$8.5M" subtitle="This month" />)

    cy.contains('Total Revenue').should('be.visible')
    cy.contains('$8.5M').should('be.visible')
    cy.contains('This month').should('be.visible')
  })

  it('Renders with positive trend', () => {
    cy.mount(
      <StatsCard title="Growth Rate" value={85} trend={{ value: '+12%', isPositive: true }} />
    )

    cy.contains('Growth Rate').should('be.visible')
    cy.contains('85').should('be.visible')
    cy.contains('+12%').should('be.visible')
    cy.contains('↑').should('be.visible')
  })

  it('Renders with negative trend', () => {
    cy.mount(<StatsCard title="Churn Rate" value={5} trend={{ value: '-3%', isPositive: false }} />)

    cy.contains('Churn Rate').should('be.visible')
    cy.contains('5').should('be.visible')
    cy.contains('-3%').should('be.visible')
    cy.contains('↓').should('be.visible')
  })

  it('Renders with icon', () => {
    cy.mount(
      <StatsCard
        title="Team Members"
        value={42}
        icon={<UserGroupIcon className="w-6 h-6" data-cy="user-icon" />}
      />
    )

    cy.contains('Team Members').should('be.visible')
    cy.contains('42').should('be.visible')
    cy.get('[data-cy="user-icon"]').should('exist')
  })

  it('Applies custom className', () => {
    cy.mount(<StatsCard title="Custom Stats" value={100} className="custom-stats-class" />)

    cy.get('.custom-stats-class').should('exist')
  })

  it('Renders all props together', () => {
    cy.mount(
      <StatsCard
        title="Complete Stats"
        value={9876}
        subtitle="Monthly active"
        icon={<UserGroupIcon className="w-6 h-6" />}
        trend={{ value: '+15%', isPositive: true }}
        className="complete-stats"
      />
    )

    cy.contains('Complete Stats').should('be.visible')
    cy.contains('9,876').should('be.visible')
    cy.contains('Monthly active').should('be.visible')
    cy.contains('+15%').should('be.visible')
    cy.get('.complete-stats').should('exist')
  })

  it('Uses stats layout from Card component', () => {
    cy.mount(<StatsCard title="Stats Layout Test" value={500} />)

    cy.contains('Stats Layout Test').should('be.visible')
  })

  it('Renders correctly on mobile', () => {
    cy.viewport('iphone-x')
    cy.mount(<StatsCard title="Mobile Stats" value={123} />)

    cy.contains('Mobile Stats').should('be.visible')
  })

  it('Renders correctly on desktop', () => {
    cy.viewport('macbook-15')
    cy.mount(
      <StatsCard title="Desktop Stats" value={456} trend={{ value: '+10%', isPositive: true }} />
    )

    cy.contains('Desktop Stats').should('be.visible')
  })
})
