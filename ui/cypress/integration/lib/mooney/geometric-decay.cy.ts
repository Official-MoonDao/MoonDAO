import {
  DEFAULT_DECAY_CONFIG,
  calculateGeometricDecay,
  formatQuarterLabel,
  formatValue,
  generateQuarterlyData,
  getDecayScheduleInfo,
} from '@/lib/mooney/utils/geometricDecay'

describe('geometricDecay', () => {
  describe('calculateGeometricDecay', () => {
    it('calculates first quarter correctly', () => {
      const result = calculateGeometricDecay(15_000_000, 0.05, 0)
      expect(result).to.equal(15_000_000)
    })

    it('calculates decay correctly for subsequent quarters', () => {
      const result = calculateGeometricDecay(15_000_000, 0.05, 1)
      expect(result).to.equal(15_000_000 * 0.95)
    })

    it('handles different reduction rates', () => {
      const result = calculateGeometricDecay(15_000_000, 0.1, 1)
      expect(result).to.equal(15_000_000 * 0.9)
    })
  })

  describe('formatQuarterLabel', () => {
    it('formats quarter label correctly', () => {
      expect(formatQuarterLabel(2022, 4)).to.equal('Q4 22')
      expect(formatQuarterLabel(2023, 1)).to.equal('Q1 23')
    })
  })

  describe('formatValue', () => {
    it('formats millions correctly', () => {
      expect(formatValue(15_000_000)).to.equal('15.0M')
      expect(formatValue(1_000_000)).to.equal('1.0M')
    })

    it('formats thousands correctly', () => {
      expect(formatValue(15_000)).to.equal('15.0K')
    })

    it('formats small values correctly', () => {
      expect(formatValue(100)).to.equal('100')
    })
  })

  describe('generateQuarterlyData', () => {
    it('generates expected number of quarters', () => {
      const data = generateQuarterlyData(DEFAULT_DECAY_CONFIG, 7)
      expect(data).to.have.length(7)
    })

    it('generates data with required properties', () => {
      const data = generateQuarterlyData(DEFAULT_DECAY_CONFIG, 3)
      data.forEach((point) => {
        expect(point).to.have.property('quarter')
        expect(point).to.have.property('year')
        expect(point).to.have.property('quarterNumber')
        expect(point).to.have.property('value')
        expect(point).to.have.property('valueDisplay')
        expect(point).to.have.property('x')
        expect(point).to.have.property('y')
      })
    })

    it('first quarter matches starting amount', () => {
      const data = generateQuarterlyData(DEFAULT_DECAY_CONFIG, 1)
      expect(data[0].value).to.equal(DEFAULT_DECAY_CONFIG.startingAmount)
    })

    it('values decrease over time', () => {
      const data = generateQuarterlyData(DEFAULT_DECAY_CONFIG, 5)
      for (let i = 1; i < data.length; i++) {
        expect(data[i].value).to.be.lessThan(data[i - 1].value)
      }
    })
  })

  describe('getDecayScheduleInfo', () => {
    it('returns schedule info with required properties', () => {
      const info = getDecayScheduleInfo()
      expect(info).to.have.property('startingQuarter')
      expect(info).to.have.property('startingAmount')
      expect(info).to.have.property('reductionRate')
      expect(info).to.have.property('reductionRatePercent')
      expect(info).to.have.property('scheduleType')
      expect(info).to.have.property('lockPeriod')
    })

    it('reductionRatePercent is correct', () => {
      const info = getDecayScheduleInfo()
      expect(info.reductionRatePercent).to.equal(5)
    })
  })
})

