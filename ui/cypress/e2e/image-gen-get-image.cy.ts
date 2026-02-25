describe('Image Gen - Get Image API (SSRF Protection)', () => {
  const endpoint = '/api/image-gen/get-image'

  // -----------------------------------------------------------------------
  // Method validation
  // -----------------------------------------------------------------------
  describe('HTTP method validation', () => {
    it('should return 405 for GET requests', () => {
      cy.request({
        method: 'GET',
        url: endpoint,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(405)
        expect(response.body).to.eq('Method not allowed')
      })
    })

    it('should return 405 for DELETE requests', () => {
      cy.request({
        method: 'DELETE',
        url: endpoint,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(405)
      })
    })
  })

  // -----------------------------------------------------------------------
  // SSRF protection — these MUST all be blocked
  // -----------------------------------------------------------------------
  describe('SSRF protection - blocked URLs', () => {
    const blockedUrls = [
      {
        name: 'cloud metadata endpoint (AWS)',
        url: 'http://169.254.169.254/latest/meta-data/',
      },
      {
        name: 'cloud metadata endpoint (GCP)',
        url: 'http://metadata.google.internal/computeMetadata/v1/',
      },
      {
        name: 'localhost',
        url: 'http://localhost:3000/api/secret',
      },
      {
        name: 'loopback IP',
        url: 'http://127.0.0.1/admin',
      },
      {
        name: 'private network (10.x)',
        url: 'http://10.0.0.1/internal',
      },
      {
        name: 'private network (192.168.x)',
        url: 'http://192.168.1.1/',
      },
      {
        name: 'file:// protocol',
        url: 'file:///etc/passwd',
      },
      {
        name: 'ftp:// protocol',
        url: 'ftp://evil.com/payload',
      },
      {
        name: 'arbitrary external domain',
        url: 'https://evil-attacker.com/exfiltrate',
      },
      {
        name: 'http:// on allowed hostname (must be https)',
        url: 'http://r2.comfy.icu/image.png',
      },
      {
        name: 'allowed hostname with explicit port',
        url: 'https://r2.comfy.icu:8443/image.png',
      },
      {
        name: 'subdomain spoofing (r2.comfy.icu.evil.com)',
        url: 'https://r2.comfy.icu.evil.com/image.png',
      },
    ]

    blockedUrls.forEach(({ name, url }) => {
      it(`should block ${name}`, () => {
        cy.request({
          method: 'POST',
          url: endpoint,
          body: { url },
          headers: { 'Content-Type': 'application/json' },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(400)
          expect(response.body).to.eq('Invalid or disallowed URL')
        })
      })
    })
  })

  // -----------------------------------------------------------------------
  // Input validation
  // -----------------------------------------------------------------------
  describe('Input validation', () => {
    it('should return 400 when url field is missing', () => {
      cy.request({
        method: 'POST',
        url: endpoint,
        body: {},
        headers: { 'Content-Type': 'application/json' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400)
      })
    })

    it('should return 400 when url is a number', () => {
      cy.request({
        method: 'POST',
        url: endpoint,
        body: { url: 12345 },
        headers: { 'Content-Type': 'application/json' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400)
      })
    })

    it('should return 400 when url is a malformed string', () => {
      cy.request({
        method: 'POST',
        url: endpoint,
        body: { url: 'not-a-valid-url' },
        headers: { 'Content-Type': 'application/json' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400)
      })
    })

    it('should return 400 when url is an empty string', () => {
      cy.request({
        method: 'POST',
        url: endpoint,
        body: { url: '' },
        headers: { 'Content-Type': 'application/json' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400)
      })
    })

    it('should return 400 when url is null', () => {
      cy.request({
        method: 'POST',
        url: endpoint,
        body: { url: null },
        headers: { 'Content-Type': 'application/json' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400)
      })
    })
  })

  // -----------------------------------------------------------------------
  // Allowed URL — happy path (will fail upstream since no real image exists,
  // but it proves the URL passes validation and fetch is attempted)
  // -----------------------------------------------------------------------
  describe('Allowed URLs', () => {
    it('should accept a valid https://r2.comfy.icu URL (passes validation)', () => {
      cy.request({
        method: 'POST',
        url: endpoint,
        body: { url: 'https://r2.comfy.icu/some-nonexistent-test-image.png' },
        headers: { 'Content-Type': 'application/json' },
        failOnStatusCode: false,
      }).then((response) => {
        // The URL passes validation, so we should NOT get a 400.
        // We expect either a 200 (image found) or 500 (upstream error / image not found).
        expect(response.status).to.not.eq(400)
        expect(response.status).to.be.oneOf([200, 500])
      })
    })
  })
})

export {}
