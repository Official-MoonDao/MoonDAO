import { defineConfig } from 'cypress'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  experimentalWebKitSupport: true,
  e2e: {
    setupNodeEvents(on, config) {
      config.env = {
        ...config.env,
        ...process.env,
      }

      on('task', {
        log(message) {
          console.log(message)
          return null
        },
      })

      return config
    },
    specPattern: 'cypress/e2e/**/*.cy.{js,ts,jsx,tsx}',
    baseUrl: 'http://localhost:3000',
    supportFile: false,
  },
  component: {
    setupNodeEvents(on, config) {
      config.env = {
        ...config.env,
        ...process.env,
      }

      on('task', {
        log(message) {
          console.log(message)
          return null
        },
      })

      return config
    },
    specPattern: 'cypress/integration/**/*.cy.{js,ts,jsx,tsx}',
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    supportFile: 'cypress/support/component.ts',
  },
})
