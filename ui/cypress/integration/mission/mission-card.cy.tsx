import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import MissionCard from '@/components/mission/MissionCard'
import { Mission } from '@/components/mission/MissionCard'

// Define the type for our thirdweb mock
interface ThirdwebMock {
  MediaRenderer: React.FC<{ src: string; className: string }>
  client: { clientId: string }
  getNFT?: () => Promise<any>
}

// Mock thirdweb dependencies
const mockMediaRenderer = ({
  src,
  className,
}: {
  src: string
  className: string
}) => <img src={src} className={className} alt="Mock media" />

// Mock the client
const mockClient = {
  clientId: 'test-client-id',
}

describe('MissionCard', () => {
  const mockMission: Mission = {
    id: 1,
    teamId: 1,
    projectId: 1,
    fundingGoal: 1000000000000000000, // 1 ETH in wei
    metadata: {
      name: 'Test Mission',
      description: 'Test Description',
      tagline: 'Test Tagline',
      infoUri: 'https://test.com',
      logoUri: 'https://test.com/logo.png',
      twitter: '@test',
      discord: 'test#1234',
      tokens: ['ETH'],
      version: 1,
      payButton: 'Pay Now',
      payDisclosure: 'Test Disclosure',
      youtubeLink: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
  }

  const defaultProps = {
    mission: mockMission,
  }

  beforeEach(() => {
    cy.viewport(1000, 600)
    cy.mountNextRouter('/')
    // Mock thirdweb dependencies
    cy.window().then((win) => {
      ;(win as any).thirdweb = {
        MediaRenderer: mockMediaRenderer,
        client: mockClient,
      }
    })
    cy.mount(
      <TestnetProviders>
        <JuiceProviders
          projectId={defaultProps.mission.projectId}
          selectedChain={CYPRESS_CHAIN_V5}
        >
          <MissionCard {...defaultProps} />
        </JuiceProviders>
      </TestnetProviders>
    )
  })

  it('Renders with default props', () => {
    cy.get('#mission-card').should('exist')
  })

  it('Displays mission name correctly', () => {
    cy.get('#main-header').should('contain', mockMission.metadata.name)
  })

  it('Displays mission tagline correctly', () => {
    cy.get('#description-and-id').should(
      'contain',
      mockMission.metadata.tagline
    )
  })
})
