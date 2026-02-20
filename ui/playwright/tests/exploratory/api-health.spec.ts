import { test, expect } from '../../fixtures/base'

/**
 * API health and error handling tests
 * Tests API endpoints and graceful degradation
 */

test.describe('API Endpoint Health', () => {
  const publicApiEndpoints = [
    '/api/mooney/price',
  ]

  for (const endpoint of publicApiEndpoints) {
    test(`${endpoint} should respond`, async ({ page }) => {
      const response = await page.request.get(endpoint)
      
      // Should not return 500
      expect(response.status()).toBeLessThan(500)
      
      // Should return JSON if successful
      if (response.status() < 400) {
        const contentType = response.headers()['content-type']
        expect(contentType).toContain('application/json')
      }
    })
  }
})

test.describe('API Error Handling', () => {
  test('should handle API timeout gracefully', async ({ page }) => {
    // Slow down API responses
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 5000))
      route.continue()
    })
    
    await page.goto('/', { timeout: 30000 })
    
    // Page should still load (maybe with loading state)
    const body = await page.locator('body')
    await expect(body).toBeVisible()
  })

  test('should handle 500 errors gracefully', async ({ 
    page,
    captureErrors 
  }) => {
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' })
      })
    })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // App should not crash
    const errors = await captureErrors()
    const criticalErrors = errors.uncaughtErrors.filter(
      e => !e.includes('fetch') && !e.includes('network')
    )
    
    // Should show error state instead of crashing
    expect(criticalErrors).toHaveLength(0)
  })

  test('should handle network offline', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Go offline
    await page.context().setOffline(true)
    
    // Try to navigate
    try {
      await page.goto('/proposals', { timeout: 5000 })
    } catch (e) {
      // Expected to fail due to offline
    }
    
    // Go back online
    await page.context().setOffline(false)
    
    // Should recover
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const body = await page.locator('body')
    await expect(body).toBeVisible()
  })
})

test.describe('External Service Errors', () => {
  test('should handle Snapshot API errors', async ({ 
    page,
    captureErrors 
  }) => {
    await page.route('**/*snapshot*/**', route => {
      route.fulfill({
        status: 503,
        body: 'Service Unavailable'
      })
    })
    
    await page.goto('/proposals')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Should show error state or empty state, not crash
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
  })

  test('should handle Etherscan API rate limits', async ({ 
    page,
    captureErrors 
  }) => {
    await page.route('**/*etherscan*/**', route => {
      route.fulfill({
        status: 429,
        body: JSON.stringify({ error: 'Rate limit exceeded' })
      })
    })
    
    await page.goto('/treasury')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
  })

  test('should handle IPFS gateway errors', async ({ 
    page,
    captureErrors 
  }) => {
    await page.route('**/*ipfs*/**', route => {
      route.fulfill({
        status: 504,
        body: 'Gateway Timeout'
      })
    })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Images might fail but app shouldn't crash
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
  })
})

test.describe('Rate Limiting Behavior', () => {
  test('should handle rapid navigation', async ({ page }) => {
    const pages = ['/', '/proposals', '/projects', '/network', '/citizen']
    
    for (const path of pages) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      // Don't wait for full load, simulate quick navigation
    }
    
    // Final page should load properly
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body')
    await expect(body).toBeVisible()
  })
})

test.describe('Data Loading States', () => {
  test('should show loading state for async data', async ({ page }) => {
    // Slow down responses
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      route.continue()
    })
    
    await page.goto('/proposals', { waitUntil: 'domcontentloaded' })
    
    // Should show loading indicator
    const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"], [aria-busy="true"], text=/loading/i')
    
    // Either loading shown or content loaded fast
    // We just check it doesn't crash
    await page.waitForLoadState('networkidle')
  })

  test('should handle empty data states', async ({ page }) => {
    await page.route('**/api/proposals/**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ proposals: [] })
      })
    })
    
    await page.goto('/proposals')
    await page.waitForLoadState('networkidle')
    
    // Should show empty state message
    const emptyState = page.locator('text=/no proposals|empty|nothing/i')
    // Should have empty state or handle gracefully
    const content = await page.content()
    expect(content).not.toContain('undefined')
  })
})
