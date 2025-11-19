import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { useDeadlineTracking } from '@/lib/mission/useDeadlineTracking'

const DeadlineTrackingWrapper = ({
  deadline,
  refundPeriod,
}: {
  deadline: number | undefined
  refundPeriod: number | undefined
}) => {
  const refreshStageStub = cy.stub().as('refreshStage')
  const { duration, deadlinePassed, refundPeriodPassed } = useDeadlineTracking(
    deadline,
    refundPeriod,
    refreshStageStub
  )

  return (
    <div>
      <div data-testid="duration">{duration || 'N/A'}</div>
      <div data-testid="deadline-passed">{deadlinePassed ? 'true' : 'false'}</div>
      <div data-testid="refund-period-passed">{refundPeriodPassed ? 'true' : 'false'}</div>
    </div>
  )
}

describe('useDeadlineTracking', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('returns duration countdown string when deadline is in future', () => {
    const futureDeadline = Date.now() + 86400000 // 24 hours from now

    cy.mount(
      <TestnetProviders>
        <DeadlineTrackingWrapper deadline={futureDeadline} refundPeriod={undefined} />
      </TestnetProviders>
    )

    cy.get('[data-testid="duration"]').should('not.contain', 'N/A')
    cy.get('[data-testid="deadline-passed"]').should('contain', 'false')
  })

  it('sets deadlinePassed when deadline has passed', () => {
    const pastDeadline = Date.now() - 1000 // 1 second ago

    cy.mount(
      <TestnetProviders>
        <DeadlineTrackingWrapper deadline={pastDeadline} refundPeriod={undefined} />
      </TestnetProviders>
    )

    cy.wait(1100) // Wait for interval to run
    cy.get('[data-testid="deadline-passed"]').should('contain', 'true')
  })

  it('sets refundPeriodPassed when refund period has passed', () => {
    const pastDeadline = Date.now() - 2000
    const refundPeriod = 1000 // 1 second refund period

    cy.mount(
      <TestnetProviders>
        <DeadlineTrackingWrapper deadline={pastDeadline} refundPeriod={refundPeriod} />
      </TestnetProviders>
    )

    cy.wait(1100) // Wait for interval to run
    cy.get('[data-testid="refund-period-passed"]').should('contain', 'true')
  })

  it('handles undefined deadline gracefully', () => {
    cy.mount(
      <TestnetProviders>
        <DeadlineTrackingWrapper deadline={undefined} refundPeriod={undefined} />
      </TestnetProviders>
    )

    cy.get('[data-testid="duration"]').should('contain', 'N/A')
    cy.get('[data-testid="deadline-passed"]').should('contain', 'false')
  })
})
