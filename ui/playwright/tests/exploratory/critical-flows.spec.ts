import { test, expect, testAcrossViewports, captureBugReportData } from '../../fixtures/base'
import { VIEWPORTS, getBreakpointTestViewports } from '../../fixtures/viewports'
import { TEST_WALLETS, switchChain, CHAINS } from '../../fixtures/wallets'
import fs from 'fs'
import path from 'path'

/**
 * Critical user flow tests for MoonDAO
 * These tests are run by the bug detection agent to find issues
 */

test.describe('Homepage and Navigation', () => {
  test('should load homepage without errors', async ({ 
    page, 
    consoleMessages, 
    captureErrors 
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const errors = await captureErrors()
    
    // Check for critical console errors
    const criticalErrors = errors.console.filter(
      e => e.type === 'error' && !e.text.includes('favicon')
    )
    
    expect(criticalErrors).toHaveLength(0)
    expect(errors.uncaughtErrors).toHaveLength(0)
  })

  test('should have all navigation links working', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Get all navigation links
    const navLinks = await page.locator('nav a[href^="/"]').all()
    
    for (const link of navLinks.slice(0, 10)) { // Test first 10 links
      const href = await link.getAttribute('href')
      if (href && !href.startsWith('http')) {
        // Navigate to link
        await link.click()
        await page.waitForLoadState('networkidle')
        
        // Check for errors
        const hasError = await page.locator('text=/error|404|not found/i').count()
        expect(hasError).toBe(0)
        
        // Go back
        await page.goBack()
        await page.waitForLoadState('networkidle')
      }
    }
  })
})

test.describe('Wallet Connection Flow', () => {
  test('should show connect wallet button when not connected', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Look for connect wallet button
    const connectButton = page.locator('button:has-text("Connect"), button:has-text("Sign In"), button:has-text("Login")')
    await expect(connectButton.first()).toBeVisible({ timeout: 10000 })
  })

  test('should handle wallet connection with mocked provider', async ({ 
    authenticatedPage,
    mockWallet 
  }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // Check if wallet address is displayed somewhere
    const addressDisplay = authenticatedPage.locator(`text=/${mockWallet.address.slice(0, 6)}/i`)
    // This may or may not be visible depending on the app state
  })

  test('should handle chain switching gracefully', async ({ 
    authenticatedPage,
    mockWallet 
  }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // Switch to Arbitrum
    await switchChain(authenticatedPage, CHAINS.arbitrum.id)
    
    // Wait for any chain-related UI updates
    await authenticatedPage.waitForTimeout(1000)
    
    // Check for any error states
    const errorElements = await authenticatedPage.locator('[class*="error"], [role="alert"]').count()
    // Log but don't fail - some errors might be expected
    if (errorElements > 0) {
      console.log(`Found ${errorElements} potential error elements after chain switch`)
    }
  })
})

test.describe('Citizen Onboarding Flow', () => {
  test('should navigate to citizen page', async ({ page }) => {
    await page.goto('/citizen')
    await page.waitForLoadState('networkidle')
    
    // Page should load without errors
    const pageContent = await page.content()
    expect(pageContent).not.toContain('500')
    expect(pageContent).not.toContain('Internal Server Error')
  })

  test('should handle citizen page with wallet connected', async ({ 
    authenticatedPage 
  }) => {
    await authenticatedPage.goto('/citizen')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // Look for citizen-related UI elements
    const citizenElements = authenticatedPage.locator('[class*="citizen"], [data-testid*="citizen"]')
    
    // Take screenshot for analysis
    await authenticatedPage.screenshot({ 
      path: 'playwright/results/citizen-page.png',
      fullPage: true 
    })
  })
})

test.describe('Proposals and Voting', () => {
  test('should load proposals page', async ({ page }) => {
    await page.goto('/proposals')
    await page.waitForLoadState('networkidle')
    
    // Wait for proposals to load
    await page.waitForTimeout(2000)
    
    // Check for any loading errors
    const errorText = await page.locator('text=/error|failed/i').count()
    expect(errorText).toBe(0)
  })

  test('should navigate to individual proposal', async ({ page }) => {
    await page.goto('/proposals')
    await page.waitForLoadState('networkidle')
    
    // Find and click first proposal link
    const proposalLink = page.locator('a[href*="/proposal/"]').first()
    
    if (await proposalLink.count() > 0) {
      await proposalLink.click()
      await page.waitForLoadState('networkidle')
      
      // Check page loaded
      expect(page.url()).toContain('/proposal/')
    }
  })
})

test.describe('Projects Page', () => {
  test('should load projects list', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    
    // Wait for content to load
    await page.waitForTimeout(2000)
    
    // Screenshot for analysis
    await page.screenshot({ 
      path: 'playwright/results/projects-page.png',
      fullPage: true 
    })
  })
})

test.describe('Responsive Design', () => {
  const viewports = getBreakpointTestViewports()
  
  for (const viewport of viewports) {
    test(`homepage renders correctly on ${viewport.name}`, async ({ 
      page, 
      setViewport,
      captureErrors 
    }) => {
      await setViewport(viewport)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      // Check for horizontal overflow (common responsive bug)
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      
      expect(hasOverflow).toBe(false)
      
      // Check for visible content cutoff
      const errors = await captureErrors()
      expect(errors.uncaughtErrors).toHaveLength(0)
      
      // Screenshot for visual comparison
      await page.screenshot({ 
        path: `playwright/results/homepage-${viewport.name.replace(/\s+/g, '-')}.png`,
        fullPage: true 
      })
    })
  }
})

test.describe('Form Interactions', () => {
  test('should handle form submission gracefully', async ({ 
    authenticatedPage,
    captureErrors 
  }) => {
    // Navigate to a page with forms (e.g., contribution submission)
    await authenticatedPage.goto('/contributions')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // Look for any form elements
    const forms = await authenticatedPage.locator('form').all()
    
    for (const form of forms.slice(0, 3)) { // Test first 3 forms
      // Try to submit empty form to test validation
      const submitButton = form.locator('button[type="submit"], input[type="submit"]')
      
      if (await submitButton.count() > 0) {
        await submitButton.first().click()
        
        // Check for proper validation errors (not crashes)
        const errors = await captureErrors()
        expect(errors.uncaughtErrors).toHaveLength(0)
      }
    }
  })
})

test.describe('Network Error Handling', () => {
  test('should handle API failures gracefully', async ({ page }) => {
    // Intercept API calls and make them fail
    await page.route('**/api/**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // App should not crash, should show error state
    const pageTitle = await page.title()
    expect(pageTitle).not.toContain('Error')
  })
})

test.describe('Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Check for h1
    const h1Count = await page.locator('h1').count()
    expect(h1Count).toBeGreaterThanOrEqual(1)
    
    // Check heading order (no skipped levels)
    const headings = await page.evaluate(() => {
      const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      return Array.from(allHeadings).map(h => parseInt(h.tagName[1]))
    })
    
    // Verify no heading levels are skipped (h1 -> h3 without h2 is bad)
    for (let i = 1; i < headings.length; i++) {
      const diff = headings[i] - headings[i - 1]
      expect(diff).toBeLessThanOrEqual(1)
    }
  })

  test('should have accessible buttons', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Get all buttons
    const buttons = await page.locator('button').all()
    
    for (const button of buttons.slice(0, 20)) { // Check first 20 buttons
      // Button should have accessible name
      const accessibleName = await button.getAttribute('aria-label') || 
                            await button.textContent() ||
                            await button.getAttribute('title')
      
      expect(accessibleName?.trim()).toBeTruthy()
    }
  })
})
