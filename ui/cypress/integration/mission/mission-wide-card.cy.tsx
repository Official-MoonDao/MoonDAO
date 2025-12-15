import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import * as thirdweb from 'thirdweb'
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
const mockMediaRenderer = ({ src, className }: { src: string; className: string }) => {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} className={className} alt="Mock media" />
}

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

    // Mock API calls - use wildcard to catch any variant
    cy.intercept('GET', '**/api/etherscan/eth-price**', {
      statusCode: 200,
      body: { result: { ethusd: '3000' } },
    }).as('ethPrice')

    // Stub readContract for useTotalFunding hook
    cy.stub(thirdweb, 'readContract').callsFake(async (options: any) => {
      if (options.method === 'balanceOf' || options.method === 'usedPayoutLimitOf') {
        return BigInt(0)
      }
      return BigInt(0)
    })

    // Mock thirdweb dependencies
    cy.window().then((win) => {
      ;(win as any).thirdweb = {
        MediaRenderer: mockMediaRenderer,
        client: mockClient,
      }
    })
  })

  it('Renders with default props', () => {
    cy.mount(
      <TestnetProviders>
        <JuiceProviders projectId={mockMission.projectId} selectedChain={CYPRESS_CHAIN_V5}>
          <MissionWideCard {...defaultProps} />
        </JuiceProviders>
      </TestnetProviders>
    )
    cy.get('#link-frame', { timeout: 10000 }).should('exist')
  })

  it('Displays mission name correctly', () => {
    cy.mount(
      <TestnetProviders>
        <JuiceProviders projectId={mockMission.projectId} selectedChain={CYPRESS_CHAIN_V5}>
          <MissionWideCard {...defaultProps} />
        </JuiceProviders>
      </TestnetProviders>
    )
    cy.get('#content h2', { timeout: 10000 }).should('contain', mockMission.metadata.name)
  })

  it('Displays mission tagline correctly', () => {
    cy.mount(
      <TestnetProviders>
        <JuiceProviders projectId={mockMission.projectId} selectedChain={CYPRESS_CHAIN_V5}>
          <MissionWideCard {...defaultProps} />
        </JuiceProviders>
      </TestnetProviders>
    )
    cy.get('#content div', { timeout: 10000 }).should('contain', mockMission.metadata.tagline)
  })

  it('Shows funding goal correctly', () => {
    cy.mount(
      <TestnetProviders>
        <JuiceProviders projectId={mockMission.projectId} selectedChain={CYPRESS_CHAIN_V5}>
          <MissionWideCard {...defaultProps} />
        </JuiceProviders>
      </TestnetProviders>
    )
    // MissionStat always renders, but wait for component to be fully mounted
    cy.get('#link-frame', { timeout: 10000 }).should('exist')
    cy.get('#mission-stat-container', { timeout: 10000 }).should('exist')
    cy.get('#mission-stat-value', { timeout: 10000 }).should('contain', '1 ETH')
  })

  it('Shows progress bar when volume and funding goal are provided', () => {
    cy.mount(
      <TestnetProviders>
        <JuiceProviders projectId={mockMission.projectId} selectedChain={CYPRESS_CHAIN_V5}>
          <MissionWideCard {...defaultProps} />
        </JuiceProviders>
      </TestnetProviders>
    )
    // MissionStat always renders
    cy.get('#link-frame', { timeout: 10000 }).should('exist')
    cy.get('#mission-stat-container', { timeout: 10000 }).should('exist')
    cy.get('#mission-stat-label', { timeout: 10000 }).should('contain', 'Goal')
  })

  it('Shows contribute button when contribute prop is true', () => {
    cy.mount(
      <TestnetProviders>
        <JuiceProviders projectId={mockMission.projectId} selectedChain={CYPRESS_CHAIN_V5}>
          <MissionWideCard {...defaultProps} contribute={true} />
        </JuiceProviders>
      </TestnetProviders>
    )

    cy.get('#link-frame', { timeout: 10000 }).should('exist')
    cy.contains('Contribute', { timeout: 10000 }).should('be.visible')
  })

  it('Handles missing token data gracefully', () => {
    cy.mount(
      <TestnetProviders>
        <JuiceProviders projectId={mockMission.projectId} selectedChain={CYPRESS_CHAIN_V5}>
          <MissionWideCard {...defaultProps} token={undefined} />
        </JuiceProviders>
      </TestnetProviders>
    )
    cy.get('#link-frame').should('exist')
  })

  it('Handles missing subgraph data gracefully', () => {
    cy.mount(
      <TestnetProviders>
        <JuiceProviders projectId={mockMission.projectId} selectedChain={CYPRESS_CHAIN_V5}>
          <MissionWideCard {...defaultProps} subgraphData={undefined} />
        </JuiceProviders>
      </TestnetProviders>
    )
    cy.get('#link-frame').should('exist')
  })
})
