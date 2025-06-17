const { defineConfig } = require('cypress')

module.exports = defineConfig({
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
  typescript: {
    enable: true,
  },
  // Add these settings for local testing
  video: false,
  screenshotOnRunFailure: true,
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 10000,
})
