// Asset behaviors + the Campfire trustless-transaction logic.
// Pure, deterministic: no React/DOM/three. All randomness comes from ctx.prng.

import { distanceM } from '../geo'
import { makeEvent } from './events'
import type { SimEvent, SimEventType } from './events'
import type { PRNG } from './prng'
import type {
  AssetPlacement,
  AssetState,
  ENU,
  Receipt,
  ResourceDeposit,
  Scenario,
  SirosStandard,
} from './types'

const ARRIVAL_THRESHOLD_M = 5

export type SimCounters = {
  receipts: number
  accepted: number
  rejected: number
  deliveredKg: number
  rejectionReasons: Record<string, number>
}

export type SimContext = {
  scenario: Scenario
  prng: PRNG
  standardsById: Record<string, SirosStandard>
  assetsById: Record<string, AssetPlacement>
  states: Record<string, AssetState>
  depositsRemainingKg: Record<string, number>
  receipts: Receipt[]
  events: SimEvent[]
  factory: AssetPlacement
  primaryDeposit: ResourceDeposit
  tick: number
  timeSec: number
  commsOpen: boolean
  counters: SimCounters
}

function emit(
  ctx: SimContext,
  type: SimEventType,
  actorAssetId: string,
  message: string,
  targetAssetId?: string,
  payload?: Record<string, unknown>
): void {
  ctx.events.push(
    makeEvent(
      ctx.tick,
      ctx.timeSec,
      type,
      actorAssetId,
      message,
      targetAssetId,
      payload
    )
  )
}

// Move `state` toward `target` by at most maxSpeedMps * tickSec. Returns true
// once the asset is within the arrival threshold.
function moveToward(
  state: AssetState,
  target: ENU,
  maxSpeedMps: number,
  tickSec: number
): boolean {
  const dx = target.x - state.pos.x
  const dy = target.y - state.pos.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist <= ARRIVAL_THRESHOLD_M) return true
  const step = Math.min(maxSpeedMps * tickSec, dist)
  state.pos = { x: state.pos.x + (dx / dist) * step, y: state.pos.y + (dy / dist) * step }
  return false
}

function recordRejection(ctx: SimContext, reason: string): void {
  ctx.counters.rejected += 1
  ctx.counters.rejectionReasons[reason] =
    (ctx.counters.rejectionReasons[reason] || 0) + 1
}

