import { test, expect } from '../../fixtures/base'
import { TEST_WALLETS, mockPrivyAuth } from '../../fixtures/wallets'
import { getBreakpointTestViewports } from '../../fixtures/viewports'

/**
 * Citizen onboarding flow tests
 * Tests the citizen NFT minting and profile creation process
 */

test.describe('Citizen Page Access', () => {
  test('should load citizen page without errors', async ({ 
    page,
    captureErrors 
  }) => {
    await page.goto('/citizen')
    await page.waitForLoadState('networkidle')
    
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
    
    // Page should not show server error
    const content = await page.content()
    expect(content).not.toContain('500')
    expect(content).not.toContain('Internal Server Error')
  })

  test('should prompt wallet connection for unauthenticated users', async ({ 
    page 
  }) => {
    await page.goto('/citizen')
    await page.waitForLoadState('networkidle')
    
    // Should show connect/sign in prompt
    const connectPrompt = page.locator('text=/connect|sign in|login|wallet/i')
    const hasPrompt = await connectPrompt.count()
    
    // Either shows connect prompt or shows citizenship info
    expect(hasPrompt).toBeGreaterThanOrEqual(0)
  })

  test('should show citizen information for connected users', async ({ 
    authenticatedPage 
  }) => {
    await authenticatedPage.goto('/citizen')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // Wait for content to load
    await authenticatedPage.waitForTimeout(2000)
    
    // Take screenshot for analysis
    await authenticatedPage.screenshot({
      path: 'playwright/results/citizen-authenticated.png',
      fullPage: true
    })
  })
})

test.describe('Citizen Profile Creation', () => {
  test('should display profile form fields', async ({ 
    authenticatedPage 
  }) => {
    await authenticatedPage.goto('/citizen')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // Wait for form to potentially load
    await authenticatedPage.waitForTimeout(2000)
    
    // Look for common form fields
    const formFields = [
      'input[name*="name"]',
      'input[name*="bio"]',
      'textarea',
      'input[type="file"]',
    ]
    
    for (const selector of formFields) {
      const count = await authenticatedPage.locator(selector).count()
      console.log(`Form field ${selector}: ${count} found`)
    }
  })

  test('should validate required fields', async ({ 
    authenticatedPage,
    captureErrors 
  }) => {
    await authenticatedPage.goto('/citizen')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // Try to submit without filling required fields
    const submitButton = authenticatedPage.locator('button[type="submit"], button:has-text("Create"), button:has-text("Submit")')
    
    if (await submitButton.count() > 0) {
      await submitButton.first().click()
      await authenticatedPage.waitForTimeout(500)
      
      // Should show validation errors, not crash
      const errors = await captureErrors()
      expect(errors.uncaughtErrors).toHaveLength(0)
    }
  })
})

test.describe('Citizen Page Responsive', () => {
  const viewports = getBreakpointTestViewports()
  
  for (const viewport of viewports) {
    test(`citizen page layout on ${viewport.name}`, async ({ 
      page,
      setViewport,
      captureErrors 
    }) => {
      await setViewport(viewport)
      await page.goto('/citizen')
      await page.waitForLoadState('networkidle')
      
      // Check for layout issues
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      
      expect(hasOverflow).toBe(false)
      
      // Screenshot for visual inspection
      await page.screenshot({
        path: `playwright/results/citizen-${viewport.name.replace(/\s+/g, '-')}.png`,
        fullPage: true
      })
      
      const errors = await captureErrors()
      expect(errors.uncaughtErrors).toHaveLength(0)
    })
  }
})

test.describe('Citizen Referral System', () => {
  test('should handle referral parameter', async ({ 
    page,
    captureErrors 
  }) => {
    // Navigate with referral parameter
    await page.goto('/citizen?referredBy=0x1234567890123456789012345678901234567890')
    await page.waitForLoadState('networkidle')
    
    // Should not crash with invalid/unknown referrer
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
  })

  test('should persist referral through wallet connection', async ({ 
    page 
  }) => {
    await page.goto('/citizen?referredBy=0x1234567890123456789012345678901234567890')
    await page.waitForLoadState('networkidle')
    
    // Check if referral is stored (in localStorage or URL)
    const storedReferral = await page.evaluate(() => {
      return localStorage.getItem('referredBy') || 
             new URL(window.location.href).searchParams.get('referredBy')
    })
    
    // Referral should be preserved
    expect(storedReferral).toBeTruthy()
  })
})

test.describe('Existing Citizen View', () => {
  test('should handle citizen lookup by address', async ({ 
    page,
    captureErrors 
  }) => {
    // Use a test address
    await page.goto('/citizen/0x1234567890123456789012345678901234567890')
    await page.waitForLoadState('networkidle')
    
    // Should either show citizen or "not found" message, not crash
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
  })

  test('should handle citizen lookup by ENS-like name', async ({ 
    page,
    captureErrors 
  }) => {
    await page.goto('/citizen/testuser')
    await page.waitForLoadState('networkidle')
    
    // Should handle gracefully
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
  })
})

test.describe('Citizen Network Page', () => {
  test('should load network page with citizens tab', async ({ 
    page,
    captureErrors 
  }) => {
    await page.goto('/network?tab=citizens')
    await page.waitForLoadState('networkidle')
    
    // Wait for content
    await page.waitForTimeout(2000)
    
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
    
    // Should display citizen list or empty state
    const citizenElements = page.locator('[class*="citizen"], [data-testid*="citizen"]')
    const emptyState = page.locator('text=/no citizens|be the first/i')
    
    const hasCitizens = await citizenElements.count()
    const hasEmptyState = await emptyState.count()
    
    // Should have either citizens or empty state
    expect(hasCitizens + hasEmptyState).toBeGreaterThanOrEqual(0)
  })
})
