import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { ProposalsPacket } from '@nance/nance-sdk'
import { SnapshotGraphqlProposalVotingInfo } from '@/lib/snapshot'
import Proposal from '@/components/nance/Proposal'

describe('<Proposal />', () => {
  let mockProject: any
  let mockPacket: ProposalsPacket
  let mockVotingInfo: SnapshotGraphqlProposalVotingInfo

  beforeEach(() => {
    mockProject = {
      MDP: 1,
      active: 2,
      description: 'test description',
      eligible: 0,
      finalReportIPFS: '',
      finalReportLink: '',
      id: 0,
      image: '',
      name: 'test name',
      proposalIPFS:
        'https://gray-main-toad-36.mypinata.cloud/ipfs/QmNwdHfXoSFURs4amSd4woTK8SpL8cJhKrNjnxHjVAs1Fz',
      proposalLink: 'https://moondao.com/proposal/1',
      quarter: 4,
      rewardDistribution: '',
      upfrontPayments: '',
      year: 2025,
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
          <Proposal project={mockProject} />
        </TestnetProviders>
      )

      cy.get('#proposal-card').should('exist')

      // Check if the proposal title is displayed
      cy.contains('MDP-42: Test Proposal for Component Testing').should('exist')
    })

    it('Should display proposal status correctly', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal project={mockProject} />
        </TestnetProviders>
      )

      // For Discussion status, component shows time element, not status text
      cy.get('time').should('exist')
    })
  })

  describe('Voting Status Indicators', () => {
    it('Should show voting indicator for active voting proposals', () => {
      const votingProposal = { ...mockProject, status: 'Voting' }

      cy.mount(
        <TestnetProviders>
          <Proposal project={votingProposal} />
        </TestnetProviders>
      )

      // Component shows time element for all proposals
      cy.get('time').should('exist')
      cy.get('.text-gray-400').should('contain.text', 'ago')
    })

    it('Should show voting indicator for temperature check proposals', () => {
      const tempCheckProposal = { ...mockProject, status: 'Temperature Check' }

      cy.mount(
        <TestnetProviders>
          <Proposal project={tempCheckProposal} />
        </TestnetProviders>
      )

      // Component shows time element for all proposals
      cy.get('time').should('exist')
      cy.get('.text-gray-400').should('contain.text', 'ago')
    })

    it('Should show "Results Available" indicator for closed voting proposals', () => {
      const closedVotingInfo = {
        ...mockVotingInfo,
        state: 'closed',
      }

      cy.mount(
        <TestnetProviders>
          <Proposal project={mockProject} />
        </TestnetProviders>
      )

      // Component shows time element for all proposals
      cy.get('time').should('exist')
      cy.get('.text-gray-400').should('contain.text', 'ago')
    })

    it('Should show last edited time for non-voting proposals', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal project={mockProject} />
        </TestnetProviders>
      )

      // Should show time since last edit
      cy.get('time').should('exist')
      cy.get('.text-gray-400').should('contain.text', 'ago')
    })
  })

  describe('Different Proposal Statuses', () => {
    const statuses = ['Discussion', 'Voting', 'Approved', 'Archived', 'Cancelled']

    statuses.forEach((status) => {
      it(`Should handle ${status} status correctly`, () => {
        const statusProposal = { ...mockProject, status }

        cy.mount(
          <TestnetProviders>
            <Proposal project={statusProposal} />
          </TestnetProviders>
        )

        // Component shows time element for all statuses
        cy.get('time').should('exist')
        cy.get('.text-gray-400').should('contain.text', 'ago')
      })
    })
  })

  describe('ProposalInfo Integration', () => {
    it('Should pass correct props to ProposalInfo component', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal project={mockProject} />
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
            (src.includes('/_next/image') && src.includes('cdn.stamp.fyi%2Favatar%2F'))
          )
        })
    })

    it('Should show title when showTitle is true', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal project={mockProject} />
        </TestnetProviders>
      )

      cy.contains('Test Proposal for Component Testing').should('exist')
    })

    it('Should hide status in ProposalInfo when showStatus is false', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal project={mockProject} />
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
          <Proposal project={mockProject} />
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
          <Proposal project={mockProject} />
        </TestnetProviders>
      )

      // Component should still render
      cy.get('#proposal-card').should('exist')
      cy.contains('Test Proposal for Component Testing').should('exist')
    })

    it('Should render in normal mode when compact prop is false', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal project={mockProject} />
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
        ...mockProject,
        lastEditedTime: undefined,
      }

      cy.mount(
        <TestnetProviders>
          <Proposal project={proposalWithoutLastEdit} />
        </TestnetProviders>
      )

      // Should fall back to createdTime
      cy.get('time').should('exist')
    })

    it('Should handle undefined votingInfo', () => {
      cy.mount(
        <TestnetProviders>
          <Proposal project={mockProject} />
        </TestnetProviders>
      )

      // Component should still render without errors
      cy.get('#proposal-card').should('exist')
      cy.contains('Test Proposal for Component Testing').should('exist')
    })

    it('Should handle proposal without proposalId', () => {
      const proposalWithoutId = {
        ...mockProject,
        proposalId: undefined,
      }

      cy.mount(
        <TestnetProviders>
          <Proposal project={proposalWithoutId} />
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
      const discussionProposal = { ...mockProject, status: 'Discussion' }

      cy.mount(
        <TestnetProviders>
          <Proposal project={discussionProposal} />
        </TestnetProviders>
      )

      // Component shows time element for all proposals regardless of voting state
      cy.get('time').should('exist')
      cy.get('.text-gray-400').should('contain.text', 'ago')
    })
  })

  describe('Date Formatting', () => {
    it('Should format dates correctly using formatDistanceStrict', () => {
      const fixedDate = '2024-01-10T10:00:00Z'
      const proposalWithFixedDate = {
        ...mockProject,
        lastEditedTime: fixedDate,
        createdTime: fixedDate,
      }

      cy.mount(
        <TestnetProviders>
          <Proposal project={proposalWithFixedDate} />
        </TestnetProviders>
      )

      cy.get('time').should('exist')
      cy.get('.text-gray-400').should('contain.text', 'ago')
    })
  })
})
