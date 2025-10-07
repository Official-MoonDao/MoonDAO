// Import necessary Playwright and Synpress modules
import { defineConfig, devices } from '@playwright/test'

// Define Playwright configuration
export default defineConfig({
  testDir: './tests',
  timeout: 90000, // Increase global test timeout
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    // Set base URL for tests
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      launchOptions: {
        args: [
          '--temporary-unexpire-flags-m139',
          '--temporary-unexpire-flags-m140',
          '--allow-legacy-mv2-extensions',
        ],
      },
    },
  ],
})
