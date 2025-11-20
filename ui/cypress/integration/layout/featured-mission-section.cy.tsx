import { FEATURED_MISSION, FEATURED_MISSION_INDEX } from 'const/config'
import FeaturedMissionSection from '@/components/home/FeaturedMissionSection'
import TestnetProviders from '../../mock/TestnetProviders'

const mockMissions = [
  {
    id: '3',
    projectId: '1',
    metadata: {
      name: 'Support the Inspiration4 Complex at Space Camp',
      description:
        'Donate to support real training hardware and inspire future astronauts at Space Camp, USA',
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
  _backers: [],
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

    if (FEATURED_MISSION && FEATURED_MISSION_INDEX !== null) {
      cy.contains('Featured Mission').should('be.visible')
      cy.contains('Support the Inspiration4 Complex at Space Camp').should('be.visible')
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
      expect(FEATURED_MISSION_INDEX).to.be.null
    } else {
      expect(FEATURED_MISSION).to.have.property('id')
      expect(FEATURED_MISSION).to.have.property('name')
      expect(FEATURED_MISSION_INDEX).to.not.be.null
    }
  })
})
