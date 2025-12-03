import { formUtils } from '../../../../lib/utils/forms'

describe('Form Utilities', () => {
  describe('validateRequired', () => {
    it('Should return valid for non-empty string', () => {
      const result = formUtils.validateRequired('test', 'username')
      expect(result.isValid).to.be.true
    })

    it('Should return invalid for empty string', () => {
      const result = formUtils.validateRequired('', 'username')
      expect(result.isValid).to.be.false
      expect(result.error).to.include('username')
    })

    it('Should return invalid for whitespace only', () => {
      const result = formUtils.validateRequired('   ', 'username')
      expect(result.isValid).to.be.false
    })

    it('Should return invalid for null', () => {
      const result = formUtils.validateRequired(null, 'username')
      expect(result.isValid).to.be.false
    })

    it('Should return invalid for undefined', () => {
      const result = formUtils.validateRequired(undefined, 'username')
      expect(result.isValid).to.be.false
    })
  })

  describe('validateEmail', () => {
    it('Should return valid for valid email', () => {
      const result = formUtils.validateEmail('test@example.com')
      expect(result.isValid).to.be.true
    })

    it('Should return invalid for email without @', () => {
      const result = formUtils.validateEmail('testexample.com')
      expect(result.isValid).to.be.false
      expect(result.error).to.include('email')
    })

    it('Should return invalid for empty string', () => {
      const result = formUtils.validateEmail('')
      expect(result.isValid).to.be.false
    })
  })

  describe('validateUrl', () => {
    it('Should return valid for valid URL', () => {
      const result = formUtils.validateUrl('https://example.com')
      expect(result.isValid).to.be.true
    })

    it('Should return valid for http URL', () => {
      const result = formUtils.validateUrl('http://example.com')
      expect(result.isValid).to.be.true
    })

    it('Should return invalid for invalid URL', () => {
      const result = formUtils.validateUrl('not-a-url')
      expect(result.isValid).to.be.false
      expect(result.error).to.include('URL')
    })

    it('Should return invalid for empty string', () => {
      const result = formUtils.validateUrl('')
      expect(result.isValid).to.be.false
    })
  })

  describe('validateEthereumAddress', () => {
    it('Should return valid for valid Ethereum address', () => {
      const result = formUtils.validateEthereumAddress(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
      )
      expect(result.isValid).to.be.true
    })

    it('Should return valid for lowercase address', () => {
      const result = formUtils.validateEthereumAddress(
        '0x742d35cc6634c0532925a3b844bc9e7595f0beb0'
      )
      expect(result.isValid).to.be.true
    })

    it('Should return invalid for address without 0x prefix', () => {
      const result = formUtils.validateEthereumAddress(
        '742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'
      )
      expect(result.isValid).to.be.false
      expect(result.error).to.include('Ethereum address')
    })

    it('Should return invalid for address with wrong length', () => {
      const result = formUtils.validateEthereumAddress('0x123')
      expect(result.isValid).to.be.false
    })

    it('Should return invalid for address with invalid characters', () => {
      const result = formUtils.validateEthereumAddress(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0beXY'
      )
      expect(result.isValid).to.be.false
    })
  })

  describe('validateMinLength', () => {
    it('Should return valid for string meeting minimum length', () => {
      const result = formUtils.validateMinLength('password123', 8, 'password')
      expect(result.isValid).to.be.true
    })

    it('Should return valid for string exceeding minimum length', () => {
      const result = formUtils.validateMinLength('verylongpassword', 8, 'password')
      expect(result.isValid).to.be.true
    })

    it('Should return invalid for string below minimum length', () => {
      const result = formUtils.validateMinLength('short', 8, 'password')
      expect(result.isValid).to.be.false
      expect(result.error).to.include('8')
      expect(result.error).to.include('password')
    })
  })

  describe('validateNumber', () => {
    it('Should return valid for numeric string', () => {
      const result = formUtils.validateNumber('42', 'age')
      expect(result.isValid).to.be.true
    })

    it('Should return valid for number', () => {
      const result = formUtils.validateNumber(42, 'age')
      expect(result.isValid).to.be.true
    })

    it('Should return valid for decimal number', () => {
      const result = formUtils.validateNumber('3.14', 'price')
      expect(result.isValid).to.be.true
    })

    it('Should return invalid for non-numeric string', () => {
      const result = formUtils.validateNumber('abc', 'age')
      expect(result.isValid).to.be.false
      expect(result.error).to.include('number')
    })
  })

  describe('validateMinValue', () => {
    it('Should return valid for value above minimum', () => {
      const result = formUtils.validateMinValue(10, 5, 'age')
      expect(result.isValid).to.be.true
    })

    it('Should return valid for value equal to minimum', () => {
      const result = formUtils.validateMinValue(5, 5, 'age')
      expect(result.isValid).to.be.true
    })

    it('Should return invalid for value below minimum', () => {
      const result = formUtils.validateMinValue(3, 5, 'age')
      expect(result.isValid).to.be.false
      expect(result.error).to.include('5')
    })
  })

  describe('validateDate', () => {
    it('Should return valid for valid Date object', () => {
      const result = formUtils.validateDate(new Date(), 'deadline')
      expect(result.isValid).to.be.true
    })

    it('Should return valid for valid date string', () => {
      const result = formUtils.validateDate('2024-12-31', 'deadline')
      expect(result.isValid).to.be.true
    })

    it('Should return valid for valid timestamp', () => {
      const result = formUtils.validateDate(Date.now(), 'deadline')
      expect(result.isValid).to.be.true
    })

    it('Should return invalid for invalid date string', () => {
      const result = formUtils.validateDate('invalid-date', 'deadline')
      expect(result.isValid).to.be.false
      expect(result.error).to.include('date')
    })
  })

  describe('validateFutureDate', () => {
    it('Should return valid for future date', () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)
      const result = formUtils.validateFutureDate(futureDate, 'deadline')
      expect(result.isValid).to.be.true
    })

    it('Should return invalid for past date', () => {
      const pastDate = new Date()
      pastDate.setFullYear(pastDate.getFullYear() - 1)
      const result = formUtils.validateFutureDate(pastDate, 'deadline')
      expect(result.isValid).to.be.false
      expect(result.error).to.include('future')
    })

    it('Should return invalid for current date', () => {
      const result = formUtils.validateFutureDate(new Date(), 'deadline')
      expect(result.isValid).to.be.false
    })

    it('Should return invalid for invalid date', () => {
      const result = formUtils.validateFutureDate('invalid-date', 'deadline')
      expect(result.isValid).to.be.false
    })
  })

  describe('cleanFormData', () => {
    it('Should trim string values', () => {
      const data = {
        username: '  john  ',
        email: '  test@example.com  ',
      }
      const cleaned = formUtils.cleanFormData(data)
      expect(cleaned.username).to.equal('john')
      expect(cleaned.email).to.equal('test@example.com')
    })

    it('Should preserve non-string values', () => {
      const data = {
        age: 25,
        active: true,
        tags: ['a', 'b'],
      }
      const cleaned = formUtils.cleanFormData(data)
      expect(cleaned.age).to.equal(25)
      expect(cleaned.active).to.be.true
      expect(cleaned.tags).to.deep.equal(['a', 'b'])
    })

    it('Should handle mixed data types', () => {
      const data = {
        name: '  Alice  ',
        age: 30,
        isAdmin: false,
      }
      const cleaned = formUtils.cleanFormData(data)
      expect(cleaned.name).to.equal('Alice')
      expect(cleaned.age).to.equal(30)
      expect(cleaned.isAdmin).to.be.false
    })
  })
})

