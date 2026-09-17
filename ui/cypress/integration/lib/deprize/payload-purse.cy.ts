import fs from 'fs'
import path from 'path'
import { canSubmitDePrizeBet, EMPTY_ATTESTATIONS } from '@/lib/deprize/attestations'
import { DEPRIZE_TERMS_VERSION } from '@/lib/deprize/constants'
import { evaluateEligibility } from '@/lib/deprize/eligibility'
import {
  PAYLOAD_COPY_KEYS,
  PAYLOAD_PROPOSED_TOKEN,
  describePayloadTier,
  payloadCopy,
  payloadCopyMode,
} from '@/lib/deprize/payloadPurse'

const UI_ROOT = path.resolve(__dirname, '../../../../')

describe('payloadCopyMode', () => {
  it('is proposed for the live Terms constant', () => {
    expect(DEPRIZE_TERMS_VERSION).to.equal('1.1')
    expect(payloadCopyMode(DEPRIZE_TERMS_VERSION)).to.equal('proposed')
  })

  it('compares versions by numeric segment, not lexicographically', () => {
    expect(payloadCopyMode('1.1')).to.equal('proposed')
    expect(payloadCopyMode('1.1.9')).to.equal('proposed')
    expect(payloadCopyMode('')).to.equal('proposed')
    expect(payloadCopyMode('abc')).to.equal('proposed')
    expect(payloadCopyMode(undefined as any)).to.equal('proposed')
    expect(payloadCopyMode('1.2')).to.equal('in-force')
    expect(payloadCopyMode('1.10')).to.equal('in-force')
    expect(payloadCopyMode('2.0')).to.equal('in-force')
  })

  it('proposed copy never makes an unqualified payload claim', () => {
    for (const key of PAYLOAD_COPY_KEYS) {
      const text = payloadCopy(key, 'proposed')
      const mentionsPayload = /payload/i.test(text)
      const hasToken = PAYLOAD_PROPOSED_TOKEN.test(text)
      expect(mentionsPayload && !hasToken, `${key}: ${text}`).to.equal(false)
      expect(/buys? the (community )?payload/i.test(text) && !hasToken, key).to.equal(false)
    }
  })
})

describe('describePayloadTier', () => {
  it('returns unknown when the USD quote is missing or invalid', () => {
    for (const input of [undefined, null, NaN, Infinity, -1]) {
      const tier = describePayloadTier(input as any)
      expect(tier.id, String(input)).to.equal('unknown')
      expect(tier.nextThresholdUsd).to.equal(null)
      expect(tier.blurb).to.match(/USD quote/i)
      expect(tier.blurb).to.not.match(/buys|purchase/i)
    }
  })

  it('rounds to the nearest $500 before bracketing', () => {
    expect(describePayloadTier(0).id).to.equal('nameplate')
    expect(describePayloadTier(4_700).id).to.equal('nameplate')
    expect(describePayloadTier(4_800).id).to.equal('data-capsule')
    expect(describePayloadTier(5_000).id).to.equal('data-capsule')
    expect(describePayloadTier(24_000).id).to.equal('data-capsule')
    expect(describePayloadTier(24_800).id).to.equal('larger-slot')
    expect(describePayloadTier(25_000).id).to.equal('larger-slot')
    expect(describePayloadTier(1e6).id).to.equal('larger-slot')
  })

  it('exposes the next threshold', () => {
    expect(describePayloadTier(0).nextThresholdUsd).to.equal(5_000)
    expect(describePayloadTier(5_000).nextThresholdUsd).to.equal(25_000)
    expect(describePayloadTier(25_000).nextThresholdUsd).to.equal(null)
  })
})

describe('payload opt-in leak tests', () => {
  const base = {
    country: 'CH',
    isVpnOrProxy: false,
    isSanctioned: false,
    screeningFailed: false,
    wallet: '0x1234567890123456789012345678901234567890',
  }

  it('payload opt-in does not change eligibility', () => {
    const clean = evaluateEligibility(base)
    const withOptIn = evaluateEligibility({
      ...base,
      payloadNameOptIn: true,
      payloadDisplayName: 'MoonDAO Official',
    } as any)
    expect(withOptIn).to.deep.equal(clean)

    const submitBase = {
      termsAccepted: true,
      attestations: {
        notUsResident: true,
        notUsEntityOrRepresentative: true,
        notInsiderOrProxy: true,
      },
      eligibilityAllowed: true,
      eligibilityReady: true,
      acceptanceState: 'saved' as const,
    }
    expect(canSubmitDePrizeBet(submitBase)).to.equal(true)
    expect(
      canSubmitDePrizeBet({
        ...submitBase,
        payloadNameOptIn: true,
        payloadDisplayName: 'MoonDAO Official',
      } as any)
    ).to.equal(true)
    expect(EMPTY_ATTESTATIONS.notUsResident).to.equal(false)
  })

  it('payload opt-in is not referenced on the eligibility or permit path', () => {
    const files = [
      'lib/deprize/eligibility.ts',
      'lib/deprize/attestations.ts',
      'pages/api/deprize/permit.ts',
    ]
    for (const rel of files) {
      const text = fs.readFileSync(path.join(UI_ROOT, rel), 'utf8')
      expect(text, rel).to.not.match(/payloadNameOptIn|payloadDisplayName/)
    }
  })
})
