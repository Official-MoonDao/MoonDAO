import {
  areAttestationsAccepted,
  canSubmitDePrizeBet,
  EMPTY_ATTESTATIONS,
} from '@/lib/deprize/attestations'

const valid = {
  notUsResident: true,
  notUsEntityOrRepresentative: true,
  notInsiderOrProxy: true,
}

describe('deprize attestations', () => {
  it('accepts only three literal true booleans', () => {
    expect(areAttestationsAccepted(valid)).to.equal(true)
  })

  it('rejects missing, false, or extra-type values', () => {
    expect(areAttestationsAccepted(undefined)).to.equal(false)
    expect(areAttestationsAccepted(null)).to.equal(false)
    expect(areAttestationsAccepted(EMPTY_ATTESTATIONS)).to.equal(false)
    expect(areAttestationsAccepted({ ...valid, notUsResident: false })).to.equal(false)
    expect(areAttestationsAccepted({ ...valid, notUsEntityOrRepresentative: false })).to.equal(
      false
    )
    expect(areAttestationsAccepted({ ...valid, notInsiderOrProxy: false })).to.equal(false)
    expect(areAttestationsAccepted({ ...valid, notUsResident: 'true' })).to.equal(false)
    expect(areAttestationsAccepted({ ...valid, notUsResident: 1 })).to.equal(false)
    expect(
      areAttestationsAccepted({
        notUsResident: true,
        notUsEntityOrRepresentative: true,
      })
    ).to.equal(false)
  })

  it('does not enable a bet while acceptance is saving or failed', () => {
    const ready = {
      termsAccepted: true,
      attestations: valid,
      eligibilityAllowed: true,
      eligibilityReady: true,
    }
    expect(canSubmitDePrizeBet({ ...ready, acceptanceState: 'saved' })).to.equal(true)
    expect(canSubmitDePrizeBet({ ...ready, acceptanceState: 'saving' })).to.equal(false)
    expect(canSubmitDePrizeBet({ ...ready, acceptanceState: 'error' })).to.equal(false)
    expect(canSubmitDePrizeBet({ ...ready, acceptanceState: 'idle' })).to.equal(false)
    expect(
      canSubmitDePrizeBet({ ...ready, termsAccepted: false, acceptanceState: 'saved' })
    ).to.equal(false)
  })
})
