import {
  TOKEN_DISTRIBUTION_DATA,
  TOTAL_SUPPLY,
  TOTAL_SUPPLY_DISPLAY,
  DISTRIBUTION_LAST_UPDATED,
} from '@/lib/mooney/utils/tokenData'

describe('tokenData', () => {
  it('exports TOKEN_DISTRIBUTION_DATA as expected array', () => {
    expect(TOKEN_DISTRIBUTION_DATA).to.be.an('array')
    expect(TOKEN_DISTRIBUTION_DATA.length).to.be.greaterThan(0)
  })

  it('each distribution segment has required properties', () => {
    TOKEN_DISTRIBUTION_DATA.forEach((segment) => {
      expect(segment).to.have.property('name')
      expect(segment).to.have.property('value')
      expect(segment).to.have.property('color')
      expect(segment).to.have.property('amount')
      expect(segment).to.have.property('description')
    })
  })

  it('distribution values sum to approximately 100', () => {
    const total = TOKEN_DISTRIBUTION_DATA.reduce((sum, item) => sum + item.value, 0)
    expect(total).to.be.closeTo(100, 1)
  })

  it('exports TOTAL_SUPPLY constant', () => {
    expect(TOTAL_SUPPLY).to.be.a('number')
    expect(TOTAL_SUPPLY).to.equal(2.53)
  })

  it('exports TOTAL_SUPPLY_DISPLAY constant', () => {
    expect(TOTAL_SUPPLY_DISPLAY).to.be.a('string')
    expect(TOTAL_SUPPLY_DISPLAY).to.equal('2.53B')
  })

  it('exports DISTRIBUTION_LAST_UPDATED constant', () => {
    expect(DISTRIBUTION_LAST_UPDATED).to.be.a('string')
    expect(DISTRIBUTION_LAST_UPDATED.length).to.be.greaterThan(0)
  })
})

