/**
 * Coinbase guest checkout phone normalization (headless, mocha + chai).
 */
import { expect } from 'chai'
import {
  sameGuestCheckoutPhone,
  toGuestCheckoutPhone,
} from '../../../lib/coinbase/guestCheckoutPhone'
import { splitBackdropBlur } from '../../../lib/layout/splitBackdropBlur'

const BUY_MODAL_CLASS =
  'fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex flex-col justify-start items-center z-[9999] overflow-y-auto bg-gradient-to-t from-[#3F3FA690] via-[#00000080] to-transparent animate-fadeIn py-6 px-4'

describe('guest checkout phone', () => {
  it('accepts a 10-digit US number', () => {
    expect(toGuestCheckoutPhone('5551234567')).to.equal('+15551234567')
    expect(toGuestCheckoutPhone('(555) 123-4567')).to.equal('+15551234567')
  })

  it('accepts a number that already includes the US country code', () => {
    expect(toGuestCheckoutPhone('1 555 123 4567')).to.equal('+15551234567')
    expect(toGuestCheckoutPhone('+1 (555) 123-4567')).to.equal('+15551234567')
  })

  it('rejects numbers that are not US', () => {
    expect(toGuestCheckoutPhone('+447911123456')).to.equal(null)
    expect(toGuestCheckoutPhone('555')).to.equal(null)
    expect(toGuestCheckoutPhone('')).to.equal(null)
  })

  it('treats equivalent US formats as the same number', () => {
    expect(sameGuestCheckoutPhone('(555) 123-4567', '+15551234567')).to.equal(true)
    expect(sameGuestCheckoutPhone('5551234567', '5550000000')).to.equal(false)
  })
})

describe('buy modal backdrop blur', () => {
  it('moves backdrop-blur off the scrolling overlay and behind it', () => {
    const split = splitBackdropBlur(BUY_MODAL_CLASS)
    expect(split.scrollClassName).to.not.include('backdrop-blur')
    expect(split.scrollClassName).to.include('overflow-y-auto')
    expect(split.scrollClassName).to.include('z-[9999]')
    expect(split.blurClassName).to.equal('backdrop-blur-sm')
    expect(split.blurZClassName).to.equal('z-[9998]')
  })

  it('leaves overlays without a blur layer unchanged', () => {
    const className = 'fixed inset-0 z-[1000] overflow-auto'
    const split = splitBackdropBlur(className)
    expect(split.scrollClassName).to.equal(className)
    expect(split.blurClassName).to.equal(null)
  })
})
