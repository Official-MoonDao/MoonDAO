import { CitizenRenewalStatusView } from '@/components/subscription/CitizenRenewalStatus'

const DAY = 24 * 60 * 60

describe('CitizenRenewalStatus', () => {
  const now = Date.UTC(2026, 9, 3, 16, 0, 0)
  const expiresAt = now / 1000 + 200 * DAY

  it('shows the expiration date and a Renew button when citizenship is not close to lapsing', () => {
    const onRenew = cy.stub().as('onRenew')

    cy.mount(<CitizenRenewalStatusView expiresAt={expiresAt} nowMs={now} onRenew={onRenew} />)

    cy.get('[data-testid="citizen-renewal-status"]').should('have.attr', 'data-urgent', 'false')
    cy.get('[data-testid="citizen-renewal-date"]').should('contain', 'Expires')
    cy.get('[data-testid="citizen-renew-button"]').should('contain', 'Renew').click()
    cy.get('@onRenew').should('have.been.calledOnce')
  })

  it('turns the Renew button into a red alert within 30 days', () => {
    const soon = now / 1000 + 12 * DAY

    cy.mount(<CitizenRenewalStatusView expiresAt={soon} nowMs={now} onRenew={() => {}} />)

    cy.get('[data-testid="citizen-renewal-status"]').should('have.attr', 'data-urgent', 'true')
    cy.get('[data-testid="citizen-renewal-date"]').should('contain', '12 days left')
    cy.get('[data-testid="citizen-renew-button"]').should('have.class', 'bg-red-600')
  })
})
