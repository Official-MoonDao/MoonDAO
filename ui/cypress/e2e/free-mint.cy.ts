describe('Free Mint API', () => {
  const endpoint = '/api/mission/freeMint'

  describe('GET /api/mission/freeMint', () => {
    it('returns 400 when no address is provided', () => {
      cy.request({
        method: 'GET',
        url: endpoint,
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(400)
        expect(res.body.error).to.eq('Address is required.')
      })
    })

    it('returns eligibility data for a valid address', () => {
      // Use a random address that almost certainly has no contributions
      const address = '0x0000000000000000000000000000000000000001'

      cy.request({
        method: 'GET',
        url: `${endpoint}?address=${address}`,
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(200)
        expect(res.body).to.have.property('success', true)
        expect(res.body).to.have.property('data')
        expect(res.body.data).to.have.property('totalPaid')
        expect(res.body.data).to.have.property('eligible')
        // A zero-address should not be eligible
        expect(res.body.data.eligible).to.eq(false)
        expect(res.body.data.totalPaid).to.eq('0')
      })
    })

    it('returns totalPaid as a string (BigInt serialization)', () => {
      const address = '0x0000000000000000000000000000000000000001'

      cy.request({
        method: 'GET',
        url: `${endpoint}?address=${address}`,
      }).then((res) => {
        expect(res.body.data.totalPaid).to.be.a('string')
      })
    })

    it('returns 200 for a known address (subgraph totals may vary by env)', () => {
      const address = '0x2db6d704058e552defe415753465df8df0361846'

      cy.request({
        method: 'GET',
        url: `${endpoint}?address=${address}`,
      }).then((res) => {
        expect(res.status).to.eq(200)
        expect(res.body.success).to.eq(true)
        expect(res.body.data).to.have.property('totalPaid')
        expect(res.body.data).to.have.property('eligible')
        expect(res.body.data.totalPaid).to.be.a('string')
        expect(Number(res.body.data.totalPaid)).to.be.at.least(0)
      })
    })
  })

  describe('POST /api/mission/freeMint', () => {
    it('returns 400 when required fields are missing', () => {
      cy.request({
        method: 'POST',
        url: endpoint,
        body: { address: '0x1234' },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(400)
        expect(res.body.error).to.eq('Mint params not found!')
      })
    })
  })
})
