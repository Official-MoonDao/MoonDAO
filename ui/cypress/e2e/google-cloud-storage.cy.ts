describe('Google Cloud Storage API', () => {
  let uploadedFileUrl: string
  let uploadedFilename: string

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
      cy.fixture('images/Original.png', 'binary').then((fileContent) => {
        const blob = Cypress.Blob.binaryStringToBlob(fileContent, 'image/png')
        const formData = new FormData()
        formData.append('file', blob, 'test-image.png')

        cy.request({
          method: 'POST',
          url: '/api/google/storage/upload',
          body: formData,
          timeout: 30000,
        }).then((response) => {
          // Log response for debugging
          cy.log('Upload response status:', response.status)
          cy.log('Upload response body:', JSON.stringify(response.body))

          // Verify successful response
          expect(response.status).to.eq(200)
          expect(response.body).to.have.property('message', 'File uploaded')
          expect(response.body).to.have.property('url')
          expect(response.body.url).to.be.a('string')
          expect(response.body.url).to.include('googleapis.com')

          // Store for deletion test
          uploadedFileUrl = response.body.url

          // Extract filename from URL for deletion test
          const urlParts = uploadedFileUrl.split('/')
          uploadedFilename = urlParts.slice(4).join('/')

          cy.log('Stored uploadedFileUrl:', uploadedFileUrl)
          cy.log('Stored uploadedFilename:', uploadedFilename)
        })
      })
    })
  })

  describe('File Delete API (/api/google/storage/delete)', () => {
    beforeEach(() => {
      // Only upload if we don't already have a file to test with
      if (!uploadedFileUrl || !uploadedFilename) {
        cy.fixture('images/Original.png', 'binary').then((fileContent) => {
          const blob = Cypress.Blob.binaryStringToBlob(fileContent, 'image/png')
          const formData = new FormData()
          formData.append('file', blob, 'test-delete.png')

          cy.request({
            method: 'POST',
            url: '/api/google/storage/upload',
            body: formData,
            timeout: 30000,
          }).then((response) => {
            cy.log('BeforeEach upload response:', JSON.stringify(response.body))

            if (response.body && response.body.url) {
              uploadedFileUrl = response.body.url
              const urlParts = uploadedFileUrl.split('/')
              uploadedFilename = urlParts.slice(4).join('/')
              cy.log('BeforeEach stored uploadedFileUrl:', uploadedFileUrl)
              cy.log('BeforeEach stored uploadedFilename:', uploadedFilename)
            } else {
              cy.log('⚠️ Upload response missing URL property')
            }
          })
        })
      }
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

      cy.request({
        method: 'DELETE',
        url: '/api/google/storage/delete',
        body: {
          filename: uploadedFilename,
        },
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property(
          'message',
          'File deleted successfully'
        )
        expect(response.body).to.have.property('filename', uploadedFilename)

        // Clear the variables after successful deletion
        uploadedFileUrl = ''
        uploadedFilename = ''
      })
    })

    it('should successfully delete a file using URL', () => {
      // Upload a new file for this test
      cy.fixture('images/Original.png', 'binary').then((fileContent) => {
        const blob = Cypress.Blob.binaryStringToBlob(fileContent, 'image/png')
        const formData = new FormData()
        formData.append('file', blob, 'test-delete-by-url.png')

        cy.request({
          method: 'POST',
          url: '/api/google/storage/upload',
          body: formData,
          timeout: 30000,
        }).then((uploadResponse) => {
          cy.log(
            'Delete test upload response:',
            JSON.stringify(uploadResponse.body)
          )

          expect(uploadResponse.body).to.have.property('url')
          const fileUrl = uploadResponse.body.url
          const urlParts = fileUrl.split('/')
          const filename = urlParts.slice(4).join('/')

          // Delete using URL (testing POST method for delete)
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

  describe('Integration Test: Upload and Delete Workflow', () => {
    it('should upload a file and then successfully delete it', () => {
      let testFileUrl: string
      let testFilename: string

      // Step 1: Upload a file
      cy.fixture('images/Original.png', 'binary').then((fileContent) => {
        const blob = Cypress.Blob.binaryStringToBlob(fileContent, 'image/png')
        const formData = new FormData()
        formData.append('file', blob, 'integration-test-' + Date.now() + '.png')

        cy.request({
          method: 'POST',
          url: '/api/google/storage/upload',
          body: formData,
          timeout: 30000,
        }).then((uploadResponse) => {
          cy.log(
            'Integration test upload response:',
            JSON.stringify(uploadResponse.body)
          )

          expect(uploadResponse.status).to.eq(200)
          expect(uploadResponse.body).to.have.property('url')
          testFileUrl = uploadResponse.body.url

          // Extract filename from URL
          const urlParts = testFileUrl.split('/')
          testFilename = urlParts.slice(4).join('/')

          // Step 2: Verify file was uploaded by checking URL format
          expect(testFileUrl).to.include('googleapis.com')
          expect(testFileUrl).to.include('integration-test')

          // Step 3: Delete the uploaded file
          cy.request({
            method: 'DELETE',
            url: '/api/google/storage/delete',
            body: {
              filename: testFilename,
            },
          }).then((deleteResponse) => {
            expect(deleteResponse.status).to.eq(200)
            expect(deleteResponse.body.message).to.eq(
              'File deleted successfully'
            )

            // Step 4: Verify file is actually deleted by trying to delete again
            cy.request({
              method: 'DELETE',
              url: '/api/google/storage/delete',
              body: {
                filename: testFilename,
              },
              failOnStatusCode: false,
            }).then((secondDeleteResponse) => {
              expect(secondDeleteResponse.status).to.eq(404)
              expect(secondDeleteResponse.body.error).to.eq('File not found')
            })
          })
        })
      })
    })
  })
})

export {}
