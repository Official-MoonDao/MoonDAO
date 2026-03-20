import { FEATURED_MISSION } from 'const/config'
import FeaturedMissionSection from '@/components/home/FeaturedMissionSection'
import TestnetProviders from '../../mock/TestnetProviders'

const mockMissions = [
  {
    id: '4',
    projectId: '1',
    metadata: {
      name: 'Go to Space with Frank White',
      description:
        'Want to go to space? Join Frank White and bring the Overview Effect to Earth to help unite humanity.',
      logoUri: '/assets/project-default.png',
    },
  },
]

const mockFeaturedMissionData = {
  mission: mockMissions[0],
  projectMetadata: {},
  _stage: 0,
  _deadline: BigInt(0),
  _refundPeriod: BigInt(0),
  _primaryTerminalAddress: '0x0000000000000000000000000000000000000000',
  _token: '0x0000000000000000000000000000000000000000',
  _fundingGoal: BigInt(0),
  _ruleset: [],
}

describe('<FeaturedMissionSection />', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('Renders when featured mission data is provided', () => {
    cy.mount(
      <TestnetProviders>
        <FeaturedMissionSection
          missions={mockMissions}
          featuredMissionData={mockFeaturedMissionData}
        />
      </TestnetProviders>
    )

    if (FEATURED_MISSION && FEATURED_MISSION.id) {
      cy.contains('Featured Mission').should('be.visible')
      cy.contains('Go to Space with Frank White').should('be.visible')
      cy.get('[data-testid="mission-featured-title"]').should(($h) => {
        const el = $h[0] as HTMLElement
        expect(el.scrollWidth, 'title fits on one line').to.be.at.most(el.clientWidth + 2)
      })
    } else {
      cy.get('section').should('not.exist')
    }
  })

  it('Does not render when no featured mission data is available', () => {
    cy.mount(
      <TestnetProviders>
        <FeaturedMissionSection missions={[]} featuredMissionData={null} />
      </TestnetProviders>
    )

    // Component should return null when no featured mission data
    cy.get('section').should('not.exist')
    cy.contains('Featured Mission').should('not.exist')
  })

  it('Verifies FEATURED_MISSION config flag behavior', () => {
    if (FEATURED_MISSION === null) {
      expect(FEATURED_MISSION).to.be.null
    } else {
      expect(FEATURED_MISSION).to.have.property('id')
      expect(FEATURED_MISSION).to.have.property('name')
      expect(FEATURED_MISSION).to.have.property('description')
    }
  })
})
