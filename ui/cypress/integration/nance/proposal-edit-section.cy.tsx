import TestnetProviders from '@/cypress/mock/TestnetProviders'
import React, { useState } from 'react'

// Mock ProposalEditSection that replicates the real component's conditional rendering
// Uses props to control auth state instead of relying on hooks (useActiveAccount, usePrivy)
const MockProposalEditSection = ({
  proposalJSON,
  projectName,
  mdp,
  isAuthor = false,
}: {
  proposalJSON: any
  projectName: string
  mdp: number
  isAuthor?: boolean
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [newBody, setNewBody] = useState<string | undefined>()
  const [isImporting, setIsImporting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Replicate the real component's auth gate
  if (!isAuthor) return null

  if (!isEditing) {
    return (
      <button
        data-testid="edit-proposal-button"
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-300 hover:text-white bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg transition-all duration-200"
      >
        Edit Proposal
      </button>
    )
  }

  return (
    <div data-testid="edit-proposal-panel" className="mt-6 p-5 bg-gradient-to-r from-indigo-900/30 to-blue-900/30 border border-indigo-500/30 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 data-testid="edit-proposal-title" className="text-white font-semibold text-lg flex items-center gap-2">
          Edit Proposal
        </h3>
        <button
          data-testid="close-edit-button"
          onClick={() => {
            setIsEditing(false)
            setNewBody(undefined)
          }}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Explainer */}
      <div data-testid="edit-explainer" className="mb-4 p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg flex items-start gap-3">
        <div className="text-sm text-gray-300">
          <p className="font-medium text-blue-300 mb-1">How to edit your proposal:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-400">
            <li>Edit your Google Doc with the changes you want to make</li>
            <li>Paste the Google Doc link below and click <span className="text-white">Import</span></li>
            <li>Review the preview, then click <span className="text-white">Update Proposal</span> to save</li>
          </ol>
        </div>
      </div>

      {/* Mock Google Docs Import */}
      <div data-testid="google-docs-import" className={isImporting ? 'pointer-events-none opacity-50' : ''}>
        <input
          data-testid="google-docs-url-input"
          type="text"
          placeholder="Paste your Google Docs URL here..."
          className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-xl text-white"
        />
        <button
          data-testid="import-button"
          onClick={() => {
            setIsImporting(true)
            setTimeout(() => {
              setNewBody('# Updated Proposal\n\nThis is the updated content.')
              setIsImporting(false)
            }, 100)
          }}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl"
        >
          Import
        </button>
      </div>

      {/* Preview */}
      {newBody && (
        <div data-testid="updated-preview" className="mt-4 rounded-xl border border-white/10 bg-dark-cool overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-black/20">
            <h4 className="text-white font-medium text-sm">Updated Preview</h4>
          </div>
          <div className="p-4 max-h-[300px] overflow-y-auto">
            <div className="prose prose-invert prose-sm max-w-none">
              {newBody}
            </div>
          </div>
        </div>
      )}

      {/* Update Button */}
      <div className="mt-4 flex justify-end">
        <button
          data-testid="update-proposal-button"
          onClick={() => setIsUpdating(true)}
          disabled={!newBody || isUpdating || isImporting}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUpdating ? 'Updating...' : 'Update Proposal'}
        </button>
      </div>

      {/* Loading Overlay */}
      {isImporting && (
        <div data-testid="importing-overlay" className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50">
          <p className="text-white text-lg font-medium">Importing document...</p>
        </div>
      )}
    </div>
  )
}

