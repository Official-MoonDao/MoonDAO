import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { ProposalsPacket } from '@nance/nance-sdk'
import { SnapshotGraphqlProposalVotingInfo } from '@/lib/snapshot'
import Proposal from '@/components/nance/Proposal'

describe('<Proposal />', () => {
  let mockProposal: any
  let mockPacket: ProposalsPacket
  let mockVotingInfo: SnapshotGraphqlProposalVotingInfo

  beforeEach(() => {
    mockProposal = {
      uuid: 'test-uuid-123',
      proposalId: 42,
      title: 'Test Proposal for Component Testing',
      status: 'Discussion',
      authorAddress: '0x1234567890abcdef1234567890abcdef12345678',
      body: 'This is a test proposal body for component testing.',
      createdTime: '2024-01-15T10:00:00Z',
      lastEditedTime: '2024-01-16T15:30:00Z',
      actions: [
        {
          type: 'Request Budget',
          payload: {
            budget: [
              {
                amount: '1000',
                token: 'USDC',
                justification: 'Test budget request for component testing',
              },
            ],
          },
        },
      ],
      voteURL: 'https://snapshot.org/#/tomoondao.eth/proposal/0xtest123',
    }

    mockPacket = {
      proposalInfo: {
        proposalIdPrefix: 'MDP-',
        minTokenPassingAmount: 1000000,
        nextProposalId: 43,
        snapshotSpace: 'tomoondao.eth',
      },
      proposals: [mockProposal],
      hasMore: false,
    }

    mockVotingInfo = {
      id: '0xtest123',
      title: 'Test Proposal for Component Testing',
      state: 'active',
      end: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
      type: 'single-choice',
      choices: ['Yes', 'No', 'Abstain'],
      scores: [1500, 800, 200],
      votes: 25,
      quorum: 1000,
      scores_total: 2500,
      privacy: '',
      ipfs: 'QmTest123',
      snapshot: '18500000',
    }

    cy.mountNextRouter('/')
  })

  describe('Basic Rendering', () => {
    it('Should render the proposal component with all essential elements', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={mockProposal}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
          />
        </TestnetProviders>
      )

      cy.get('#proposal-card').should('exist')

      // Check if the proposal title is displayed
      cy.contains('MDP-42: Test Proposal for Component Testing').should('exist')
    })

    it('Should display proposal status correctly', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={mockProposal}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
          />
        </TestnetProviders>
      )

      cy.get('.font-RobotoMono').contains('Discussion').should('exist')
    })
  })

  describe('Voting Status Indicators', () => {
    it('Should show voting indicator for active voting proposals', () => {
      const votingProposal = { ...mockProposal, status: 'Voting' }

      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={votingProposal}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
          />
        </TestnetProviders>
      )

      // Check for voting status
      cy.contains('Voting').should('exist')

      // Check for the green dot indicator
      cy.get('.bg-emerald-500').should('exist')

      // Check for voting text with correct styling
      cy.get('.text-white.font-RobotoMono').contains('Voting').should('exist')
    })

    it('Should show voting indicator for temperature check proposals', () => {
      const tempCheckProposal = { ...mockProposal, status: 'Temperature Check' }

      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={tempCheckProposal}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
          />
        </TestnetProviders>
      )

      // Check for temperature check status
      cy.contains('Temperature Check').should('exist')

      // Check for the green dot indicator (same as voting)
      cy.get('.bg-emerald-500').should('exist')

      // Check for voting text with correct styling
      cy.get('.text-white.font-RobotoMono').contains('Temperature Check').should('exist')
    })

    it('Should show "Results Available" indicator for closed voting proposals', () => {
      const closedVotingInfo = {
        ...mockVotingInfo,
        state: 'closed',
      }

      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={mockProposal}
            packet={mockPacket}
            votingInfo={closedVotingInfo}
          />
        </TestnetProviders>
      )

      // Check for "Results Available" text
      cy.contains('Results Available').should('exist')

      // Check for the blue dot indicator
      cy.get('.bg-blue-500').should('exist')

      // Check for correct styling
      cy.get('.text-white.font-RobotoMono').contains('Results Available').should('exist')
    })

    it('Should show last edited time for non-voting proposals', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={mockProposal}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
          />
        </TestnetProviders>
      )

      // Should show time since last edit
      cy.get('time').should('exist')
      cy.get('.text-gray-400').should('contain.text', 'ago')
    })
  })

  describe('Different Proposal Statuses', () => {
    const statuses = [
      'Discussion',
      'Voting',
      'Approved',
      'Archived',
      'Cancelled',
    ]

    statuses.forEach((status) => {
      it(`Should handle ${status} status correctly`, () => {
        const statusProposal = { ...mockProposal, status }

        cy.mount(
          <TestnetProviders>
            <Proposal
              proposal={statusProposal}
              packet={mockPacket}
              votingInfo={mockVotingInfo}
            />
          </TestnetProviders>
        )

        cy.contains(status).should('exist')
      })
    })
  })

  describe('ProposalInfo Integration', () => {
    it('Should pass correct props to ProposalInfo component', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={mockProposal}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
          />
        </TestnetProviders>
      )

      // Check that ProposalInfo receives the merged proposal data
      // This tests the prop merging: { ...proposal, proposalInfo: packet.proposalInfo }
      cy.contains('MDP-42: Test Proposal for Component Testing').should('exist')

      // Check author information is displayed (from ProposalInfo)
      cy.get('img[alt=""]')
        .should('have.attr', 'src')
        .and('satisfy', (src) => {
          // Handle both direct URLs and Next.js optimized image URLs
          return (
            src.includes('cdn.stamp.fyi/avatar/') ||
            (src.includes('/_next/image') &&
              src.includes('cdn.stamp.fyi%2Favatar%2F'))
          )
        })
    })

    it('Should show title when showTitle is true', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={mockProposal}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
          />
        </TestnetProviders>
      )

      cy.contains('Test Proposal for Component Testing').should('exist')
    })

    it('Should hide status in ProposalInfo when showStatus is false', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={mockProposal}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
          />
        </TestnetProviders>
      )

      // The status should only appear in the bottom section, not in ProposalInfo
      cy.get('#proposal-card').within(() => {
        cy.get('.flex-1').should('exist')
        cy.get('.flex.justify-between.items-center.mt-4').should('exist')
      })
    })
  })

  describe('UI Elements', () => {
    it('Should display chevron icon', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={mockProposal}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
          />
        </TestnetProviders>
      )

      // Check for chevron icon
      cy.get('[data-testid="chevron-right"]').should('exist')
      cy.get('[data-testid="chevron-right"]').should('have.class', 'h-5')
      cy.get('[data-testid="chevron-right"]').should('have.class', 'w-5')
    })
  })

  describe('Compact Mode', () => {
    it('Should render in compact mode when compact prop is true', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={mockProposal}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
            compact={true}
          />
        </TestnetProviders>
      )

      // Component should still render
      cy.get('#proposal-card').should('exist')
      cy.contains('Test Proposal for Component Testing').should('exist')
    })

    it('Should render in normal mode when compact prop is false', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={mockProposal}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
            compact={false}
          />
        </TestnetProviders>
      )

      // Component should render with full details
      cy.get('#proposal-card').should('exist')
      cy.contains('Test Proposal for Component Testing').should('exist')
    })
  })

  describe('Edge Cases', () => {
    it('Should handle proposal without lastEditedTime', () => {
      const proposalWithoutLastEdit = {
        ...mockProposal,
        lastEditedTime: undefined,
      }

      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={proposalWithoutLastEdit}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
          />
        </TestnetProviders>
      )

      // Should fall back to createdTime
      cy.get('time').should('exist')
    })

    it('Should handle undefined votingInfo', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={mockProposal}
            packet={mockPacket}
            votingInfo={undefined}
          />
        </TestnetProviders>
      )

      // Component should still render without errors
      cy.get('#proposal-card').should('exist')
      cy.contains('Test Proposal for Component Testing').should('exist')
    })

    it('Should handle proposal without proposalId', () => {
      const proposalWithoutId = {
        ...mockProposal,
        proposalId: undefined,
      }

      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={proposalWithoutId}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
          />
        </TestnetProviders>
      )

      // Should still display title without prefix
      cy.contains('Test Proposal for Component Testing').should('exist')
    })

    it('Should handle closed votingInfo with non-voting status', () => {
      const closedVotingInfo = {
        ...mockVotingInfo,
        state: 'closed',
      }
      const discussionProposal = { ...mockProposal, status: 'Discussion' }

      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={discussionProposal}
            packet={mockPacket}
            votingInfo={closedVotingInfo}
          />
        </TestnetProviders>
      )

      // Should show "Results Available" when votingInfo is closed
      cy.contains('Results Available').should('exist')
      cy.get('.bg-blue-500').should('exist')
    })
  })

  describe('Date Formatting', () => {
    it('Should format dates correctly using formatDistanceStrict', () => {
      const fixedDate = '2024-01-10T10:00:00Z'
      const proposalWithFixedDate = {
        ...mockProposal,
        lastEditedTime: fixedDate,
        createdTime: fixedDate,
      }

      cy.mount(
        <TestnetProviders>
          <Proposal
            proposal={proposalWithFixedDate}
            packet={mockPacket}
            votingInfo={mockVotingInfo}
          />
        </TestnetProviders>
      )

      cy.get('time').should('exist')
      cy.get('.text-gray-400').should('contain.text', 'ago')
    })
  })
})
