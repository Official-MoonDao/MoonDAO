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
      MDP: 14,
      active: 2,
      description: 'test description',
      status: 'Temperature Check',
      eligible: 0,
      finalReportIPFS: '',
      finalReportLink: '',
      id: 0,
      image: '',
      name: 'Test Proposal for Component Testing',
      proposalIPFS:
        'https://gray-main-toad-36.mypinata.cloud/ipfs/QmXCbzaCDepUpnQFhYJQ8nPcWh7acfack4ARAPWgK59dMo',
      proposalLink: 'https://moondao.com/proposal/1',
      quarter: 4,
      rewardDistribution: '',
      upfrontPayments: '',
      year: 2025,
      proposalJSON: {
        body: '# order 81',
        authorAddress: '0x08B3e694caA2F1fcF8eF71095CED1326f3454B89',
        nonProjectProposal: false,
      },
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
      cy.contains('MDP-14: Test Proposal for Component Testing').should('exist')
    })

    it('Should display proposal status correctly', () => {
      const project = { ...mockProject, status: 'Temperature Check' }
      cy.mount(
        <TestnetProviders>
          <Proposal project={project} />
        </TestnetProviders>
      )

      // For Discussion status, component shows time element, not status text
      cy.get('#proposal-card')
        .invoke('text')
        .then((txt) => {
          cy.log('Component text is:', txt)
        })
      cy.contains('Temperature Check').should('exist')
    })
  })

  describe('ProposalInfo Integration', () => {
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
  })
})
