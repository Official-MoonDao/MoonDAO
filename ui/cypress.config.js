const { defineConfig } = require('cypress')
const dotenv = require('dotenv')
const path = require('path')
const FormData = require('form-data')
const fs = require('fs')
const axios = require('axios')

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
            const testFilePath = path.join(
              __dirname,
              'cypress/fixtures/images/Original.png'
            )

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
            const response = await axios.post(
              `${baseUrl}/api/google/storage/upload`,
              formData,
              {
                headers: {
                  ...formData.getHeaders(),
                },
                timeout: 30000, // 30 second timeout
                validateStatus: () => true, // Don't throw on error status codes
              }
            )

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
            const response = await axios.delete(
              `${baseUrl}/api/google/storage/delete`,
              {
                data: requestBody,
                timeout: 30000,
                validateStatus: () => true,
              }
            )

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
    },
    supportFile: 'cypress/support/component.ts',
  },
})
