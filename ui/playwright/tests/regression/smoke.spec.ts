import { test, expect } from '../../fixtures/base'

/**
 * Smoke tests for basic functionality
 * These run quickly and verify the app is in a working state
 */

test.describe('Smoke Tests', () => {
  // Use shorter timeout for smoke tests
  test.setTimeout(60000)

  test('app loads without crashing', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBeLessThan(500)
    
    // Wait for DOM to be ready (networkidle can timeout with external APIs)
    await page.waitForLoadState('domcontentloaded')
    
    // Wait a bit for React hydration
    await page.waitForTimeout(2000)
    
    // Basic content check
    const body = await page.locator('body')
    await expect(body).toBeVisible()
  })

  test('critical pages are accessible', async ({ page }) => {
    const criticalPages = [
      '/',
      '/proposals',
      '/projects',
      '/network',
      '/citizen',
    ]

    for (const path of criticalPages) {
      const response = await page.goto(path, { timeout: 30000 })
      expect(response?.status()).toBeLessThan(500)
      await page.waitForLoadState('domcontentloaded')
    }
  })

  test('no JavaScript errors on initial load', async ({ page, captureErrors }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(3000) // Wait for async operations
    
    const errors = await captureErrors()
    
    // Filter out known non-critical errors
    const criticalErrors = errors.uncaughtErrors.filter(e => 
      !e.includes('ResizeObserver') && // Common React warning
      !e.includes('hydration') // Next.js hydration warnings
    )
    
    expect(criticalErrors).toHaveLength(0)
  })

  test('API health check', async ({ page }) => {
    // Check that key API routes respond
    const apiRoutes = [
      '/api/mooney/price',
    ]

    for (const route of apiRoutes) {
      const response = await page.request.get(route)
      expect(response.status()).toBeLessThan(500)
    }
  })

  test('images load correctly', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Check for broken images
    const brokenImages = await page.evaluate(() => {
      const images = document.querySelectorAll('img')
      const broken: string[] = []
      
      images.forEach(img => {
        if (!img.complete || img.naturalWidth === 0) {
          broken.push(img.src || img.getAttribute('data-src') || 'unknown')
        }
      })
      
      return broken
    })
    
    expect(brokenImages).toHaveLength(0)
  })

  test('external links have proper attributes', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Check external links have target="_blank" and rel="noopener"
    const externalLinks = await page.locator('a[href^="http"]').all()
    
    for (const link of externalLinks.slice(0, 10)) {
      const href = await link.getAttribute('href')
      const target = await link.getAttribute('target')
      const rel = await link.getAttribute('rel')
      
      // External links should open in new tab with security attributes
      if (href && !href.includes('moondao.com')) {
        expect(target).toBe('_blank')
        expect(rel).toContain('noopener')
      }
    }
  })
})
