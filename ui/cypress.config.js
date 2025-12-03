const { defineConfig } = require('cypress')
const dotenv = require('dotenv')
const path = require('path')
const FormData = require('form-data')
const fs = require('fs')
const axios = require('axios')
const cypressSplit = require('cypress-split')

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
        checkEnvVars(varNames) {
          const missing = varNames.filter((name) => !process.env[name])
          return {
            allPresent: missing.length === 0,
            missing,
            present: varNames.filter((name) => process.env[name]),
            values: varNames.reduce((acc, name) => {
              acc[name] = process.env[name] ? 'SET' : 'MISSING'
              return acc
            }, {}),
          }
        },
        async uploadToGoogleCloudStorage({ baseUrl, filePath, fileName }) {
          try {
            // Create FormData using Node.js FormData
            const formData = new FormData()

            // Create a test file or use existing file
            const testFilePath = path.join(__dirname, 'cypress/fixtures/images/Original.png')

            // Check if file exists
            if (!fs.existsSync(testFilePath)) {
              console.error('❌ Test file not found at:', testFilePath)
              return {
                status: 500,
                ok: false,
                body: { error: 'Test file not found' },
                headers: {},
              }
            }

            // Use buffer with axios
            const fileBuffer = fs.readFileSync(testFilePath)

            formData.append('file', fileBuffer, {
              filename: fileName || 'test-upload.png',
              contentType: 'image/png',
            })

            // Use axios instead of fetch - axios handles FormData much better
            const response = await axios.post(`${baseUrl}/api/google/storage/upload`, formData, {
              headers: {
                ...formData.getHeaders(),
              },
              timeout: 30000, // 30 second timeout
              validateStatus: () => true, // Don't throw on error status codes
            })

            return {
              status: response.status,
              ok: response.status >= 200 && response.status < 300,
              body: response.data,
              headers: response.headers,
            }
          } catch (error) {
            console.error('❌ GCS Upload failed:', error.message)
            return {
              status: 500,
              ok: false,
              body: { error: error.message, stack: error.stack },
              headers: {},
            }
          }
        },
        async deleteFromGoogleCloudStorage({ baseUrl, filename, url }) {
          try {
            const requestBody = {}
            if (filename) requestBody.filename = filename
            if (url) requestBody.url = url

            // Use axios for delete as well
            const response = await axios.delete(`${baseUrl}/api/google/storage/delete`, {
              data: requestBody,
              timeout: 30000,
              validateStatus: () => true,
            })

            return {
              status: response.status,
              ok: response.status >= 200 && response.status < 300,
              body: response.data,
              headers: response.headers,
            }
          } catch (error) {
            console.error('❌ GCS Delete failed:', error.message)
            return {
              status: 500,
              ok: false,
              body: { error: error.message },
              headers: {},
            }
          }
        },
      })

      return config
    },
    specPattern: 'cypress/e2e/**/*.cy.{js,ts,jsx,tsx}',
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    requestTimeout: 60000,
    responseTimeout: 60000,
    pageLoadTimeout: 120000,
    defaultCommandTimeout: 60000,
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
  },
  component: {
    setupNodeEvents(on, config) {
      // Ensure config exists and has required properties
      if (!config) {
        config = {}
      }
      if (!config.env) {
        config.env = {}
      }

      const integrationPattern = 'cypress/integration/**/*.cy.{js,ts,jsx,tsx}'

      if (!config.specPattern) {
        config.specPattern = integrationPattern
        console.log(`[Cypress Config] Set initial specPattern to: ${integrationPattern}`)
      } else if (typeof config.specPattern === 'string') {
        if (config.specPattern.includes('/e2e/')) {
          // If somehow E2E tests got in, replace with integration pattern
          console.warn(
            '[Cypress Config] Warning: E2E tests detected in specPattern, replacing with integration pattern'
          )
          config.specPattern = integrationPattern
        } else if (!config.specPattern.includes('/integration/')) {
          // Ensure it includes integration directory
          console.warn(
            '[Cypress Config] Warning: specPattern does not include /integration/, replacing'
          )
          config.specPattern = integrationPattern
        }
      } else if (Array.isArray(config.specPattern)) {
        // Filter out any E2E tests if it's already an array
        const beforeFilter = config.specPattern.length
        config.specPattern = config.specPattern.filter(
          (spec) => !String(spec).includes('/e2e/') && String(spec).includes('/integration/')
        )
        if (beforeFilter !== config.specPattern.length) {
          console.warn(
            `[Cypress Config] Filtered ${
              beforeFilter - config.specPattern.length
            } E2E tests from array`
          )
        }
        if (config.specPattern.length === 0) {
          console.error(
            '[Cypress Config] ERROR: No valid specs after initial filter, using default pattern'
          )
          config.specPattern = integrationPattern
        }
      }

      // Set environment variable to disable code splitting in Next.js config
      process.env.CYPRESS_COMPONENT_TEST = 'true'

      try {
        const splitConfig = cypressSplit(on, config)
        if (splitConfig) {
          config = splitConfig
        }

        const originalSpecCount = Array.isArray(config.specPattern)
          ? config.specPattern.length
          : typeof config.specPattern === 'string' && config.specPattern.includes(',')
          ? config.specPattern.split(',').length
          : 'unknown'

        if (Array.isArray(config.specPattern)) {
          config.specPattern = config.specPattern.filter(
            (spec) => !spec.includes('/e2e/') && spec.includes('/integration/')
          )
        } else if (typeof config.specPattern === 'string') {
          if (config.specPattern.includes(',')) {
            const specs = config.specPattern
              .split(',')
              .map((s) => s.trim())
              .filter((spec) => !spec.includes('/e2e/') && spec.includes('/integration/'))
            config.specPattern =
              specs.length > 0 ? specs : 'cypress/integration/**/*.cy.{js,ts,jsx,tsx}'
            console.log(
              `[Cypress Config] Filtered specs: ${originalSpecCount} -> ${specs.length} (removed E2E tests)`
            )
            if (specs.length === 0) {
              console.error(
                '[Cypress Config] ERROR: No valid specs after filtering! This will cause tests to hang.'
              )
            } else {
              console.log(
                `[Cypress Config] Valid specs after filtering: ${specs.slice(0, 5).join(', ')}${
                  specs.length > 5 ? '...' : ''
                }`
              )
            }
          } else {
            if (!config.specPattern.includes('/integration/')) {
              config.specPattern = 'cypress/integration/**/*.cy.{js,ts,jsx,tsx}'
            }
          }
        }
      } catch (error) {
        console.error('[Cypress Config] Error in cypress-split:', error.message)
        console.error('[Cypress Config] Error stack:', error.stack)
        // Continue without splitting if there's an error
      }

      config.env = {
        ...config.env,
        ...process.env,
      }

      on('task', {
        log(message) {
          console.log(message)
          return null
        },
        checkEnvVars(varNames) {
          const missing = varNames.filter((name) => !process.env[name])
          return {
            allPresent: missing.length === 0,
            missing,
            present: varNames.filter((name) => process.env[name]),
            values: varNames.reduce((acc, name) => {
              acc[name] = process.env[name] ? 'SET' : 'MISSING'
              return acc
            }, {}),
          }
        },
      })

      return config
    },
    // specPattern is set in setupNodeEvents so cypress-split can modify it
    devServer: {
      framework: 'next',
      bundler: 'webpack',
      webpackConfig: (webpackConfig) => {
        const port =
          process.env.CYPRESS_WEBPACK_DEV_SERVER_PORT || process.env.PORT
            ? parseInt(process.env.CYPRESS_WEBPACK_DEV_SERVER_PORT || process.env.PORT)
            : 8080

        // Disable code splitting to prevent ChunkLoadError in Cypress component tests
        // This is a known issue where webpack chunks aren't served correctly by Cypress
        if (!webpackConfig) {
          console.error('[Cypress Config] ERROR: webpackConfig is null/undefined!')
          return {
            mode: 'development',
            optimization: {},
            devServer: {
              port: port,
            },
          }
        }

        // Set port in webpack devServer config
        if (!webpackConfig.devServer) {
          webpackConfig.devServer = {}
        }
        webpackConfig.devServer.port = port

        webpackConfig.optimization = webpackConfig.optimization || {}

        delete webpackConfig.optimization.splitChunks

        webpackConfig.optimization.runtimeChunk = false

        if (webpackConfig.output) {
          delete webpackConfig.output.chunkFilename
        } else {
          webpackConfig.output = {}
        }

        // Suppress webpack cache restoration warnings
        if (!webpackConfig.infrastructureLogging) {
          webpackConfig.infrastructureLogging = {}
        }
        webpackConfig.infrastructureLogging.level = 'error'

        webpackConfig.cache = false

        return webpackConfig
      },
    },
    supportFile: 'cypress/support/component.ts',
    excludeSpecPattern: ['**/node_modules/**', '**/dist/**'],
    video: false,
  },
})
