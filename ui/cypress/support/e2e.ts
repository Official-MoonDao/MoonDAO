// E2E support file for BrowserStack compatibility
// This file is required by BrowserStack even if minimal

// Import custom commands
import './commands'

// Handle React hydration errors that can occur intermittently on BrowserStack
// due to timing differences between server and client rendering
Cypress.on('uncaught:exception', (err, runnable) => {
  // Handle network-related errors
  if (err.message.includes('noNetwork')) {
    return false
  }

  if (
    err.message.includes('Minified React error #421') ||
    err.message.includes('error #421') ||
    err.message.includes('Hydration failed') ||
    err.message.includes('Text content does not match') ||
    err.message.includes('hydration')
  ) {
    console.warn('[E2E] Suppressing React hydration error:', err.message)
    return false
  }

  return true
})
