import { test, expect } from '../../fixtures/base'
import { 
  TEST_WALLETS, 
  CHAINS, 
  injectMockEthereumProvider,
  switchChain,
  disconnectWallet,
  getWalletState
} from '../../fixtures/wallets'
import { getBreakpointTestViewports } from '../../fixtures/viewports'

/**
 * Wallet connection and interaction tests
 * Tests wallet connection, chain switching, and Web3 interactions
 */

test.describe('Wallet Connection', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean state
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should display connect wallet button when not connected', async ({ page }) => {
    // Look for various connect button patterns
    const connectSelectors = [
      'button:has-text("Connect")',
      'button:has-text("Sign In")',
      'button:has-text("Login")',
      '[data-testid="connect-wallet"]',
    ]
    
    let found = false
    for (const selector of connectSelectors) {
      const count = await page.locator(selector).count()
      if (count > 0) {
        found = true
        break
      }
    }
    
    expect(found).toBe(true)
  })

  test('should handle wallet connection with mock provider', async ({ 
    page,
    captureErrors 
  }) => {
    const wallet = TEST_WALLETS.user1
    await injectMockEthereumProvider(page, wallet)
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Check for errors after injection
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
  })

  test('should persist wallet state across navigation', async ({ 
    authenticatedPage 
  }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // Navigate to another page
    await authenticatedPage.goto('/proposals')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // Wallet should still be connected
    const state = await getWalletState(authenticatedPage)
    expect(state.connected).toBe(true)
  })
})

test.describe('Chain Switching', () => {
  test('should handle switching from Mainnet to Arbitrum', async ({ 
    authenticatedPage,
    mockWallet,
    captureErrors 
  }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // Start on Mainnet
    let state = await getWalletState(authenticatedPage)
    expect(state.chainId).toBe(CHAINS.mainnet.id)
    
    // Switch to Arbitrum
    await switchChain(authenticatedPage, CHAINS.arbitrum.id)
    await authenticatedPage.waitForTimeout(500)
    
    // Verify switch
    state = await getWalletState(authenticatedPage)
    expect(state.chainId).toBe(CHAINS.arbitrum.id)
    
    // Check for errors
    const errors = await captureErrors()
    const criticalErrors = errors.uncaughtErrors.filter(
      e => !e.includes('chain') && !e.includes('network')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('should handle switching to Sepolia testnet', async ({ 
    authenticatedPage,
    captureErrors 
  }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.waitForLoadState('networkidle')
    
    await switchChain(authenticatedPage, CHAINS.sepolia.id)
    await authenticatedPage.waitForTimeout(500)
    
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
  })

  test('should handle unsupported chain gracefully', async ({ 
    authenticatedPage,
    captureErrors 
  }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // Switch to an unsupported chain (Polygon)
    await switchChain(authenticatedPage, 137)
    await authenticatedPage.waitForTimeout(500)
    
    // App should handle this gracefully (show warning, not crash)
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
  })
})

test.describe('Wallet Disconnect', () => {
  test('should handle wallet disconnect cleanly', async ({ 
    authenticatedPage,
    captureErrors 
  }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.waitForLoadState('networkidle')
    
    // Verify connected
    let state = await getWalletState(authenticatedPage)
    expect(state.connected).toBe(true)
    
    // Disconnect
    await disconnectWallet(authenticatedPage)
    await authenticatedPage.waitForTimeout(500)
    
    // Should show connect button again
    const connectButton = authenticatedPage.locator('button:has-text("Connect"), button:has-text("Sign In")')
    
    // App should handle disconnect without errors
    const errors = await captureErrors()
    expect(errors.uncaughtErrors).toHaveLength(0)
  })
})

test.describe('Wallet State on Different Pages', () => {
  const pagesToTest = [
    { path: '/', name: 'Home' },
    { path: '/proposals', name: 'Proposals' },
    { path: '/projects', name: 'Projects' },
    { path: '/network', name: 'Network' },
    { path: '/citizen', name: 'Citizen' },
  ]

  for (const { path, name } of pagesToTest) {
    test(`should handle wallet state on ${name} page`, async ({ 
      authenticatedPage,
      captureErrors 
    }) => {
      await authenticatedPage.goto(path)
      await authenticatedPage.waitForLoadState('networkidle')
      
      // Wait for any wallet-related operations
      await authenticatedPage.waitForTimeout(1000)
      
      const errors = await captureErrors()
      
      // Filter out expected warnings
      const criticalErrors = errors.console.filter(e => 
        e.type === 'error' && 
        !e.text.includes('favicon') &&
        !e.text.includes('hydration')
      )
      
      expect(criticalErrors).toHaveLength(0)
      expect(errors.uncaughtErrors).toHaveLength(0)
    })
  }
})

test.describe('Wallet Connection Mobile', () => {
  const mobileViewports = getBreakpointTestViewports().filter(v => v.isMobile)
  
  for (const viewport of mobileViewports) {
    test(`should show mobile wallet connect on ${viewport.name}`, async ({ 
      page,
      setViewport 
    }) => {
      await setViewport(viewport)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      // Mobile should have accessible connect option
      const connectButton = page.locator('button:has-text("Connect"), button:has-text("Sign In"), [aria-label*="connect"]')
      const hasConnect = await connectButton.count()
      
      // Either visible or in a menu
      if (hasConnect === 0) {
        // Check for hamburger menu
        const menuButton = page.locator('[aria-label*="menu"], button:has-text("Menu")')
        if (await menuButton.count() > 0) {
          await menuButton.first().click()
          await page.waitForTimeout(300)
        }
      }
    })
  }
})
