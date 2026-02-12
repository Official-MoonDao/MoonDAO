/**
 * Tests that API routes removed as part of the security fix are no longer
 * reachable.  A 404 is the ideal response; in some dev environments the
 * server may return 500 due to unrelated SSR issues (e.g. walletconnect),
 * so we accept either as "not accessible."
 *
 * Removed routes:
 *  - /api/google/docs/fetch   (unauthenticated SSRF – fetched arbitrary URLs)
 *  - /api/proposals/send-confirmation-email (unauthenticated email sending)
 */
describe('Removed API Routes', () => {
  describe('/api/google/docs/fetch (removed)', () => {
    it('should not return a successful response for GET requests', () => {
      cy.request({
        method: 'GET',
        url: '/api/google/docs/fetch',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([404, 500])
        // Must NOT return 200 — the route should be gone
        expect(response.status).to.not.eq(200)
      })
    })

    it('should not return a successful response for POST requests', () => {
      cy.request({
        method: 'POST',
        url: '/api/google/docs/fetch',
        body: { url: 'https://docs.google.com/document/d/fake-id/edit' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([404, 500])
        expect(response.status).to.not.eq(200)
      })
    })
  })

  describe('/api/proposals/send-confirmation-email (removed)', () => {
    it('should not return a successful response for GET requests', () => {
      cy.request({
        method: 'GET',
        url: '/api/proposals/send-confirmation-email',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([404, 500])
        expect(response.status).to.not.eq(200)
      })
    })

    it('should not return a successful response for POST requests', () => {
      cy.request({
        method: 'POST',
        url: '/api/proposals/send-confirmation-email',
        body: { to: 'test@example.com', subject: 'test' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([404, 500])
        expect(response.status).to.not.eq(200)
      })
    })
  })
})

export {}
