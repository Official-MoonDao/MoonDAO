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

      // Ensure specPattern is set before cypress-split runs
      if (!config.specPattern) {
        config.specPattern = integrationPattern
      } else if (typeof config.specPattern === 'string') {
        // Ensure it's the integration pattern, not e2e
        if (config.specPattern.includes('/e2e/') || !config.specPattern.includes('/integration/')) {
          config.specPattern = integrationPattern
        }
      }

      // Set environment variable to disable code splitting in Next.js config
      process.env.CYPRESS_COMPONENT_TEST = 'true'

      // Log cypress-split environment variables for debugging
      // cypress-split uses: SPLIT (total) and SPLIT_INDEX (0-based)
      const splitTotal = process.env.SPLIT
      const splitIndex = process.env.SPLIT_INDEX

      console.log('[Cypress Config] Environment check:')
      console.log(
        `  process.env.SPLIT: ${splitTotal || 'undefined'} (should be total containers, e.g. 4)`
      )
      console.log(
        `  process.env.SPLIT_INDEX: ${
          splitIndex || 'undefined'
        } (should be 0-based index, e.g. 0,1,2,3)`
      )

      if (splitTotal && splitIndex !== undefined) {
        console.log(
          `[Cypress Config] ✓ cypress-split env vars detected: SPLIT=${splitTotal}, SPLIT_INDEX=${splitIndex}`
        )
      } else {
        console.warn(
          '[Cypress Config] ⚠️ cypress-split env vars NOT detected - all containers will run ALL tests!'
        )
        console.warn('[Cypress Config] This means tests will be duplicated across all containers.')
      }

      // Apply cypress-split for test parallelization
      // cypress-split expects: SPLIT (total containers) and SPLIT_INDEX (0-based index)
      try {
        const splitConfig = cypressSplit(on, config)
        if (splitConfig) {
          config = splitConfig
          console.log(
            `[Cypress Config] ✓ cypress-split applied. specPattern type: ${
              Array.isArray(config.specPattern) ? 'array' : typeof config.specPattern
            }`
          )
          if (Array.isArray(config.specPattern)) {
            console.log(
              `[Cypress Config] ✓ Split into ${config.specPattern.length} specs for this container`
            )
          }
        } else {
          console.warn('[Cypress Config] ⚠️ cypress-split returned no config modification')
        }
      } catch (error) {
        console.error('[Cypress Config] ✗ Error in cypress-split:', error.message)
        console.error('[Cypress Config] Error stack:', error.stack)
        // Continue without splitting if there's an error
      }

      // Ensure specPattern is valid after cypress-split
      // cypress-split converts specPattern to an array of specific files when SPLIT env vars are set
      if (Array.isArray(config.specPattern)) {
        // Filter out any e2e tests that might have snuck in
        const beforeCount = config.specPattern.length
        config.specPattern = config.specPattern.filter(
          (spec) => String(spec).includes('/integration/') && !String(spec).includes('/e2e/')
        )
        if (config.specPattern.length === 0) {
          console.error(
            '[Cypress Config] ERROR: No valid specs after cypress-split, using default pattern'
          )
          config.specPattern = integrationPattern
        } else if (beforeCount !== config.specPattern.length) {
          console.log(
            `[Cypress Config] Filtered ${beforeCount - config.specPattern.length} invalid specs`
          )
        }
        console.log(`[Cypress Config] Running ${config.specPattern.length} specs in this container`)
        if (config.specPattern.length <= 5) {
          console.log(`[Cypress Config] Specs: ${config.specPattern.join(', ')}`)
        } else {
          console.log(
            `[Cypress Config] First 5 specs: ${config.specPattern.slice(0, 5).join(', ')}...`
          )
        }
      } else if (typeof config.specPattern === 'string') {
        // Ensure it's a valid integration pattern
        if (!config.specPattern.includes('/integration/') || config.specPattern.includes('/e2e/')) {
          console.warn(
            `[Cypress Config] Invalid specPattern: ${config.specPattern}, resetting to default`
          )
          config.specPattern = integrationPattern
        }
        console.log(`[Cypress Config] Using specPattern: ${config.specPattern}`)
      } else {
        console.error(
          `[Cypress Config] ERROR: specPattern is unexpected type: ${typeof config.specPattern}, resetting to default`
        )
        config.specPattern = integrationPattern
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
    specPattern: 'cypress/integration/**/*.cy.{js,ts,jsx,tsx}',
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
