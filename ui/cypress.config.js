const { defineConfig } = require('cypress')
const dotenv = require('dotenv')
const path = require('path')
const browserstackTestObservabilityPlugin = require('browserstack-cypress-cli/bin/testObservability/plugin')

dotenv.config({ path: path.resolve(__dirname, '.env.local') })

module.exports = defineConfig({
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

      browserstackTestObservabilityPlugin(on, config)

      return config
    },
    specPattern: 'cypress/e2e/**/*.cy.{js,ts,jsx,tsx}',
    baseUrl: 'http://localhost:3000',
    supportFile: false,
    requestTimeout: 30000,
    responseTimeout: 30000,
    pageLoadTimeout: 30000,
    defaultCommandTimeout: 30000,
    video: false,
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
