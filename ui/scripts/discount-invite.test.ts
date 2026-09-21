import { expect } from 'chai'
import {
  FULL_DISCOUNT_BPS,
  buildInviteQuote,
  discountOfferLabel,
  dueWei,
  isFullDiscount,
  isPaymentTxHash,
  parseDiscountBps,
  percentOffToBps,
  resolveDiscountBps,
  shouldAddInviteToDiscountList,
  validateDiscountPayment,
} from '../lib/citizen/discountInvite'

const PAYER = '0x0000000000000000000000000000000000000001'
const PAY_TO = '0x0000000000000000000000000000000000000002'
const OTHER = '0x0000000000000000000000000000000000000003'

const YEAR = BigInt('11100000000000000') // 0.0111 ETH

describe('discount rate parsing', () => {
  it('treats a missing stored rate as fully sponsored', () => {
    expect(resolveDiscountBps(undefined)).to.equal(FULL_DISCOUNT_BPS)
    expect(resolveDiscountBps(null)).to.equal(FULL_DISCOUNT_BPS)
    expect(resolveDiscountBps('')).to.equal(FULL_DISCOUNT_BPS)
  })

  it('accepts only the three presets', () => {
    expect(resolveDiscountBps(200)).to.equal(200)
    expect(resolveDiscountBps('500')).to.equal(500)
    expect(resolveDiscountBps(1000)).to.equal(1000)
    expect(resolveDiscountBps(20)).to.equal(null)
    expect(resolveDiscountBps(250)).to.equal(null)
    expect(resolveDiscountBps('20%')).to.equal(null)
  })

  it('defaults an omitted issuer value to 100% and rejects anything else', () => {
    expect(parseDiscountBps(undefined, { defaultFull: true })).to.equal(1000)
    expect(parseDiscountBps('', { defaultFull: true })).to.equal(1000)
    expect(parseDiscountBps(undefined)).to.equal(null)
    expect(parseDiscountBps(200)).to.equal(200)
    expect(parseDiscountBps('500')).to.equal(500)
    expect(parseDiscountBps('1000')).to.equal(1000)
    expect(parseDiscountBps(50)).to.equal(null)
    expect(parseDiscountBps('abc')).to.equal(null)
  })

  it('maps percent-off flags to parts per thousand', () => {
    expect(percentOffToBps(20)).to.equal(200)
    expect(percentOffToBps(50)).to.equal(500)
    expect(percentOffToBps(100)).to.equal(1000)
    expect(percentOffToBps(25)).to.equal(null)
    expect(isFullDiscount(1000)).to.equal(true)
    expect(isFullDiscount(200)).to.equal(false)
    expect(discountOfferLabel(200)).to.equal('20% off')
    expect(discountOfferLabel(1000)).to.equal('100% off (free)')
  })
})

describe('dueWei', () => {
  it('charges 80% at 20% off and 50% at 50% off', () => {
    expect(dueWei(YEAR, 200)).to.equal((YEAR * BigInt(800)) / BigInt(1000))
    expect(dueWei(YEAR, 500)).to.equal(YEAR / BigInt(2))
    expect(dueWei(YEAR, 1000)).to.equal(BigInt(0))
  })

  it('truncates the remainder the way the citizen contract does', () => {
    const awkward = BigInt(999)
    expect(dueWei(awkward, 200)).to.equal(BigInt(799))
  })
})

describe('buildInviteQuote', () => {
  it('keeps a 100% invite sponsored with no amount due', () => {
    const quote = buildInviteQuote({
      discountBps: 1000,
      alreadyFreeEligible: false,
      fullPriceWei: YEAR,
      payTo: PAY_TO,
    })
    expect(quote.sponsored).to.equal(true)
    expect(quote).to.not.have.property('dueWei')
  })

  it('quotes a partial invite against the full price and the sponsor address', () => {
    const quote = buildInviteQuote({
      discountBps: 200,
      alreadyFreeEligible: false,
      fullPriceWei: YEAR,
      payTo: PAY_TO,
    })
    expect(quote.sponsored).to.equal(false)
    if (!quote.sponsored) {
      expect(quote.dueWei).to.equal(dueWei(YEAR, 200).toString())
      expect(quote.fullPriceWei).to.equal(YEAR.toString())
      expect(quote.payTo).to.equal(PAY_TO)
      expect(quote.discountBps).to.equal(200)
    }
  })

  it('does not charge a wallet that already qualifies for a free mint', () => {
    const quote = buildInviteQuote({
      discountBps: 500,
      alreadyFreeEligible: true,
      fullPriceWei: YEAR,
      payTo: PAY_TO,
    })
    expect(quote.sponsored).to.equal(true)
    expect(quote.discountBps).to.equal(500)
  })
})

describe('shouldAddInviteToDiscountList', () => {
  it('adds only fully sponsored redemptions', () => {
    expect(
      shouldAddInviteToDiscountList({ partialDiscount: false, consumedInvite: true })
    ).to.equal(true)
    expect(shouldAddInviteToDiscountList({ partialDiscount: true, consumedInvite: true })).to.equal(
      false
    )
    expect(
      shouldAddInviteToDiscountList({ partialDiscount: false, consumedInvite: false })
    ).to.equal(false)
  })
})

describe('validateDiscountPayment', () => {
  const valid = {
    from: PAYER,
    to: PAY_TO,
    valueWei: dueWei(YEAR, 200),
    status: 1,
    payer: PAYER,
    payTo: PAY_TO,
    dueWei: dueWei(YEAR, 200),
  }

  it('accepts an exact payment and a small overpayment', () => {
    expect(validateDiscountPayment(valid).ok).to.equal(true)
    const over = validateDiscountPayment({ ...valid, valueWei: valid.valueWei + BigInt(1) })
    expect(over.ok).to.equal(true)
  })

  it('matches addresses case-insensitively', () => {
    const result = validateDiscountPayment({
      ...valid,
      from: PAYER.toUpperCase(),
      to: PAY_TO.toUpperCase(),
    })
    expect(result.ok).to.equal(true)
  })

  it('rejects the wrong sender, recipient, failed tx, and unconfirmed tx', () => {
    expect(validateDiscountPayment({ ...valid, from: OTHER }).ok).to.equal(false)
    expect(validateDiscountPayment({ ...valid, from: OTHER })).to.include({ code: 'wrong_sender' })
    expect(validateDiscountPayment({ ...valid, to: OTHER })).to.include({ code: 'wrong_recipient' })
    expect(validateDiscountPayment({ ...valid, status: 0 })).to.include({ code: 'failed' })
    expect(validateDiscountPayment({ ...valid, status: null })).to.include({ code: 'failed' })
  })

  it('reports an underpayment separately so the caller can refund it', () => {
    const result = validateDiscountPayment({ ...valid, valueWei: valid.valueWei - BigInt(1) })
    expect(result.ok).to.equal(false)
    if (!result.ok) {
      expect(result.code).to.equal('underpaid')
      expect(result.paidWei).to.equal(valid.valueWei - BigInt(1))
    }
  })

  it('rejects a malformed transaction', () => {
    expect(validateDiscountPayment({ ...valid, from: null }).ok).to.equal(false)
    expect(validateDiscountPayment({ ...valid, to: null })).to.include({ code: 'invalid' })
    expect(isPaymentTxHash('0x' + 'ab'.repeat(32))).to.equal(true)
    expect(isPaymentTxHash('0xabc')).to.equal(false)
    expect(isPaymentTxHash('not-a-hash')).to.equal(false)
  })
})
