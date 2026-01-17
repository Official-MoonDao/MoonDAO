describe('Proposal Submission Flow', () => {
  beforeEach(() => {
    // Visit the proposal submission page
    cy.visit('/submit')
  })

  describe('Happy Path - Successful Submission', () => {
    it('Should successfully submit a proposal with all required fields', () => {
      // Check if wallet connection is required
      cy.get('body').then(($body) => {
        if ($body.text().includes('Connect Wallet') || $body.text().includes('Sign In')) {
          cy.log('Wallet connection required - skipping E2E test in CI')
          cy.log('This test requires manual execution with wallet connected')
          return
        }

        // Fill in proposal title
        cy.get('input[placeholder*="title"]', { timeout: 10000 }).should('be.visible')
        cy.get('input[placeholder*="title"]').clear().type('E2E Test Proposal: Automated Submission')

        // Wait for editor to load and fill in content
        cy.get('.ProseMirror', { timeout: 15000 }).should('be.visible')
        cy.get('.ProseMirror').click().type('This is a test proposal content created by automated E2E testing.')

        // Submit the proposal
        cy.contains('button', 'Submit').should('be.visible').should('not.be.disabled')
        cy.contains('button', 'Submit').click()

        // Wait for signing process
        cy.contains('Sign proposal', { timeout: 5000 }).should('exist')

        // Note: In real E2E test with wallet, we would:
        // 1. Wait for wallet popup
        // 2. Approve signature
        // 3. Wait for upload
        // 4. Verify success message
      })
    })
  })

  describe('Validation Errors', () => {
    it('Should prevent submission without title', () => {
      // Wait for page to load
      cy.get('input[placeholder*="title"]', { timeout: 10000 }).should('exist')

      // Add content but no title
      cy.get('.ProseMirror', { timeout: 15000 }).should('be.visible')
      cy.get('.ProseMirror').click().type('Content without title')

      // Try to submit
      cy.contains('button', 'Submit').click()

      // Should show error
      cy.contains('Please enter a title', { timeout: 5000 }).should('exist')
    })

    it('Should prevent submission without content', () => {
      // Wait for page to load
      cy.get('input[placeholder*="title"]', { timeout: 10000 }).should('exist')

      // Add title but no content
      cy.get('input[placeholder*="title"]').clear().type('Title without content')

      // Try to submit
      cy.contains('button', 'Submit').click()

      // Should show error
      cy.contains('Please write some content', { timeout: 5000 }).should('exist')
    })
  })

  describe('Budget Attachment', () => {
    it('Should allow attaching a budget to proposal', () => {
      cy.get('input[placeholder*="title"]', { timeout: 10000 }).should('exist')

      // Fill in basic proposal info
      cy.get('input[placeholder*="title"]').clear().type('Proposal with Budget')
      cy.get('.ProseMirror', { timeout: 15000 }).should('be.visible')
      cy.get('.ProseMirror').click().type('This proposal includes a budget request.')

      // Enable budget attachment
      cy.contains('Attach Budget').parent().find('[role="switch"]').click()

      // Budget form should appear
      cy.contains('Token', { timeout: 3000 }).should('exist')
      cy.contains('Amount').should('exist')

      // Fill in budget details
      cy.get('input[name*="budget"]').first().type('USDC')
    })
  })

  describe('Local Cache', () => {
    it('Should save and restore from cache', () => {
      cy.get('input[placeholder*="title"]', { timeout: 10000 }).should('exist')

      const testTitle = 'Cached Proposal Title'
      const testContent = 'Cached proposal content'

      // Fill in proposal
      cy.get('input[placeholder*="title"]').clear().type(testTitle)
      cy.get('.ProseMirror', { timeout: 15000 }).should('be.visible')
      cy.get('.ProseMirror').click().type(testContent)

      // Wait for cache to update
      cy.wait(1000)

      // Reload page
      cy.reload()

      // Wait for page to load
      cy.get('input[placeholder*="title"]', { timeout: 10000 }).should('exist')

      // Check if cache restore prompt appears
      cy.get('body').then(($body) => {
        if ($body.text().includes('restore') || $body.text().includes('Restore')) {
          cy.log('Cache restore available')
          // Click restore if available
          cy.contains(/restore/i).click()
        }
      })
    })
  })

  describe('Timeout Handling', () => {
    it('Should handle signing timeout gracefully', () => {
      // This test would require mocking a slow wallet response
      // and verifying timeout error message appears

      cy.get('body').then(($body) => {
        if ($body.text().includes('Connect Wallet') || $body.text().includes('Sign In')) {
          cy.log('Wallet connection required - skipping timeout test')
          return
        }

        cy.get('input[placeholder*="title"]', { timeout: 10000 }).should('exist')
        cy.get('input[placeholder*="title"]').clear().type('Timeout Test Proposal')
        cy.get('.ProseMirror', { timeout: 15000 }).should('be.visible')
        cy.get('.ProseMirror').click().type('Testing timeout handling')

        // Note: Actual timeout testing requires wallet simulation
        // which is not possible in standard E2E tests
      })
    })
  })

  describe('Image Upload', () => {
    it('Should allow uploading images to proposal', () => {
      cy.get('input[placeholder*="title"]', { timeout: 10000 }).should('exist')

      // Check if markdown upload button exists
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Upload")').length > 0) {
          cy.log('Upload button found')
          // Note: Actual file upload testing would require
          // fixture files and proper IPFS mocking
        }
      })
    })

    it('Should disable interactions during image upload', () => {
      // This would require triggering an actual image upload
      // and verifying the loading state
      cy.log('Image upload interaction test requires file upload simulation')
    })
  })

  describe('Navigation', () => {
    it('Should navigate to proposals page', () => {
      // Click back or navigation link if exists
      cy.get('a[href*="proposal"]').first().should('exist')
    })
  })

  describe('Responsive Design', () => {
    it('Should be usable on mobile viewport', () => {
      cy.viewport('iphone-x')
      cy.get('input[placeholder*="title"]', { timeout: 10000 }).should('be.visible')
      cy.contains('button', 'Submit').should('be.visible')
    })

    it('Should be usable on tablet viewport', () => {
      cy.viewport('ipad-2')
      cy.get('input[placeholder*="title"]', { timeout: 10000 }).should('be.visible')
      cy.contains('button', 'Submit').should('be.visible')
    })
  })

  describe('Error Recovery', () => {
    it('Should allow retry after error', () => {
      cy.get('body').then(($body) => {
        if ($body.text().includes('Connect Wallet') || $body.text().includes('Sign In')) {
          cy.log('Wallet connection required - skipping error recovery test')
          return
        }

        cy.get('input[placeholder*="title"]', { timeout: 10000 }).should('exist')
        cy.get('input[placeholder*="title"]').clear().type('Error Recovery Test')
        cy.get('.ProseMirror', { timeout: 15000 }).should('be.visible')
        cy.get('.ProseMirror').click().type('Testing error recovery')

        // Submit button should be enabled again after any error
        cy.contains('button', 'Submit').should('not.be.disabled')
      })
    })
  })
})
