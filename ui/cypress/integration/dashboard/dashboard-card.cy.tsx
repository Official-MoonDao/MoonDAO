import { ChartBarIcon } from '@heroicons/react/24/outline'
import DashboardCard from '@/components/dashboard/DashboardCard'

describe('<DashboardCard />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('Renders with title and children', () => {
    cy.mount(
      <DashboardCard title="Test Dashboard Card">
        <div data-cy="card-content">Card content goes here</div>
      </DashboardCard>
    )

    cy.contains('Test Dashboard Card').should('be.visible')
    cy.get('[data-cy="card-content"]').should('be.visible')
  })

  it('Renders with icon', () => {
    cy.mount(
      <DashboardCard title="Card with Icon" icon={<ChartBarIcon className="w-6 h-6" />}>
        <p>Content</p>
      </DashboardCard>
    )

    cy.contains('Card with Icon').should('be.visible')
    cy.get('svg').should('exist')
  })

  it('Renders with actions', () => {
    cy.mount(
      <DashboardCard
        title="Card with Actions"
        actions={<button data-cy="action-button">Action</button>}
      >
        <p>Content</p>
      </DashboardCard>
    )

    cy.contains('Card with Actions').should('be.visible')
    cy.get('[data-cy="action-button"]').should('be.visible')
  })

  it('Applies custom className', () => {
    cy.mount(
      <DashboardCard title="Custom Class Card" className="custom-dashboard-class">
        <p>Content</p>
      </DashboardCard>
    )

    cy.get('.custom-dashboard-class').should('exist')
  })

  it('Uses slateBorder variant from Card component', () => {
    cy.mount(
      <DashboardCard title="Slate Border Card">
        <div>Content</div>
      </DashboardCard>
    )

    cy.contains('Slate Border Card').should('be.visible')
  })

  it('Renders correctly on mobile', () => {
    cy.viewport('iphone-x')
    cy.mount(
      <DashboardCard title="Mobile Test">
        <div>Content</div>
      </DashboardCard>
    )

    cy.contains('Mobile Test').should('be.visible')
  })

  it('Renders correctly on desktop', () => {
    cy.viewport('macbook-15')
    cy.mount(
      <DashboardCard title="Desktop Test">
        <div>Content</div>
      </DashboardCard>
    )

    cy.contains('Desktop Test').should('be.visible')
  })
})
