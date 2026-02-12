import { PROJECT_SYSTEM_CONFIG } from 'const/config'
import ProjectBanner from '@/components/layout/ProjectBanner'

describe('<ProjectBanner />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('Renders when deadline has not passed', () => {
    // Set clock to a date before the deadline
    const beforeDeadline = new Date(PROJECT_SYSTEM_CONFIG.submissionDeadline)
    beforeDeadline.setDate(beforeDeadline.getDate() - 1) // One day before deadline
    cy.clock(beforeDeadline)

    cy.mount(<ProjectBanner />)

    // Banner should be visible when deadline has not passed (unless env var hides it)
    if (process.env.NEXT_PUBLIC_HIDE_PROJECT_BANNER === 'true') {
      cy.get('div').contains('Project Proposals Open').should('not.exist')
    } else {
      cy.get('div').contains('Project Proposals Open').should('be.visible')
      cy.contains('Submit Proposal').should('be.visible')
    }
  })

  it('Does not render when deadline has passed', () => {
    // Set clock to a date after the deadline
    const afterDeadline = new Date(PROJECT_SYSTEM_CONFIG.submissionDeadline)
    afterDeadline.setDate(afterDeadline.getDate() + 1) // One day after deadline
    cy.clock(afterDeadline)

    cy.mount(<ProjectBanner />)

    // Banner should not be visible when deadline has passed
    cy.get('div').contains('Project Proposals Open').should('not.exist')
    cy.contains('Submit Proposal').should('not.exist')
  })

  it('Does not render when on project pages', () => {
    // Set clock to a date before the deadline to ensure we're testing page routing, not deadline logic
    const beforeDeadline = new Date(PROJECT_SYSTEM_CONFIG.submissionDeadline)
    beforeDeadline.setDate(beforeDeadline.getDate() - 1)
    cy.clock(beforeDeadline)

    const projectPages = ['/projects-overview', '/projects', '/proposals', '/submit']
    
    projectPages.forEach((page) => {
      cy.mountNextRouter(page)
      cy.mount(<ProjectBanner />)
      cy.get('div').contains('Project Proposals Open').should('not.exist')
    })
  })

  it('Can be closed by clicking the close button', () => {
    // Set clock to a date before the deadline
    const beforeDeadline = new Date(PROJECT_SYSTEM_CONFIG.submissionDeadline)
    beforeDeadline.setDate(beforeDeadline.getDate() - 1)
    cy.clock(beforeDeadline)

    // Only test close button if banner would be visible
    if (process.env.NEXT_PUBLIC_HIDE_PROJECT_BANNER !== 'true') {
      cy.mount(<ProjectBanner />)

      cy.get('div').contains('Project Proposals Open').should('be.visible')

      cy.get('button[aria-label="Close banner"]').click()

      cy.get('div').contains('Project Proposals Open').should('not.exist')
    } else {
      cy.log('Skipping test: Banner is hidden by environment variable')
    }
  })

  it('Respects NEXT_PUBLIC_HIDE_PROJECT_BANNER flag behavior', () => {
    // Set clock to a date before the deadline
    const beforeDeadline = new Date(PROJECT_SYSTEM_CONFIG.submissionDeadline)
    beforeDeadline.setDate(beforeDeadline.getDate() - 1)
    cy.clock(beforeDeadline)

    const hideBanner = process.env.NEXT_PUBLIC_HIDE_PROJECT_BANNER === 'true'

    cy.mount(<ProjectBanner />)

    if (hideBanner) {
      // Banner should be hidden when environment variable is set to 'true'
      cy.get('div').contains('Project Proposals Open').should('not.exist')
    } else {
      // Banner should be visible when environment variable is not set to 'true'
      cy.get('div').contains('Project Proposals Open').should('be.visible')
    }
  })

  it('Displays correct deadline information', () => {
    // Set clock to a date before the deadline
    const beforeDeadline = new Date(PROJECT_SYSTEM_CONFIG.submissionDeadline)
    beforeDeadline.setDate(beforeDeadline.getDate() - 1)
    cy.clock(beforeDeadline)

    // Only test deadline display if banner would be visible
    if (process.env.NEXT_PUBLIC_HIDE_PROJECT_BANNER !== 'true') {
      cy.mount(<ProjectBanner />)

      cy.contains(`Deadline: ${PROJECT_SYSTEM_CONFIG.submissionDeadline}`).should('be.visible')
    } else {
      cy.log('Skipping test: Banner is hidden by environment variable')
    }
  })
})
