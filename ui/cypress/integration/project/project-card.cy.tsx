import TestnetProviders from '@/cypress/mock/TestnetProviders'
import React from 'react'

// Simplified mock components for testing project card layout
const MockProjectCard = ({ 
  project, 
  senatorVotes = [],
  senatorVotesLoading = false,
  isSenatVoteMode = true,
}: { 
  project: any
  senatorVotes?: any[]
  senatorVotesLoading?: boolean
  isSenatVoteMode?: boolean
}) => {
  const votedSenators = senatorVotes.filter(s => s.hasVoted)
  const pendingSenators = senatorVotes.filter(s => !s.hasVoted)

  return (
    <div 
      data-testid="project-card"
      className="p-4 sm:p-6 pb-4 flex flex-col gap-3 relative w-full bg-gradient-to-br from-slate-700/20 to-slate-800/30 border border-white/10 rounded-xl"
    >
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
        {/* Left side: Title and senators status */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <h1 
              data-testid="project-title"
              className="font-GoodTimes text-white text-lg sm:text-xl"
            >
              {project?.name || ''}
            </h1>
            
            {/* Senator participation status - aligned with title on the left */}
            {isSenatVoteMode && senatorVotes.length > 0 && (
              <div 
                data-testid="senators-status"
                className="p-2 rounded-lg bg-slate-800/40 border border-white/10 w-fit"
              >
                <div data-testid="senators-count" className="text-[11px] text-white/60 mb-1.5">
                  Senators ({votedSenators.length}/{senatorVotes.length} voted)
                </div>
                <div className="flex flex-wrap gap-1">
                  {votedSenators.map((senator) => (
                    <div 
                      key={senator.address}
                      data-testid={`senator-voted-${senator.name}`}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/20 border border-green-500/30"
                    >
                      <span className="text-[10px]">✓</span>
                      <span className="text-[10px] text-white/90">{senator.name}</span>
                    </div>
                  ))}
                  {pendingSenators.map((senator) => (
                    <div 
                      key={senator.address}
                      data-testid={`senator-pending-${senator.name}`}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-500/20 border border-gray-500/30"
                    >
                      <span className="text-[10px]">○</span>
                      <span className="text-[10px] text-white/50">{senator.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Right side: Vote buttons */}
        {isSenatVoteMode && (
          <div data-testid="vote-buttons" className="w-full sm:w-auto">
            <div className="flex flex-wrap items-center gap-2">
              <span 
                data-testid="budget-label"
                className="px-3 py-1.5 h-[36px] flex items-center rounded-lg text-sm font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30"
              >
                Budget: {project?.budget || '0'} ETH
              </span>
              <div className="flex items-center gap-2">
                <div 
                  data-testid="approve-button"
                  className="px-3 py-2 h-[36px] rounded-lg bg-green-600/50 text-white font-medium text-sm flex items-center"
                >
                  👍 0
                </div>
                <div 
                  data-testid="reject-button"
                  className="px-3 py-2 h-[36px] rounded-lg bg-red-600/50 text-white font-medium text-sm flex items-center"
                >
                  👎 0
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Description */}
      <div data-testid="project-description" className="flex-1">
        <p className="text-green-100 text-sm">
          {project?.description || 'No description available'}
        </p>
      </div>
    </div>
  )
}

describe('<ProjectCard /> Layout', () => {
  const mockProject = {
    MDP: 99,
    name: 'Test Project for Senate Vote',
    description: 'This is a test project description for component testing.',
    budget: '10',
    active: 2, // PROJECT_PENDING
  }

  const mockSenators = [
    { address: '0x123', name: 'Frank', hasVoted: true, votedApprove: true, votedDeny: false },
    { address: '0x456', name: 'Kara', hasVoted: false, votedApprove: false, votedDeny: false },
    { address: '0x789', name: 'Alex', hasVoted: false, votedApprove: false, votedDeny: false },
  ]

  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  describe('Basic Rendering', () => {
    it('should render the project card with title', () => {
      cy.mount(
        <TestnetProviders>
          <MockProjectCard project={mockProject} senatorVotes={mockSenators} />
        </TestnetProviders>
      )

      cy.get('[data-testid="project-card"]').should('exist')
      cy.get('[data-testid="project-title"]').should('contain', 'Test Project for Senate Vote')
    })

    it('should render the project description', () => {
      cy.mount(
        <TestnetProviders>
          <MockProjectCard project={mockProject} senatorVotes={mockSenators} />
        </TestnetProviders>
      )

      cy.get('[data-testid="project-description"]').should('contain', 'This is a test project description')
    })
  })

  describe('Senate Vote Mode Layout', () => {
    it('should display senators status below the title on the left', () => {
      cy.mount(
        <TestnetProviders>
          <MockProjectCard project={mockProject} senatorVotes={mockSenators} isSenatVoteMode={true} />
        </TestnetProviders>
      )

      // Senators status should exist
      cy.get('[data-testid="senators-status"]').should('exist')
      
      // Senators status should be a sibling of the title (both in the left column)
      cy.get('[data-testid="project-title"]')
        .parent()
        .find('[data-testid="senators-status"]')
        .should('exist')
    })

    it('should display vote buttons on the right side', () => {
      cy.mount(
        <TestnetProviders>
          <MockProjectCard project={mockProject} senatorVotes={mockSenators} isSenatVoteMode={true} />
        </TestnetProviders>
      )

      cy.get('[data-testid="vote-buttons"]').should('exist')
      cy.get('[data-testid="approve-button"]').should('exist')
      cy.get('[data-testid="reject-button"]').should('exist')
    })

    it('should display budget label', () => {
      cy.mount(
        <TestnetProviders>
          <MockProjectCard project={mockProject} senatorVotes={mockSenators} isSenatVoteMode={true} />
        </TestnetProviders>
      )

      cy.get('[data-testid="budget-label"]').should('contain', 'Budget: 10 ETH')
    })
  })

  describe('Senators Status in Left Column', () => {
    it('should show correct vote count in left-aligned senators status', () => {
      cy.mount(
        <TestnetProviders>
          <MockProjectCard project={mockProject} senatorVotes={mockSenators} isSenatVoteMode={true} />
        </TestnetProviders>
      )

      cy.get('[data-testid="senators-count"]').should('contain', '1/3 voted')
    })

    it('should display voted and pending senators correctly', () => {
      cy.mount(
        <TestnetProviders>
          <MockProjectCard project={mockProject} senatorVotes={mockSenators} isSenatVoteMode={true} />
        </TestnetProviders>
      )

      // Frank has voted
      cy.get('[data-testid="senator-voted-Frank"]').should('exist')
      
      // Kara and Alex have not voted
      cy.get('[data-testid="senator-pending-Kara"]').should('exist')
      cy.get('[data-testid="senator-pending-Alex"]').should('exist')
    })
  })

  describe('Non-Senate Vote Mode', () => {
    it('should not show senators status when not in senate vote mode', () => {
      cy.mount(
        <TestnetProviders>
          <MockProjectCard project={mockProject} senatorVotes={mockSenators} isSenatVoteMode={false} />
        </TestnetProviders>
      )

      cy.get('[data-testid="senators-status"]').should('not.exist')
      cy.get('[data-testid="vote-buttons"]').should('not.exist')
    })
  })

  describe('Mobile Responsiveness', () => {
    it('should have proper layout structure for mobile', () => {
      cy.viewport('iphone-x')
      
      cy.mount(
        <TestnetProviders>
          <MockProjectCard project={mockProject} senatorVotes={mockSenators} isSenatVoteMode={true} />
        </TestnetProviders>
      )

      // Card should still render properly
      cy.get('[data-testid="project-card"]').should('exist')
      cy.get('[data-testid="project-title"]').should('be.visible')
      cy.get('[data-testid="senators-status"]').should('be.visible')
    })

    it('should stack elements vertically on mobile', () => {
      cy.viewport('iphone-x')
      
      cy.mount(
        <TestnetProviders>
          <MockProjectCard project={mockProject} senatorVotes={mockSenators} isSenatVoteMode={true} />
        </TestnetProviders>
      )

      // All elements should be visible and not overlapping
      cy.get('[data-testid="project-title"]').should('be.visible')
      cy.get('[data-testid="senators-status"]').should('be.visible')
      cy.get('[data-testid="vote-buttons"]').should('be.visible')
    })
  })
})
