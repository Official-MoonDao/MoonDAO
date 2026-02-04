import { test, expect } from '../../fixtures/base'
import { getBreakpointTestViewports } from '../../fixtures/viewports'

/**
 * Projects and rewards system tests
 * Tests project listing, details, and rewards distribution
 */

test.describe('Projects List', () => {
  test('should load projects page', async ({ 
    page,
    captureErrors 
  }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
    
    await page.screenshot({
      path: 'playwright/results/projects-list.png',
      fullPage: true
    })
  })

  test('should display project cards', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    
    const projectCards = page.locator('[class*="project"], a[href*="/project/"], [data-testid*="project"]')
    const count = await projectCards.count()
    
    console.log(`Found ${count} project elements`)
  })

  test('should filter projects', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Look for filter/tab controls
    const filters = page.locator('[role="tablist"] button, button[class*="filter"], button:has-text("All"), button:has-text("Active")')
    const filterCount = await filters.count()
    
    if (filterCount > 0) {
      for (let i = 0; i < Math.min(filterCount, 3); i++) {
        await filters.nth(i).click()
        await page.waitForTimeout(500)
      }
    }
  })

  test('should handle search functionality', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[name*="search"]')
    
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test')
      await page.waitForTimeout(1000)
      
      // Search should work without errors
      const content = await page.content()
      expect(content).not.toContain('Error')
    }
  })
})

test.describe('Single Project View', () => {
  test('should load project detail page', async ({ 
    page,
    captureErrors 
  }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    const projectLink = page.locator('a[href*="/project/"]').first()
    
    if (await projectLink.count() > 0) {
      await projectLink.click()
      await page.waitForLoadState('networkidle')
      
      const errors = await captureErrors()
      expect(errors.uncaughtErrors).toHaveLength(0)
      
      expect(page.url()).toContain('/project/')
    }
  })

  test('should display project details', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    const projectLink = page.locator('a[href*="/project/"]').first()
    
    if (await projectLink.count() > 0) {
      await projectLink.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      
      // Should have project title
      const title = page.locator('h1, h2').first()
      await expect(title).toBeVisible()
      
      // Should have project info
      const projectInfo = page.locator('text=/team|budget|status|reward/i')
      const hasInfo = await projectInfo.count()
      expect(hasInfo).toBeGreaterThan(0)
    }
  })

  test('should show team members', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    const projectLink = page.locator('a[href*="/project/"]').first()
    
    if (await projectLink.count() > 0) {
      await projectLink.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      
      // Look for team section
      const teamSection = page.locator('text=/team|members|contributors/i')
      console.log(`Found ${await teamSection.count()} team-related elements`)
    }
  })
})

test.describe('Project Rewards', () => {
  test('should display rewards information', async ({ 
    page,
    captureErrors 
  }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    const projectLink = page.locator('a[href*="/project/"]').first()
    
    if (await projectLink.count() > 0) {
      await projectLink.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      
      // Look for rewards section
      const rewardsSection = page.locator('text=/reward|budget|distribution|payout/i')
      console.log(`Found ${await rewardsSection.count()} rewards-related elements`)
      
      const errors = await captureErrors()
      expect(errors.uncaughtErrors).toHaveLength(0)
    }
  })

  test('should handle rewards for authenticated users', async ({ 
    authenticatedPage 
  }) => {
    await authenticatedPage.goto('/projects')
    await authenticatedPage.waitForLoadState('networkidle')
    await authenticatedPage.waitForTimeout(2000)
    
    const projectLink = authenticatedPage.locator('a[href*="/project/"]').first()
    
    if (await projectLink.count() > 0) {
      await projectLink.click()
      await authenticatedPage.waitForLoadState('networkidle')
      await authenticatedPage.waitForTimeout(2000)
      
      // Take screenshot for analysis
      await authenticatedPage.screenshot({
        path: 'playwright/results/project-rewards-auth.png',
        fullPage: true
      })
    }
  })
})

test.describe('Project Submission', () => {
  test('should navigate to project submission', async ({ 
    authenticatedPage,
    captureErrors 
  }) => {
    // Try direct navigation
    await authenticatedPage.goto('/submit')
    await authenticatedPage.waitForLoadState('networkidle')
    
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
  })

  test('should display submission form', async ({ 
    authenticatedPage 
  }) => {
    await authenticatedPage.goto('/submit')
    await authenticatedPage.waitForLoadState('networkidle')
    await authenticatedPage.waitForTimeout(2000)
    
    // Look for form elements
    const formInputs = authenticatedPage.locator('input, textarea, select')
    const inputCount = await formInputs.count()
    
    console.log(`Found ${inputCount} form inputs on submit page`)
  })
})

test.describe('Projects Responsive', () => {
  const viewports = getBreakpointTestViewports()
  
  for (const viewport of viewports) {
    test(`projects page on ${viewport.name}`, async ({ 
      page,
      setViewport,
      captureErrors 
    }) => {
      await setViewport(viewport)
      await page.goto('/projects')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasOverflow).toBe(false)
      
      await page.screenshot({
        path: `playwright/results/projects-${viewport.name.replace(/\s+/g, '-')}.png`,
        fullPage: true
      })
      
      const errors = await captureErrors()
      expect(errors.uncaughtErrors).toHaveLength(0)
    })
  }
})

test.describe('Contributions', () => {
  test('should load contributions page', async ({ 
    page,
    captureErrors 
  }) => {
    await page.goto('/contributions')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
  })

  test('should display contribution form for authenticated users', async ({ 
    authenticatedPage 
  }) => {
    await authenticatedPage.goto('/contributions')
    await authenticatedPage.waitForLoadState('networkidle')
    await authenticatedPage.waitForTimeout(2000)
    
    // Look for contribution submission UI
    const submitButton = authenticatedPage.locator('button:has-text("Submit"), button:has-text("Create")')
    console.log(`Found ${await submitButton.count()} submit buttons`)
  })
})

test.describe('Final Reports', () => {
  test('should load final reports page', async ({ 
    page,
    captureErrors 
  }) => {
    await page.goto('/final-reports')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
  })
})
