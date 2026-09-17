import {
  isProtocolPayer,
  normalizeProtocolAddress,
} from '@/lib/deprize/payerClassification'
import {
  DEPRIZE_FEE_ROUTER_ADDRESSES,
  DEPRIZE_MINT_ADDRESSES,
} from 'const/config'

describe('payerClassification', () => {
  const sepoliaMint = DEPRIZE_MINT_ADDRESSES.sepolia
  const sepoliaFee = DEPRIZE_FEE_ROUTER_ADDRESSES.sepolia

  it('normalizes checksum, lowercase, uppercase, and missing 0x', () => {
    const expected = sepoliaMint.toLowerCase()
    expect(normalizeProtocolAddress(sepoliaMint)).to.equal(expected)
    expect(normalizeProtocolAddress(sepoliaMint.toLowerCase())).to.equal(expected)
    expect(normalizeProtocolAddress(sepoliaMint.toUpperCase())).to.equal(expected)
    expect(normalizeProtocolAddress(sepoliaMint.slice(2))).to.equal(expected)
    expect(normalizeProtocolAddress('')).to.equal(null)
    expect(normalizeProtocolAddress('0xdead')).to.equal(null)
  })

  it('matches mint and fee-router on the configured chain only', () => {
    expect(isProtocolPayer(sepoliaMint, 'sepolia')).to.equal(true)
    expect(isProtocolPayer(sepoliaMint.toUpperCase(), 'sepolia')).to.equal(true)
    expect(isProtocolPayer(sepoliaFee, 'sepolia')).to.equal(true)
    expect(isProtocolPayer(sepoliaMint, 'arbitrum')).to.equal(false)
    expect(isProtocolPayer(DEPRIZE_MINT_ADDRESSES.arbitrum, 'sepolia')).to.equal(false)
  })

  it('rejects a near-miss address and empty config slots', () => {
    const nearMiss = sepoliaMint.slice(0, -1) + (sepoliaMint.endsWith('8') ? '9' : '8')
    expect(isProtocolPayer(nearMiss, 'sepolia')).to.equal(false)
    expect(isProtocolPayer(sepoliaMint, 'arbitrum-sepolia')).to.equal(false)
    expect(isProtocolPayer(null, 'sepolia')).to.equal(false)
  })
})
