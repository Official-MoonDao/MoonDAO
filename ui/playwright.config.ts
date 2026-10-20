import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './playwright',
  timeout: 180000,
  expect: { timeout: 90000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    ...devices['Pixel 5'],
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'yarn dev --hostname 127.0.0.1 --port 3000',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: true,
        timeout: 180000,
      },
})
