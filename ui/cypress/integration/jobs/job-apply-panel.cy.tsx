import JobApplyPanel from '@/components/jobs/JobApplyPanel'

const share = {
  shareUrl: 'https://www.moondao.com/jobs/22',
  shareText: 'Social Media Manager at MoonDAO',
}

describe('<JobApplyPanel />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('shows the apply link to citizens', () => {
    cy.mount(
      <JobApplyPanel
        {...share}
        canApply
        applyUrl="https://airtable.com/apply"
        teamName="MoonDAO"
        teamHref="/team/1"
      />
    )

    cy.get('#job-apply-button')
      .should('be.visible')
      .and('have.attr', 'href', 'https://airtable.com/apply')
    cy.contains('Apply now').should('be.visible')
    cy.get('#job-apply-citizen-upsell').should('not.exist')
  })

  it('shows the citizenship teaser instead of how to apply', () => {
    cy.mount(
      <JobApplyPanel {...share} canApply={false} applyUrl="https://airtable.com/apply" />
    )

    cy.get('#job-apply-button').should('not.exist')
    cy.contains('https://airtable.com/apply').should('not.exist')
    cy.get('#job-apply-citizen-upsell').should('be.visible')
    cy.contains('Become a Citizen to apply').should('be.visible')
    cy.contains('Become a Citizen').should('be.visible')
  })
})
