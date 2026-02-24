import { defineConfig, devices } from '@playwright/test'
import path from 'path'

/**
 * Playwright configuration for MoonDAO bug detection agent
 * Supports multi-browser, multi-viewport testing with wallet mocking
 */
export default defineConfig({
  testDir: './playwright/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright/reports/html' }],
    ['json', { outputFile: 'playwright/reports/results.json' }],
    ['list'],
  ],
  
  outputDir: 'playwright/results',
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Capture console logs for bug analysis
    contextOptions: {
      logger: {
        isEnabled: () => true,
        log: (name, severity, message) => {
          console.log(`[${severity}] ${name}: ${message}`)
        },
      },
    },
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'webkit-desktop',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    // Tablet viewports
    {
      name: 'chromium-tablet',
      use: { 
        ...devices['iPad Pro'],
      },
    },
    {
      name: 'webkit-tablet',
      use: { 
        ...devices['iPad Pro'],
        browserName: 'webkit',
      },
    },

    // Mobile viewports
    {
      name: 'chromium-mobile',
      use: { 
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'webkit-mobile',
      use: { 
        ...devices['iPhone 14 Pro'],
      },
    },

    // Exploratory testing project (agent-driven)
    {
      name: 'exploratory',
      testDir: './playwright/tests/exploratory',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Extended timeouts for exploratory testing
        actionTimeout: 30000,
        navigationTimeout: 60000,
      },
    },
  ],

  // Web server configuration for local testing
  webServer: process.env.CI ? undefined : {
    command: 'yarn dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