// The full Campfire interaction between a seller (rover) and a buyer (factory).
// Returns whether the transaction was accepted.
export function attemptTransaction(
  ctx: SimContext,
  seller: AssetPlacement,
  buyer: AssetPlacement
): boolean {
  const sState = ctx.states[seller.id]
  const bState = ctx.states[buyer.id]

  emit(
    ctx,
    'HandshakeStarted',
    seller.id,
    `${seller.name} initiated an identity handshake with ${buyer.name}.`,
    buyer.id
  )

  // 1. Identity (modeled asymmetric challenge/response).
  if (!seller.pubKey || !buyer.pubKey) {
    emit(ctx, 'HandshakeFailed', seller.id, `Identity handshake failed: missing public key.`, buyer.id)
    emit(ctx, 'TransactionRejected', seller.id, `Transaction rejected: identity not verified.`, buyer.id, { reason: 'identity_failed' })
    recordRejection(ctx, 'identity_failed')
    return false
  }
  emit(ctx, 'HandshakeSucceeded', seller.id, `${buyer.name} verified the identity of ${seller.name}.`, buyer.id)

  // 2. SOAR registry lookup.
  emit(ctx, 'CredentialChecked', buyer.id, `${buyer.name} looked up ${seller.name} in the cached SOAR registry.`, seller.id, { class: seller.class })

  // 3. SIROS standards match.
  const stdId = ctx.scenario.standardIds[0]
  const sellerSupports = seller.supportedStandards.includes(stdId)
  const buyerSupports = buyer.supportedStandards.includes(stdId)
  if (!sellerSupports || !buyerSupports) {
    emit(ctx, 'StandardMismatch', buyer.id, `Standard ${stdId} not supported by both parties.`, seller.id, { standard: stdId })
    emit(ctx, 'TransactionRejected', seller.id, `Transaction rejected: standard ${stdId} mismatch.`, buyer.id, { reason: `standard_mismatch:${stdId}` })
    recordRejection(ctx, `standard_mismatch:${stdId}`)
    return false
  }
  emit(ctx, 'StandardMatched', buyer.id, `Both parties support ${stdId}.`, seller.id, { standard: stdId })

  // 4. Credential / stamp check.
  const std = ctx.standardsById[stdId]
  const sellerStamp = 'CAN_SELL_REGOLITH'
  const buyerStamp = 'CAN_BUY_REGOLITH'
  if (std && std.requiredStamps.includes(sellerStamp) && !seller.stamps.includes(sellerStamp)) {
    emit(ctx, 'CredentialRejected', buyer.id, `${seller.name} lacks required credential ${sellerStamp}.`, seller.id, { missing: sellerStamp })
    emit(ctx, 'TransactionRejected', seller.id, `Transaction rejected: missing ${sellerStamp}.`, buyer.id, { reason: `missing_stamp:${sellerStamp}` })
    recordRejection(ctx, `missing_stamp:${sellerStamp}`)
    return false
  }
  if (std && std.requiredStamps.includes(buyerStamp) && !buyer.stamps.includes(buyerStamp)) {
    emit(ctx, 'CredentialRejected', seller.id, `${buyer.name} lacks required credential ${buyerStamp}.`, buyer.id, { missing: buyerStamp })
    emit(ctx, 'TransactionRejected', seller.id, `Transaction rejected: buyer missing ${buyerStamp}.`, buyer.id, { reason: `missing_stamp:${buyerStamp}` })
    recordRejection(ctx, `missing_stamp:${buyerStamp}`)
    return false
  }

  // 5. Price + offline allowance.
  const qtyKg = sState.cargoKg
  if (qtyKg <= 0) {
    emit(ctx, 'TransactionRejected', seller.id, `Transaction rejected: no cargo to sell.`, buyer.id, { reason: 'no_cargo' })
    recordRejection(ctx, 'no_cargo')
    return false
  }
  const price = qtyKg * (seller.pricePerKg ?? 2)
  if (sState.allowanceRemaining < price || bState.allowanceRemaining < price) {
    emit(ctx, 'TransactionRejected', seller.id, `Transaction rejected: insufficient offline allowance for ${price} credits.`, buyer.id, { reason: 'no_allowance', price })
    recordRejection(ctx, 'no_allowance')
    return false
  }

  // 6. Propose, counter-sign, settle into local caches.
  emit(ctx, 'TransactionProposed', seller.id, `${seller.name} proposed selling ${qtyKg}kg regolith for ${price} credits.`, buyer.id, { qtyKg, price })

  ctx.counters.receipts += 1
  const receipt: Receipt = {
    id: `rcpt_${ctx.counters.receipts}`,
    scenarioId: ctx.scenario.id,
    tick: ctx.tick,
    sellerAssetId: seller.id,
    buyerAssetId: buyer.id,
    resourceType: 'regolith',
    quantityKg: qtyKg,
    price,
    currency: 'credits',
    sellerSig: `sig:${seller.id}:${ctx.tick}`,
    buyerSig: `sig:${buyer.id}:${ctx.tick}`,
    settlementStatus: 'pending_downlink',
  }
  ctx.receipts.push(receipt)
  sState.pendingReceipts.push(receipt.id)
  bState.pendingReceipts.push(receipt.id)
  emit(ctx, 'TransactionSigned', seller.id, `Receipt ${receipt.id} counter-signed by both parties.`, buyer.id, { receiptId: receipt.id, qtyKg, price })

  sState.allowanceRemaining -= price
  bState.allowanceRemaining -= price
  emit(ctx, 'AllowanceReduced', seller.id, `${seller.name} offline allowance reduced by ${price} (now ${sState.allowanceRemaining}).`, undefined, { by: price, remaining: sState.allowanceRemaining })
  emit(ctx, 'AllowanceReduced', buyer.id, `${buyer.name} offline allowance reduced by ${price} (now ${bState.allowanceRemaining}).`, undefined, { by: price, remaining: bState.allowanceRemaining })

  sState.cargoKg = 0
  ctx.counters.accepted += 1
  ctx.counters.deliveredKg += qtyKg
  return true
}

