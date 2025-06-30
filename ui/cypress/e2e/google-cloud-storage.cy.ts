describe('Google Cloud Storage API', () => {
  let uploadedFileUrl: string
  let uploadedFilename: string

  // Check if required environment variables are available
  before(() => {
    cy.task('checkEnvVars', ['GCS_CREDENTIALS', 'GCS_BUCKET_NAME']).then(
      (result: any) => {
        if (!result.allPresent) {
          cy.log('⚠️ Missing environment variables:', result.missing.join(', '))
        }
      }
    )
  })

  describe('File Upload API (/api/google/storage/upload)', () => {
    it('should return 405 for invalid HTTP method', () => {
      cy.request({
        method: 'GET',
        url: '/api/google/storage/upload',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(405)
        expect(response.body).to.have.property('error', 'Method not allowed')
      })
    })

    it('should return 400 when no file is uploaded', () => {
      cy.request({
        method: 'POST',
        url: '/api/google/storage/upload',
        body: {},
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('error', 'No file uploaded')
      })
    })

    it('should successfully upload a file and return a signed URL', () => {
      const fileName = 'test-image.png'

      cy.task('uploadToGoogleCloudStorage', {
        baseUrl: Cypress.config('baseUrl'),
        fileName: fileName,
      }).then((response: any) => {
        // Verify successful response
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('message', 'File uploaded')
        expect(response.body).to.have.property('url')
        expect(response.body.url).to.be.a('string')
        expect(response.body.url).to.include('googleapis.com')

        // Store for deletion test
        uploadedFileUrl = response.body.url

        // Extract filename from URL for deletion test - remove query parameters
        const urlWithoutQuery = uploadedFileUrl.split('?')[0] // Remove query parameters first
        const urlParts = urlWithoutQuery.split('/')
        uploadedFilename = urlParts[urlParts.length - 1] // Get the last part which is the filename
      })
    })
  })

  describe('File Delete API (/api/google/storage/delete)', () => {
    beforeEach(() => {
      // Upload a fresh file for delete tests to avoid race conditions
      const fileName = 'test-delete-' + Date.now() + '.png'

      cy.task('uploadToGoogleCloudStorage', {
        baseUrl: Cypress.config('baseUrl'),
        fileName: fileName,
      }).then((response: any) => {
        if (response.status === 200 && response.body && response.body.url) {
          uploadedFileUrl = response.body.url
          const urlWithoutQuery = uploadedFileUrl.split('?')[0] // Remove query parameters first
          const urlParts = urlWithoutQuery.split('/')
          uploadedFilename = urlParts[urlParts.length - 1] // Get the last part which is the filename
        } else {
          // Set dummy values to prevent undefined errors
          uploadedFileUrl = 'UPLOAD_FAILED'
          uploadedFilename = 'UPLOAD_FAILED'
        }
      })
    })

    it('should return 405 for invalid HTTP method', () => {
      cy.request({
        method: 'GET',
        url: '/api/google/storage/delete',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(405)
        expect(response.body).to.have.property('error', 'Method not allowed')
      })
    })

    it('should return 400 when neither filename nor url is provided', () => {
      cy.request({
        method: 'DELETE',
        url: '/api/google/storage/delete',
        body: {},
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property(
          'error',
          'Either filename or url is required'
        )
      })
    })

    it('should return 404 when trying to delete a non-existent file', () => {
      cy.request({
        method: 'DELETE',
        url: '/api/google/storage/delete',
        body: {
          filename: 'non-existent-file-' + Date.now() + '.png',
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('error', 'File not found')
      })
    })

    it('should return 400 for invalid URL format', () => {
      cy.request({
        method: 'DELETE',
        url: '/api/google/storage/delete',
        body: {
          url: 'invalid-url-format',
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property(
          'error',
          'Invalid filename or url'
        )
      })
    })

    it('should successfully delete a file using filename', () => {
      // Ensure we have a filename to delete
      expect(uploadedFilename).to.exist
      expect(uploadedFilename).to.be.a('string')
      expect(uploadedFilename.length).to.be.greaterThan(0)

      cy.task('deleteFromGoogleCloudStorage', {
        baseUrl: Cypress.config('baseUrl'),
        filename: uploadedFilename,
      }).then((response: any) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property(
          'message',
          'File deleted successfully'
        )
        expect(response.body).to.have.property('filename', uploadedFilename)
      })
    })

    it('should successfully delete a file using URL', () => {
      const fileName = 'test-delete-by-url.png'

      // Upload a new file for this test
      cy.task('uploadToGoogleCloudStorage', {
        baseUrl: Cypress.config('baseUrl'),
        fileName: fileName,
      }).then((uploadResponse: any) => {
        expect(uploadResponse.status).to.eq(200)
        expect(uploadResponse.body).to.have.property('url')

        const fileUrl = uploadResponse.body.url
        const urlWithoutQuery = fileUrl.split('?')[0] // Remove query parameters first
        const urlParts = urlWithoutQuery.split('/')
        const filename = urlParts[urlParts.length - 1] // Get the last part which is the filename

        // Delete using URL
        cy.request({
          method: 'POST',
          url: '/api/google/storage/delete',
          body: {
            url: fileUrl,
          },
        }).then((deleteResponse) => {
          expect(deleteResponse.status).to.eq(200)
          expect(deleteResponse.body).to.have.property(
            'message',
            'File deleted successfully'
          )
          expect(deleteResponse.body).to.have.property('filename', filename)
        })
      })
    })
  })
})

export {}
