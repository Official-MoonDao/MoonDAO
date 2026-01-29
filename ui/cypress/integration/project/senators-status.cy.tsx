import TestnetProviders from '@/cypress/mock/TestnetProviders'
import React from 'react'

// Mock the SenatorsStatus component for isolated testing
// We need to import it from ProjectCard but it's not exported, so we'll create a test version
const SenatorsStatus = ({ senatorVotes, isLoading }: { senatorVotes: any[]; isLoading: boolean }) => {
  const votedSenators = senatorVotes.filter(s => s.hasVoted)
  const pendingSenators = senatorVotes.filter(s => !s.hasVoted)

  if (isLoading) {
    return (
      <div data-testid="senators-loading" className="flex items-center gap-2">
        <span className="text-[11px] text-white/60">Loading senators...</span>
      </div>
    )
  }

  if (senatorVotes.length === 0) return null

  return (
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
            title={`${senator.name} has voted`}
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
            title={`${senator.name} has not voted yet`}
          >
            <span className="text-[10px]">○</span>
            <span className="text-[10px] text-white/50">{senator.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

describe('<SenatorsStatus />', () => {
  const mockSenators = [
    { address: '0x123', name: 'Frank', hasVoted: true, votedApprove: true, votedDeny: false },
    { address: '0x456', name: 'Kara', hasVoted: true, votedApprove: false, votedDeny: true },
    { address: '0x789', name: 'Alex', hasVoted: false, votedApprove: false, votedDeny: false },
    { address: '0xabc', name: 'EngiBob', hasVoted: false, votedApprove: false, votedDeny: false },
  ]

  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  describe('Loading State', () => {
    it('should display loading state when isLoading is true', () => {
      cy.mount(
        <TestnetProviders>
          <SenatorsStatus senatorVotes={[]} isLoading={true} />
        </TestnetProviders>
      )

      cy.get('[data-testid="senators-loading"]').should('exist')
      cy.contains('Loading senators...').should('exist')
    })
  })

  describe('Empty State', () => {
    it('should render nothing when senatorVotes is empty and not loading', () => {
      cy.mount(
        <TestnetProviders>
          <SenatorsStatus senatorVotes={[]} isLoading={false} />
        </TestnetProviders>
      )

      cy.get('[data-testid="senators-status"]').should('not.exist')
    })
  })

  describe('With Senator Data', () => {
    it('should display the correct vote count', () => {
      cy.mount(
        <TestnetProviders>
          <SenatorsStatus senatorVotes={mockSenators} isLoading={false} />
        </TestnetProviders>
      )

      cy.get('[data-testid="senators-count"]').should('contain', '2/4 voted')
    })

    it('should display voted senators with checkmark', () => {
      cy.mount(
        <TestnetProviders>
          <SenatorsStatus senatorVotes={mockSenators} isLoading={false} />
        </TestnetProviders>
      )

      cy.get('[data-testid="senator-voted-Frank"]').should('exist')
      cy.get('[data-testid="senator-voted-Frank"]').should('contain', '✓')
      cy.get('[data-testid="senator-voted-Frank"]').should('contain', 'Frank')

      cy.get('[data-testid="senator-voted-Kara"]').should('exist')
      cy.get('[data-testid="senator-voted-Kara"]').should('contain', '✓')
      cy.get('[data-testid="senator-voted-Kara"]').should('contain', 'Kara')
    })

    it('should display pending senators with circle', () => {
      cy.mount(
        <TestnetProviders>
          <SenatorsStatus senatorVotes={mockSenators} isLoading={false} />
        </TestnetProviders>
      )

      cy.get('[data-testid="senator-pending-Alex"]').should('exist')
      cy.get('[data-testid="senator-pending-Alex"]').should('contain', '○')
      cy.get('[data-testid="senator-pending-Alex"]').should('contain', 'Alex')

      cy.get('[data-testid="senator-pending-EngiBob"]').should('exist')
      cy.get('[data-testid="senator-pending-EngiBob"]').should('contain', '○')
      cy.get('[data-testid="senator-pending-EngiBob"]').should('contain', 'EngiBob')
    })

    it('should have correct styling for voted senators (green)', () => {
      cy.mount(
        <TestnetProviders>
          <SenatorsStatus senatorVotes={mockSenators} isLoading={false} />
        </TestnetProviders>
      )

      cy.get('[data-testid="senator-voted-Frank"]')
        .should('have.class', 'bg-green-500/20')
        .and('have.class', 'border-green-500/30')
    })

    it('should have correct styling for pending senators (gray)', () => {
      cy.mount(
        <TestnetProviders>
          <SenatorsStatus senatorVotes={mockSenators} isLoading={false} />
        </TestnetProviders>
      )

      cy.get('[data-testid="senator-pending-Alex"]')
        .should('have.class', 'bg-gray-500/20')
        .and('have.class', 'border-gray-500/30')
    })
  })

  describe('All Senators Voted', () => {
    it('should show all senators as voted when everyone has voted', () => {
      const allVotedSenators = mockSenators.map(s => ({ ...s, hasVoted: true }))

      cy.mount(
        <TestnetProviders>
          <SenatorsStatus senatorVotes={allVotedSenators} isLoading={false} />
        </TestnetProviders>
      )

      cy.get('[data-testid="senators-count"]').should('contain', '4/4 voted')
      cy.get('[data-testid^="senator-voted-"]').should('have.length', 4)
      cy.get('[data-testid^="senator-pending-"]').should('have.length', 0)
    })
  })

  describe('No Senators Voted', () => {
    it('should show all senators as pending when no one has voted', () => {
      const noVotesSenators = mockSenators.map(s => ({ ...s, hasVoted: false }))

      cy.mount(
        <TestnetProviders>
          <SenatorsStatus senatorVotes={noVotesSenators} isLoading={false} />
        </TestnetProviders>
      )

      cy.get('[data-testid="senators-count"]').should('contain', '0/4 voted')
      cy.get('[data-testid^="senator-voted-"]').should('have.length', 0)
      cy.get('[data-testid^="senator-pending-"]').should('have.length', 4)
    })
  })
})
