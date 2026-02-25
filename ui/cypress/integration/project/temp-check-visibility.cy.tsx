import TestnetProviders from '@/cypress/mock/TestnetProviders'
import React from 'react'

const PROJECT_PENDING = 1
const PROJECT_ACTIVE = 2

// Mock TempCheck component that mirrors the senator-gate and rendering logic
// from TempCheck.tsx and the page-level condition in [tokenId].tsx
const MockTempCheck = ({ isSenator }: { isSenator: boolean }) => {
  if (!isSenator) return null

  return (
    <div data-testid="temp-check-ui" className="flex items-center gap-2">
      <span className="text-xs text-gray-400 mr-1">Temp Check:</span>
      <button
        data-testid="temp-check-approve"
        className="rounded-full bg-gradient-to-r from-green-600 to-green-700 px-3 py-1.5 text-xs font-medium"
      >
        👍 0
      </button>
      <button
        data-testid="temp-check-reject"
        className="rounded-full bg-gradient-to-r from-red-600 to-red-700 px-3 py-1.5 text-xs font-medium"
      >
        👎 0
      </button>
    </div>
  )
}

// Mock project detail section that mirrors the conditional rendering in [tokenId].tsx
const MockProjectProposalSection = ({
  project,
  proposalStatus,
  isSenator = false,
}: {
  project: { MDP: number; active: number; name: string }
  proposalStatus: string
  isSenator?: boolean
}) => {
  return (
    <div data-testid="proposal-section">
      <div data-testid="proposal-header" className="flex gap-2 items-center">
        <h2>{project.name}</h2>
        <div data-testid="proposal-actions" className="flex gap-2 items-center">
          {project.active == PROJECT_PENDING &&
            proposalStatus === 'Temperature Check' && (
            <div data-testid="temp-check-wrapper" className="flex items-center gap-2">
              <MockTempCheck isSenator={isSenator} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

describe('TempCheck Visibility', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  describe('Project Status Gating', () => {
    it('should show temp check UI on projects in Temperature Check status for senators', () => {
      const pendingProject = { MDP: 1, active: PROJECT_PENDING, name: 'Pending Project' }

      cy.mount(
        <TestnetProviders>
          <MockProjectProposalSection
            project={pendingProject}
            proposalStatus="Temperature Check"
            isSenator={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="temp-check-wrapper"]').should('exist')
      cy.get('[data-testid="temp-check-ui"]').should('exist')
      cy.get('[data-testid="temp-check-approve"]').should('exist')
      cy.get('[data-testid="temp-check-reject"]').should('exist')
    })

    it('should NOT show temp check UI on active projects', () => {
      const activeProject = { MDP: 2, active: PROJECT_ACTIVE, name: 'Active Project' }

      cy.mount(
        <TestnetProviders>
          <MockProjectProposalSection
            project={activeProject}
            proposalStatus="Approved"
            isSenator={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="temp-check-wrapper"]').should('not.exist')
      cy.get('[data-testid="temp-check-ui"]').should('not.exist')
    })

    it('should NOT show temp check UI on projects in Voting status', () => {
      const pendingProject = { MDP: 3, active: PROJECT_PENDING, name: 'Voting Project' }

      cy.mount(
        <TestnetProviders>
          <MockProjectProposalSection
            project={pendingProject}
            proposalStatus="Voting"
            isSenator={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="temp-check-wrapper"]').should('not.exist')
      cy.get('[data-testid="temp-check-ui"]').should('not.exist')
    })

    it('should NOT show temp check UI on cancelled projects', () => {
      const cancelledProject = { MDP: 4, active: PROJECT_PENDING, name: 'Cancelled Project' }

      cy.mount(
        <TestnetProviders>
          <MockProjectProposalSection
            project={cancelledProject}
            proposalStatus="Cancelled"
            isSenator={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="temp-check-wrapper"]').should('not.exist')
      cy.get('[data-testid="temp-check-ui"]').should('not.exist')
    })
  })

  describe('Senator-Only Gating', () => {
    it('should NOT show temp check UI to non-senators even on temp check projects', () => {
      const pendingProject = { MDP: 5, active: PROJECT_PENDING, name: 'Temp Check Project' }

      cy.mount(
        <TestnetProviders>
          <MockProjectProposalSection
            project={pendingProject}
            proposalStatus="Temperature Check"
            isSenator={false}
          />
        </TestnetProviders>
      )

      // The wrapper exists (page-level condition passes) but the TempCheck content does not render
      cy.get('[data-testid="temp-check-wrapper"]').should('exist')
      cy.get('[data-testid="temp-check-ui"]').should('not.exist')
    })

    it('should show temp check UI to senators on temp check projects', () => {
      const pendingProject = { MDP: 6, active: PROJECT_PENDING, name: 'Senator Visible Project' }

      cy.mount(
        <TestnetProviders>
          <MockProjectProposalSection
            project={pendingProject}
            proposalStatus="Temperature Check"
            isSenator={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="temp-check-ui"]').should('exist')
      cy.contains('Temp Check:').should('exist')
    })
  })

  describe('Combined Conditions', () => {
    it('should NOT show temp check UI to non-senators on active projects', () => {
      const activeProject = { MDP: 7, active: PROJECT_ACTIVE, name: 'Active Non-Senator' }

      cy.mount(
        <TestnetProviders>
          <MockProjectProposalSection
            project={activeProject}
            proposalStatus="Approved"
            isSenator={false}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="temp-check-wrapper"]').should('not.exist')
      cy.get('[data-testid="temp-check-ui"]').should('not.exist')
    })

    it('should NOT show temp check UI to senators on active projects', () => {
      const activeProject = { MDP: 8, active: PROJECT_ACTIVE, name: 'Active Senator View' }

      cy.mount(
        <TestnetProviders>
          <MockProjectProposalSection
            project={activeProject}
            proposalStatus="Approved"
            isSenator={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="temp-check-wrapper"]').should('not.exist')
      cy.get('[data-testid="temp-check-ui"]').should('not.exist')
    })
  })
})
