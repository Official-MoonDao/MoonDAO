import TestnetProviders from '@/cypress/mock/TestnetProviders'
import MissionJuiceboxFooter from '@/components/mission/MissionJuiceboxFooter'

describe('MissionJuiceboxFooter', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('renders the footer with Juicebox link', () => {
    cy.mount(
      <TestnetProviders>
        <MissionJuiceboxFooter projectId={123} isManager={false} />
      </TestnetProviders>
    )

    cy.get('a[href*="juicebox.money"]').should('exist')
    cy.get('a[href*="juicebox.money"]').should('have.attr', 'target', '_blank')
    cy.get('a[href*="juicebox.money"]').should(
      'have.attr',
      'href',
      'https://juicebox.money/v5/arb:123'
    )
  })

  it('shows edit project text when isManager is true', () => {
    cy.mount(
      <TestnetProviders>
        <MissionJuiceboxFooter projectId={123} isManager={true} />
      </TestnetProviders>
    )

    cy.contains('(Edit Project)').should('be.visible')
  })

  it('does not show edit project text when isManager is false', () => {
    cy.mount(
      <TestnetProviders>
        <MissionJuiceboxFooter projectId={123} isManager={false} />
      </TestnetProviders>
    )

    cy.contains('(Edit Project)').should('not.exist')
  })

  it('renders with different project IDs', () => {
    cy.mount(
      <TestnetProviders>
        <MissionJuiceboxFooter projectId={456} isManager={false} />
      </TestnetProviders>
    )

    cy.get('a[href*="juicebox.money"]').should(
      'have.attr',
      'href',
      'https://juicebox.money/v5/arb:456'
    )
  })
})
