// Event vocabulary for the MoonSim deterministic engine.
// Pure data: no React, no DOM, no three.js.

export const SIM_EVENT_TYPES = [
  'AssetMoved',
  'ResourceExtracted',
  'HandshakeStarted',
  'HandshakeSucceeded',
  'HandshakeFailed',
  'CredentialChecked',
  'CredentialRejected',
  'StandardMatched',
  'StandardMismatch',
  'TransactionProposed',
  'TransactionSigned',
  'TransactionRejected',
  'AllowanceReduced',
  'CommunicationWindowOpened',
  'TransactionCacheFlushed',
  'SettlementCompleted',
] as const

export type SimEventType = (typeof SIM_EVENT_TYPES)[number]

export type SimEvent = {
  tick: number
  timeSec: number
  type: SimEventType
  actorAssetId: string
  targetAssetId?: string
  payload?: Record<string, unknown>
  message: string
}

export function makeEvent(
  tick: number,
  timeSec: number,
  type: SimEventType,
  actorAssetId: string,
  message: string,
  targetAssetId?: string,
  payload?: Record<string, unknown>
): SimEvent {
  const e: SimEvent = { tick, timeSec, type, actorAssetId, message }
  if (targetAssetId !== undefined) e.targetAssetId = targetAssetId
  if (payload !== undefined) e.payload = payload
  return e
}
