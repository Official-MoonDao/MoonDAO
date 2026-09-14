export type DePrizeAttestations = {
  notUsResident: boolean
  notUsEntityOrRepresentative: boolean
  notInsiderOrProxy: boolean
}

export type AcceptanceSubmitState = 'idle' | 'saving' | 'saved' | 'error'

export function areAttestationsAccepted(value: unknown): value is DePrizeAttestations {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    record.notUsResident === true &&
    record.notUsEntityOrRepresentative === true &&
    record.notInsiderOrProxy === true
  )
}

export const EMPTY_ATTESTATIONS: DePrizeAttestations = {
  notUsResident: false,
  notUsEntityOrRepresentative: false,
  notInsiderOrProxy: false,
}

export function canSubmitDePrizeBet(input: {
  termsAccepted: boolean
  attestations: DePrizeAttestations
  eligibilityAllowed: boolean
  eligibilityReady: boolean
  acceptanceState: AcceptanceSubmitState
}): boolean {
  return (
    input.termsAccepted &&
    areAttestationsAccepted(input.attestations) &&
    input.eligibilityAllowed &&
    input.eligibilityReady &&
    input.acceptanceState === 'saved'
  )
}