// Shared rover logic for both worker and lurker. The only difference between
// them is their credentials/standards, which attemptTransaction enforces.
export function stepRover(ctx: SimContext, asset: AssetPlacement): void {
  const state = ctx.states[asset.id]
  const tickSec = ctx.scenario.tickSec || 1
  const speed = asset.mobility.maxSpeedMps
  const deposit = ctx.primaryDeposit
  const factory = ctx.factory
  const commsRange = Math.min(asset.commsRangeM, factory.commsRangeM)

  switch (state.phase) {
    case 'idle':
    case 'to_deposit': {
      if (state.cargoKg >= asset.cargoCapacityKg) {
        state.phase = 'to_factory'
        return
      }
      state.phase = 'to_deposit'
      const arrived = moveToward(state, deposit.pos, speed, tickSec)
      if (arrived) {
        state.phase = 'mining'
        emit(ctx, 'AssetMoved', asset.id, `${asset.name} arrived at ${deposit.name}.`, undefined, { destination: deposit.id })
      }
      return
    }
    case 'mining': {
      const remaining = ctx.depositsRemainingKg[deposit.id] ?? 0
      if (remaining <= 0 || state.cargoKg >= asset.cargoCapacityKg) {
        state.phase = 'to_factory'
        return
      }
      const rate = asset.extractionRateKgPerSec ?? 1
      const amount = Math.min(rate * tickSec, asset.cargoCapacityKg - state.cargoKg, remaining)
      state.cargoKg += amount
      ctx.depositsRemainingKg[deposit.id] = remaining - amount
      emit(ctx, 'ResourceExtracted', asset.id, `${asset.name} extracted ${amount}kg regolith (cargo ${state.cargoKg}kg).`, undefined, { amountKg: amount, cargoKg: state.cargoKg })
      if (state.cargoKg >= asset.cargoCapacityKg) state.phase = 'to_factory'
      return
    }
    case 'to_factory': {
      if (state.cargoKg <= 0) {
        state.phase = 'to_deposit'
        return
      }
      const dist = distanceM(state.pos, factory.pos)
      if (dist <= commsRange) {
        state.phase = 'trading'
        emit(ctx, 'AssetMoved', asset.id, `${asset.name} entered comms range of ${factory.name}.`, factory.id, { distanceM: Math.round(dist) })
        return
      }
      moveToward(state, factory.pos, speed, tickSec)
      return
    }
    case 'trading': {
      attemptTransaction(ctx, asset, factory)
      // Whether accepted or rejected, head back to mine again.
      state.phase = 'to_deposit'
      return
    }
  }
}

// The factory is stationary; transactions are initiated by sellers.
export function stepFactory(_ctx: SimContext, _asset: AssetPlacement): void {
  // no-op
}

// Settle cached receipts and refill allowances when a comms window opens.
export function flushCaches(ctx: SimContext): void {
  emit(ctx, 'CommunicationWindowOpened', ctx.factory.id, `Communication window opened; flushing transaction caches to Earth.`)

  for (const receipt of ctx.receipts) {
    if (receipt.settlementStatus === 'pending_downlink') {
      receipt.settlementStatus = 'settled'
      emit(ctx, 'SettlementCompleted', receipt.sellerAssetId, `Receipt ${receipt.id} settled for ${receipt.price} credits.`, receipt.buyerAssetId, { receiptId: receipt.id, price: receipt.price })
    }
  }

  const sortedIds = Object.keys(ctx.states).sort()
  for (const id of sortedIds) {
    const state = ctx.states[id]
    const asset = ctx.assetsById[id]
    const flushed = state.pendingReceipts.length
    if (flushed > 0 || state.allowanceRemaining < asset.allowance.maxOfflineRisk) {
      emit(ctx, 'TransactionCacheFlushed', id, `${asset.name} flushed ${flushed} receipt(s); allowance refilled to ${asset.allowance.maxOfflineRisk}.`, undefined, { flushed, refilledTo: asset.allowance.maxOfflineRisk })
    }
    state.pendingReceipts = []
    state.allowanceRemaining = asset.allowance.maxOfflineRisk
  }
}
