import { FEATURED_MISSION } from 'const/config'
import MissionBanner from '@/components/layout/MissionBanner'

describe('<MissionBanner />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('Renders when conditions are met', () => {
    cy.mount(<MissionBanner />)

    if (FEATURED_MISSION && process.env.NEXT_PUBLIC_HIDE_BANNER !== 'true') {
      cy.get('div').contains('Featured Mission:').should('be.visible')
      cy.contains('Support Mission').should('be.visible')
    } else {
      cy.get('div').contains('Featured Mission:').should('not.exist')
    }
  })

  it('Does not render when on mission page', () => {
    cy.mountNextRouter('/mission/3')

    cy.mount(<MissionBanner />)

    cy.get('div').contains('Featured Mission:').should('not.exist')
  })

  it('Can be closed by clicking the close button', () => {
    if (FEATURED_MISSION && process.env.NEXT_PUBLIC_HIDE_BANNER !== 'true') {
      cy.mount(<MissionBanner />)

      cy.get('div').contains('Featured Mission:').should('be.visible')

      cy.get('button[aria-label="Close banner"]').click()

      cy.get('div').contains('Featured Mission:').should('not.exist')
    } else {
      cy.log('Skipping test: Banner would not render with current config')
    }
  })

  it('Verifies NEXT_PUBLIC_HIDE_BANNER flag behavior', () => {
    const hideBanner = process.env.NEXT_PUBLIC_HIDE_BANNER === 'true'

    if (hideBanner) {
      cy.mount(<MissionBanner />)
      cy.get('div').contains('Featured Mission:').should('not.exist')
    } else {
      cy.mount(<MissionBanner />)
      if (FEATURED_MISSION) {
        cy.get('div').contains('Featured Mission:').should('be.visible')
      }
    }
  })

  it('Verifies FEATURED_MISSION config flag behavior', () => {
    if (FEATURED_MISSION === null) {
      cy.mount(<MissionBanner />)
      cy.get('div').contains('Featured Mission:').should('not.exist')
    } else {
      expect(FEATURED_MISSION).to.have.property('id')
      expect(FEATURED_MISSION).to.have.property('name')
    }
  })
})
