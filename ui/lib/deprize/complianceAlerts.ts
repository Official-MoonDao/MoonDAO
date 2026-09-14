export type ComplianceAlertKind =
  | 'wallet-denied'
  | 'unmatched-bet'
  | 'direct-buy-review-required'
  | 'reconcile-failed'

export type ComplianceAlert = {
  kind: ComplianceAlertKind
  timestamp: string
  wallet?: string
  country?: string | null
  connectionKind?: string
  reason?: string
  chainId?: number
  deprizeId?: number
  txHash?: string
}

/** Explicit allow-list so a raw IP can never ride along on the payload. */
export function complianceAlertPayload(alert: ComplianceAlert): ComplianceAlert {
  return {
    kind: alert.kind,
    timestamp: alert.timestamp,
    ...(alert.wallet !== undefined ? { wallet: alert.wallet } : {}),
    ...(alert.country !== undefined ? { country: alert.country } : {}),
    ...(alert.connectionKind !== undefined ? { connectionKind: alert.connectionKind } : {}),
    ...(alert.reason !== undefined ? { reason: alert.reason } : {}),
    ...(alert.chainId !== undefined ? { chainId: alert.chainId } : {}),
    ...(alert.deprizeId !== undefined ? { deprizeId: alert.deprizeId } : {}),
    ...(alert.txHash !== undefined ? { txHash: alert.txHash } : {}),
  }
}

/**
 * POST an operator alert. Webhook failure must never change eligibility:
 * log and return false so reconciliation can retry. A missing URL is a
 * no-op outside production and a failure in production.
 */
export async function sendComplianceAlert(alert: ComplianceAlert): Promise<boolean> {
  const payload = complianceAlertPayload(alert)
  const url = process.env.DEPRIZE_COMPLIANCE_WEBHOOK_URL?.trim()
  if (!url) {
    console.warn('[deprize] compliance alert (no webhook configured)', payload)
    return process.env.NEXT_PUBLIC_ENV !== 'prod'
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      console.error('[deprize] compliance webhook HTTP', response.status)
      return false
    }
    return true
  } catch (err) {
    console.error('[deprize] compliance webhook failed', err)
    return false
  }
}