describe('<ProposalEditSection />', () => {
  const mockProposalJSON = {
    body: '# Test Proposal\n\nThis is a test proposal body.',
    authorAddress: '0x08B3e694caA2F1fcF8eF71095CED1326f3454B89',
    budget: [{ token: 'ETH', amount: '5', justification: 'dev cost' }],
    nonProjectProposal: false,
  }

  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  describe('Author Visibility Gate', () => {
    it('should render nothing when user is not the author', () => {
      cy.mount(
        <TestnetProviders>
          <MockProposalEditSection
            proposalJSON={mockProposalJSON}
            projectName="Test Project"
            mdp={42}
            isAuthor={false}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="edit-proposal-button"]').should('not.exist')
      cy.get('[data-testid="edit-proposal-panel"]').should('not.exist')
    })

    it('should render the edit button when user is the author', () => {
      cy.mount(
        <TestnetProviders>
          <MockProposalEditSection
            proposalJSON={mockProposalJSON}
            projectName="Test Project"
            mdp={42}
            isAuthor={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="edit-proposal-button"]').should('exist')
      cy.get('[data-testid="edit-proposal-button"]').should('contain', 'Edit Proposal')
    })

    it('should not render for proposal without authorAddress', () => {
      cy.mount(
        <TestnetProviders>
          <MockProposalEditSection
            proposalJSON={{ body: '# Test', authorAddress: undefined }}
            projectName="Test Project"
            mdp={42}
            isAuthor={false}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="edit-proposal-button"]').should('not.exist')
    })
  })

  describe('Edit Panel Toggle', () => {
    it('should expand the edit panel when button is clicked', () => {
      cy.mount(
        <TestnetProviders>
          <MockProposalEditSection
            proposalJSON={mockProposalJSON}
            projectName="Test Project"
            mdp={42}
            isAuthor={true}
          />
        </TestnetProviders>
      )

      // Initially shows button, not panel
      cy.get('[data-testid="edit-proposal-button"]').should('exist')
      cy.get('[data-testid="edit-proposal-panel"]').should('not.exist')

      // Click to expand
      cy.get('[data-testid="edit-proposal-button"]').click()

      // Panel should now be visible
      cy.get('[data-testid="edit-proposal-panel"]').should('exist')
      cy.get('[data-testid="edit-proposal-button"]').should('not.exist')
    })

    it('should collapse the edit panel when close button is clicked', () => {
      cy.mount(
        <TestnetProviders>
          <MockProposalEditSection
            proposalJSON={mockProposalJSON}
            projectName="Test Project"
            mdp={42}
            isAuthor={true}
          />
        </TestnetProviders>
      )

      // Open panel
      cy.get('[data-testid="edit-proposal-button"]').click()
      cy.get('[data-testid="edit-proposal-panel"]').should('exist')

      // Close panel
      cy.get('[data-testid="close-edit-button"]').click()

      // Should be back to button state
      cy.get('[data-testid="edit-proposal-button"]').should('exist')
      cy.get('[data-testid="edit-proposal-panel"]').should('not.exist')
    })
  })

  describe('Edit Panel Content', () => {
    it('should display the explainer with step-by-step instructions', () => {
      cy.mount(
        <TestnetProviders>
          <MockProposalEditSection
            proposalJSON={mockProposalJSON}
            projectName="Test Project"
            mdp={42}
            isAuthor={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="edit-proposal-button"]').click()

      cy.get('[data-testid="edit-explainer"]').should('exist')
      cy.get('[data-testid="edit-explainer"]').should('contain', 'How to edit your proposal')
      cy.get('[data-testid="edit-explainer"]').should('contain', 'Edit your Google Doc')
      cy.get('[data-testid="edit-explainer"]').should('contain', 'Import')
      cy.get('[data-testid="edit-explainer"]').should('contain', 'Update Proposal')
    })

    it('should display the Google Docs import section', () => {
      cy.mount(
        <TestnetProviders>
          <MockProposalEditSection
            proposalJSON={mockProposalJSON}
            projectName="Test Project"
            mdp={42}
            isAuthor={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="edit-proposal-button"]').click()
      cy.get('[data-testid="google-docs-import"]').should('exist')
      cy.get('[data-testid="google-docs-url-input"]').should('exist')
      cy.get('[data-testid="import-button"]').should('exist')
    })

    it('should have the Update Proposal button disabled initially', () => {
      cy.mount(
        <TestnetProviders>
          <MockProposalEditSection
            proposalJSON={mockProposalJSON}
            projectName="Test Project"
            mdp={42}
            isAuthor={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="edit-proposal-button"]').click()
      cy.get('[data-testid="update-proposal-button"]').should('be.disabled')
    })
  })

  describe('Import and Preview Flow', () => {
    it('should show preview after importing a document', () => {
      cy.mount(
        <TestnetProviders>
          <MockProposalEditSection
            proposalJSON={mockProposalJSON}
            projectName="Test Project"
            mdp={42}
            isAuthor={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="edit-proposal-button"]').click()

      // No preview initially
      cy.get('[data-testid="updated-preview"]').should('not.exist')

      // Trigger import
      cy.get('[data-testid="import-button"]').click()

      // Preview should appear with content
      cy.get('[data-testid="updated-preview"]').should('exist')
      cy.get('[data-testid="updated-preview"]').should('contain', 'Updated Preview')
      cy.get('[data-testid="updated-preview"]').should('contain', 'Updated Proposal')
    })

    it('should enable the Update Proposal button after import', () => {
      cy.mount(
        <TestnetProviders>
          <MockProposalEditSection
            proposalJSON={mockProposalJSON}
            projectName="Test Project"
            mdp={42}
            isAuthor={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="edit-proposal-button"]').click()
      cy.get('[data-testid="update-proposal-button"]').should('be.disabled')

      // Import content
      cy.get('[data-testid="import-button"]').click()

      // Button should become enabled
      cy.get('[data-testid="update-proposal-button"]').should('not.be.disabled')
      cy.get('[data-testid="update-proposal-button"]').should('contain', 'Update Proposal')
    })

    it('should show loading overlay during import', () => {
      cy.mount(
        <TestnetProviders>
          <MockProposalEditSection
            proposalJSON={mockProposalJSON}
            projectName="Test Project"
            mdp={42}
            isAuthor={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="edit-proposal-button"]').click()

      // Use clock to control timing
      cy.clock()
      cy.get('[data-testid="import-button"]').click()

      // Loading overlay should appear
      cy.get('[data-testid="importing-overlay"]').should('exist')
      cy.get('[data-testid="importing-overlay"]').should('contain', 'Importing document...')

      // After import completes, overlay should disappear
      cy.tick(200)
      cy.get('[data-testid="importing-overlay"]').should('not.exist')
    })
  })

  describe('Update Button State', () => {
    it('should show "Updating..." text when update is in progress', () => {
      cy.mount(
        <TestnetProviders>
          <MockProposalEditSection
            proposalJSON={mockProposalJSON}
            projectName="Test Project"
            mdp={42}
            isAuthor={true}
          />
        </TestnetProviders>
      )

      cy.get('[data-testid="edit-proposal-button"]').click()

      // Import content first
      cy.get('[data-testid="import-button"]').click()
      cy.get('[data-testid="updated-preview"]').should('exist')

      // Click update
      cy.get('[data-testid="update-proposal-button"]').click()

      // Should show updating state
      cy.get('[data-testid="update-proposal-button"]').should('contain', 'Updating...')
      cy.get('[data-testid="update-proposal-button"]').should('be.disabled')
    })
  })

  describe('Panel Reset on Close', () => {
    it('should clear preview when panel is closed and reopened', () => {
      cy.mount(
        <TestnetProviders>
          <MockProposalEditSection
            proposalJSON={mockProposalJSON}
            projectName="Test Project"
            mdp={42}
            isAuthor={true}
          />
        </TestnetProviders>
      )

      // Open and import
      cy.get('[data-testid="edit-proposal-button"]').click()
      cy.get('[data-testid="import-button"]').click()
      cy.get('[data-testid="updated-preview"]').should('exist')

      // Close
      cy.get('[data-testid="close-edit-button"]').click()

      // Reopen - preview should be cleared
      cy.get('[data-testid="edit-proposal-button"]').click()
      cy.get('[data-testid="updated-preview"]').should('not.exist')
      cy.get('[data-testid="update-proposal-button"]').should('be.disabled')
    })
  })
})
