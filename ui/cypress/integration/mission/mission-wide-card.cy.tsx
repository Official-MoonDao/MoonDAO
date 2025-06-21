import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import { Mission } from '@/components/mission/MissionCard'
import MissionWideCard from '@/components/mission/MissionWideCard'

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

describe('MissionWideCard', () => {
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

  const mockToken = {
    tradeable: true,
    tokenAddress: '0x123',
    tokenSymbol: 'TEST',
  }

  const mockSubgraphData = {
    volume: 500000000000000000, // 0.5 ETH in wei
  }

  const defaultProps = {
    mission: mockMission,
    token: mockToken,
    subgraphData: mockSubgraphData,
    fundingGoal: mockMission.fundingGoal,
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
          projectId={mockMission.projectId}
          selectedChain={CYPRESS_CHAIN_V5}
        >
          <MissionWideCard {...defaultProps} />
        </JuiceProviders>
      </TestnetProviders>
    )
  })

  it('Renders with default props', () => {
    cy.get('#link-frame').should('exist')
  })

  it('Displays mission name correctly', () => {
    cy.get('#content h2').should('contain', mockMission.metadata.name)
  })

  it('Displays mission tagline correctly', () => {
    cy.get('#content div').should('contain', mockMission.metadata.tagline)
  })

  it('Shows funding goal correctly', () => {
    cy.get('#content').should('contain', '1 ETH')
  })

  it('Shows progress bar when volume and funding goal are provided', () => {
    cy.get('#content').should('contain', 'Goal')
  })

  it('Shows contribute button when contribute prop is true', () => {
    cy.mount(
      <TestnetProviders>
        <JuiceProviders
          projectId={mockMission.projectId}
          selectedChain={CYPRESS_CHAIN_V5}
        >
          <MissionWideCard {...defaultProps} contribute={true} />
        </JuiceProviders>
      </TestnetProviders>
    )
    cy.get('#content').should('contain', 'Contribute')
  })

  it('Handles missing token data gracefully', () => {
    cy.mount(
      <TestnetProviders>
        <JuiceProviders
          projectId={mockMission.projectId}
          selectedChain={CYPRESS_CHAIN_V5}
        >
          <MissionWideCard {...defaultProps} token={undefined} />
        </JuiceProviders>
      </TestnetProviders>
    )
    cy.get('#link-frame').should('exist')
  })

  it('Handles missing subgraph data gracefully', () => {
    cy.mount(
      <TestnetProviders>
        <JuiceProviders
          projectId={mockMission.projectId}
          selectedChain={CYPRESS_CHAIN_V5}
        >
          <MissionWideCard {...defaultProps} subgraphData={undefined} />
        </JuiceProviders>
      </TestnetProviders>
    )
    cy.get('#link-frame').should('exist')
  })
})
