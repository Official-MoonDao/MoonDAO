import { PROJECT_SYSTEM_CONFIG } from 'const/config'
import ProjectBanner from '@/components/layout/ProjectBanner'

describe('<ProjectBanner />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('Does not render when deadline has passed', () => {
    const submissionDeadline = new Date(PROJECT_SYSTEM_CONFIG.submissionDeadline)
    const now = new Date()

    cy.mount(<ProjectBanner />)

    if (now > submissionDeadline) {
      // Banner should not be visible when deadline has passed
      cy.get('div').contains('Project Proposals Open').should('not.exist')
      cy.contains('Submit Proposal').should('not.exist')
    } else {
      // Banner should be visible when deadline has not passed
      cy.get('div').contains('Project Proposals Open').should('be.visible')
      cy.contains('Submit Proposal').should('be.visible')
    }
  })

  it('Does not render when on project pages', () => {
    const projectPages = ['/projects-overview', '/projects', '/proposals', '/submit']
    
    projectPages.forEach((page) => {
      cy.mountNextRouter(page)
      cy.mount(<ProjectBanner />)
      cy.get('div').contains('Project Proposals Open').should('not.exist')
    })
  })

  it('Can be closed by clicking the close button', () => {
    const submissionDeadline = new Date(PROJECT_SYSTEM_CONFIG.submissionDeadline)
    const now = new Date()

    // Only test if deadline has not passed
    if (now <= submissionDeadline && process.env.NEXT_PUBLIC_HIDE_PROJECT_BANNER !== 'true') {
      cy.mount(<ProjectBanner />)

      cy.get('div').contains('Project Proposals Open').should('be.visible')

      cy.get('button[aria-label="Close banner"]').click()

      cy.get('div').contains('Project Proposals Open').should('not.exist')
    } else {
      cy.log('Skipping test: Banner would not render with current config or deadline has passed')
    }
  })

  it('Respects NEXT_PUBLIC_HIDE_PROJECT_BANNER flag', () => {
    const hideBanner = process.env.NEXT_PUBLIC_HIDE_PROJECT_BANNER === 'true'

    if (hideBanner) {
      cy.mount(<ProjectBanner />)
      cy.get('div').contains('Project Proposals Open').should('not.exist')
    } else {
      const submissionDeadline = new Date(PROJECT_SYSTEM_CONFIG.submissionDeadline)
      const now = new Date()

      cy.mount(<ProjectBanner />)
      if (now <= submissionDeadline) {
        cy.get('div').contains('Project Proposals Open').should('be.visible')
      } else {
        cy.get('div').contains('Project Proposals Open').should('not.exist')
      }
    }
  })

  it('Displays correct deadline information', () => {
    const submissionDeadline = new Date(PROJECT_SYSTEM_CONFIG.submissionDeadline)
    const now = new Date()

    // Only test if deadline has not passed
    if (now <= submissionDeadline && process.env.NEXT_PUBLIC_HIDE_PROJECT_BANNER !== 'true') {
      cy.mount(<ProjectBanner />)

      cy.contains(`Deadline: ${PROJECT_SYSTEM_CONFIG.submissionDeadline}`).should('be.visible')
    } else {
      cy.log('Skipping test: Banner would not render with current config or deadline has passed')
    }
  })
})
