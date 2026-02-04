import { test as base, expect, Page, BrowserContext } from '@playwright/test'
import { injectMockEthereumProvider, TEST_WALLETS, MockWallet, mockPrivyAuth } from './wallets'
import { ViewportConfig, VIEWPORTS, getBreakpointTestViewports } from './viewports'

/**
 * Extended test fixtures for MoonDAO bug detection agent
 * Provides wallet mocking, viewport management, and error capture
 */

interface ConsoleMessage {
  type: string
  text: string
  location: string
  timestamp: number
}

interface NetworkRequest {
  url: string
  method: string
  status?: number
  timing?: number
  failed?: boolean
  error?: string
}

interface TestFixtures {
  // Wallet fixtures
  mockWallet: MockWallet
  authenticatedPage: Page
  
  // Error capture
  consoleMessages: ConsoleMessage[]
  networkRequests: NetworkRequest[]
  captureErrors: () => Promise<{
    console: ConsoleMessage[]
    network: NetworkRequest[]
    uncaughtErrors: string[]
  }>
  
  // Viewport helpers
  testViewports: ViewportConfig[]
  setViewport: (viewport: ViewportConfig) => Promise<void>
  
  // DOM helpers
  getDOMSnapshot: () => Promise<string>
  getAccessibilityTree: () => Promise<string>
}

export const test = base.extend<TestFixtures>({
  // Default mock wallet
  mockWallet: async ({}, use) => {
    await use(TEST_WALLETS.user1)
  },

  // Page with authenticated wallet
  authenticatedPage: async ({ page, mockWallet }, use) => {
    // Inject mock ethereum provider before navigation
    await injectMockEthereumProvider(page, mockWallet)
    await mockPrivyAuth(page, {
      authenticated: true,
      wallet: mockWallet,
    })
    await use(page)
  },

  // Console message capture
  consoleMessages: async ({ page }, use) => {
    const messages: ConsoleMessage[] = []
    
    page.on('console', (msg) => {
      messages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location().url || '',
        timestamp: Date.now(),
      })
    })
    
    await use(messages)
  },

  // Network request capture
  networkRequests: async ({ page }, use) => {
    const requests: NetworkRequest[] = []
    
    page.on('request', (request) => {
      requests.push({
        url: request.url(),
        method: request.method(),
      })
    })
    
    page.on('response', (response) => {
      const url = response.url()
      const existing = requests.find(r => r.url === url && !r.status)
      if (existing) {
        existing.status = response.status()
        existing.timing = response.timing().responseEnd
      }
    })
    
    page.on('requestfailed', (request) => {
      const url = request.url()
      const existing = requests.find(r => r.url === url && !r.status)
      if (existing) {
        existing.failed = true
        existing.error = request.failure()?.errorText
      }
    })
    
    await use(requests)
  },

  // Comprehensive error capture utility
  captureErrors: async ({ page, consoleMessages, networkRequests }, use) => {
    const uncaughtErrors: string[] = []
    
    page.on('pageerror', (error) => {
      uncaughtErrors.push(error.message)
    })
    
    const capture = async () => {
      return {
        console: consoleMessages.filter(m => 
          m.type === 'error' || m.type === 'warning'
        ),
        network: networkRequests.filter(r => 
          r.failed || (r.status && r.status >= 400)
        ),
        uncaughtErrors,
      }
    }
    
    await use(capture)
  },

  // Breakpoint test viewports
  testViewports: async ({}, use) => {
    await use(getBreakpointTestViewports())
  },

  // Viewport setter
  setViewport: async ({ page }, use) => {
    const setter = async (viewport: ViewportConfig) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      
      // Optionally emulate mobile device properties
      if (viewport.isMobile || viewport.hasTouch) {
        await page.evaluate((config) => {
          // @ts-ignore
          Object.defineProperty(navigator, 'maxTouchPoints', {
            value: config.hasTouch ? 5 : 0,
            configurable: true,
          })
        }, viewport)
      }
    }
    
    await use(setter)
  },

  // DOM snapshot for bug analysis
  getDOMSnapshot: async ({ page }, use) => {
    const getSnapshot = async () => {
      return page.evaluate(() => {
        // Get a clean DOM snapshot without scripts
        const clone = document.documentElement.cloneNode(true) as HTMLElement
        
        // Remove script tags
        clone.querySelectorAll('script').forEach(el => el.remove())
        
        // Remove style contents but keep structure
        clone.querySelectorAll('style').forEach(el => {
          el.textContent = '/* styles removed */'
        })
        
        // Add computed styles to elements (for layout debugging)
        clone.querySelectorAll('*').forEach((el) => {
          const computed = window.getComputedStyle(el as Element)
          const display = computed.display
          const visibility = computed.visibility
          
          if (display === 'none' || visibility === 'hidden') {
            (el as HTMLElement).setAttribute('data-hidden', 'true')
          }
        })
        
        return clone.outerHTML
      })
    }
    
    await use(getSnapshot)
  },

  // Accessibility tree for a11y testing
  getAccessibilityTree: async ({ page }, use) => {
    const getTree = async () => {
      const snapshot = await page.accessibility.snapshot()
      return JSON.stringify(snapshot, null, 2)
    }
    
    await use(getTree)
  },
})

export { expect }

/**
 * Helper to run a test across multiple viewports
 */
export function testAcrossViewports(
  testName: string,
  viewports: ViewportConfig[],
  testFn: (viewport: ViewportConfig) => Promise<void>
) {
  for (const viewport of viewports) {
    test(`${testName} - ${viewport.name}`, async ({ page, setViewport }) => {
      await setViewport(viewport)
      await testFn(viewport)
    })
  }
}

/**
 * Helper to create bug report data from test failure
 */
export interface BugReportData {
  testName: string
  viewport: ViewportConfig
  url: string
  screenshot: Buffer
  domSnapshot: string
  consoleErrors: ConsoleMessage[]
  networkErrors: NetworkRequest[]
  uncaughtErrors: string[]
  timestamp: string
}

export async function captureBugReportData(
  page: Page,
  testName: string,
  viewport: ViewportConfig,
  captureErrors: () => Promise<{
    console: ConsoleMessage[]
    network: NetworkRequest[]
    uncaughtErrors: string[]
  }>,
  getDOMSnapshot: () => Promise<string>
): Promise<BugReportData> {
  const errors = await captureErrors()
  const domSnapshot = await getDOMSnapshot()
  const screenshot = await page.screenshot({ fullPage: true })
  
  return {
    testName,
    viewport,
    url: page.url(),
    screenshot,
    domSnapshot,
    consoleErrors: errors.console,
    networkErrors: errors.network,
    uncaughtErrors: errors.uncaughtErrors,
    timestamp: new Date().toISOString(),
  }
}
