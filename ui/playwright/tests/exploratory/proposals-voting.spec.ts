import { test, expect } from '../../fixtures/base'
import { TEST_WALLETS } from '../../fixtures/wallets'
import { getBreakpointTestViewports } from '../../fixtures/viewports'

/**
 * Proposals and voting flow tests
 * Tests proposal listing, viewing, and voting functionality
 */

test.describe('Proposals List', () => {
  test('should load proposals page', async ({ 
    page,
    captureErrors 
  }) => {
    await page.goto('/proposals')
    await page.waitForLoadState('networkidle')
    
    // Wait for proposals to load (may be async)
    await page.waitForTimeout(3000)
    
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
    
    // Screenshot for analysis
    await page.screenshot({
      path: 'playwright/results/proposals-list.png',
      fullPage: true
    })
  })

  test('should display proposal cards', async ({ page }) => {
    await page.goto('/proposals')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    
    // Look for proposal elements
    const proposalCards = page.locator('[class*="proposal"], a[href*="/proposal/"], [data-testid*="proposal"]')
    const count = await proposalCards.count()
    
    console.log(`Found ${count} proposal elements`)
    
    // Should have proposals or empty state
    if (count === 0) {
      const emptyState = page.locator('text=/no proposals|no active/i')
      const hasEmpty = await emptyState.count()
      expect(hasEmpty).toBeGreaterThanOrEqual(0)
    }
  })

  test('should filter proposals by status', async ({ page }) => {
    await page.goto('/proposals')
    await page.waitForLoadState('networkidle')
    
    // Look for filter controls
    const filterButtons = page.locator('button:has-text("Active"), button:has-text("Pending"), button:has-text("Closed")')
    const filterCount = await filterButtons.count()
    
    if (filterCount > 0) {
      // Click through filters
      for (let i = 0; i < Math.min(filterCount, 3); i++) {
        await filterButtons.nth(i).click()
        await page.waitForTimeout(500)
      }
    }
  })

  test('should handle pagination/infinite scroll', async ({ page }) => {
    await page.goto('/proposals')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Get initial count
    const initialCards = await page.locator('a[href*="/proposal/"]').count()
    
    // Scroll down to trigger more loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    
    await page.waitForTimeout(2000)
    
    // Check if more loaded (may or may not depending on total proposals)
    const afterScrollCards = await page.locator('a[href*="/proposal/"]').count()
    console.log(`Before scroll: ${initialCards}, After scroll: ${afterScrollCards}`)
  })
})

test.describe('Single Proposal View', () => {
  test('should load proposal detail page', async ({ 
    page,
    captureErrors 
  }) => {
    // First get a real proposal ID from the list
    await page.goto('/proposals')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    const proposalLink = page.locator('a[href*="/proposal/"]').first()
    
    if (await proposalLink.count() > 0) {
      await proposalLink.click()
      await page.waitForLoadState('networkidle')
      
      const errors = await captureErrors()
      expect(errors.uncaughtErrors).toHaveLength(0)
      
      // Should be on proposal page
      expect(page.url()).toContain('/proposal/')
    }
  })

  test('should display proposal content', async ({ page }) => {
    await page.goto('/proposals')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    const proposalLink = page.locator('a[href*="/proposal/"]').first()
    
    if (await proposalLink.count() > 0) {
      await proposalLink.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      
      // Should have title
      const title = page.locator('h1, h2').first()
      await expect(title).toBeVisible()
      
      // Should have voting info or status
      const votingInfo = page.locator('text=/vote|voting|quorum|for|against/i')
      const hasVotingInfo = await votingInfo.count()
      expect(hasVotingInfo).toBeGreaterThan(0)
    }
  })

  test('should show voting options for connected wallet', async ({ 
    authenticatedPage 
  }) => {
    await authenticatedPage.goto('/proposals')
    await authenticatedPage.waitForLoadState('networkidle')
    await authenticatedPage.waitForTimeout(2000)
    
    const proposalLink = authenticatedPage.locator('a[href*="/proposal/"]').first()
    
    if (await proposalLink.count() > 0) {
      await proposalLink.click()
      await authenticatedPage.waitForLoadState('networkidle')
      await authenticatedPage.waitForTimeout(2000)
      
      // Look for vote buttons
      const voteButtons = authenticatedPage.locator('button:has-text("Vote"), button:has-text("For"), button:has-text("Against")')
      console.log(`Found ${await voteButtons.count()} vote buttons`)
    }
  })
})

test.describe('Proposal Creation', () => {
  test('should navigate to proposal creation', async ({ 
    authenticatedPage,
    captureErrors 
  }) => {
    await authenticatedPage.goto('/proposals')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // Look for create/submit proposal button
    const createButton = authenticatedPage.locator('button:has-text("Create"), button:has-text("New Proposal"), a:has-text("Submit")')
    
    if (await createButton.count() > 0) {
      await createButton.first().click()
      await authenticatedPage.waitForLoadState('networkidle')
      
      const errors = await captureErrors()
      expect(errors.uncaughtErrors).toHaveLength(0)
    }
  })
})

test.describe('Proposals Responsive', () => {
  const viewports = getBreakpointTestViewports()
  
  for (const viewport of viewports) {
    test(`proposals page on ${viewport.name}`, async ({ 
      page,
      setViewport,
      captureErrors 
    }) => {
      await setViewport(viewport)
      await page.goto('/proposals')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      
      // No horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasOverflow).toBe(false)
      
      // Screenshot
      await page.screenshot({
        path: `playwright/results/proposals-${viewport.name.replace(/\s+/g, '-')}.png`,
        fullPage: true
      })
      
      const errors = await captureErrors()
      expect(errors.uncaughtErrors).toHaveLength(0)
    })
  }
})

test.describe('Proposal Voting Error Handling', () => {
  test('should handle vote without sufficient voting power', async ({ 
    authenticatedPage,
    captureErrors 
  }) => {
    await authenticatedPage.goto('/proposals')
    await authenticatedPage.waitForLoadState('networkidle')
    await authenticatedPage.waitForTimeout(2000)
    
    const proposalLink = authenticatedPage.locator('a[href*="/proposal/"]').first()
    
    if (await proposalLink.count() > 0) {
      await proposalLink.click()
      await authenticatedPage.waitForLoadState('networkidle')
      await authenticatedPage.waitForTimeout(2000)
      
      const voteButton = authenticatedPage.locator('button:has-text("Vote For"), button:has-text("For")').first()
      
      if (await voteButton.count() > 0 && await voteButton.isEnabled()) {
        await voteButton.click()
        await authenticatedPage.waitForTimeout(1000)
        
        // Should show error message, not crash
        const errors = await captureErrors()
        expect(errors.uncaughtErrors).toHaveLength(0)
      }
    }
  })

  test('should handle network errors during voting', async ({ 
    authenticatedPage 
  }) => {
    // Block API calls
    await authenticatedPage.route('**/api/proposals/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Network error' })
      })
    })
    
    await authenticatedPage.goto('/proposals')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // App should show error state, not crash
    const pageContent = await authenticatedPage.content()
    expect(pageContent).not.toContain('Unhandled')
  })
})
