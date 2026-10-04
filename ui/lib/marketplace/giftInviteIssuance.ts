/**
 * One marketplace gift payment must mint one citizenship invite, including
 * when the buyer's receipt POST is retried on a different serverless isolate.
 *
 * The purchase route's in-memory tx set does not survive that hop. Reserving
 * the tx hash first, then flipping `issued` only after the invite exists,
 * makes a retry reuse the token. A redeemed invite stays spent: `issued`
 * blocks createInvite from writing the token back.
 */

export type GiftTxRecord = {
  token: string
  payer: string
  issued: boolean
}

export type GiftInviteStore = {
  /** true = this caller won SET NX, false = a record exists, null = store down. */
  insertIfAbsent: (record: GiftTxRecord) => Promise<boolean | null>
  /** null when no record. Throw if the read itself fails. */
  read: () => Promise<GiftTxRecord | null>
  /** Throw if the lookup fails. `missing` covers never-written and consumed. */
  inviteState: (token: string) => Promise<'live' | 'missing'>
  createInvite: (token: string) => Promise<boolean>
  /** Persist `issued: true` on the reserved tx. false if the write did not land. */
  markIssued: () => Promise<boolean>
}

export type GiftIssueResult =
  | { ok: true; token: string; alreadyIssued: boolean }
  | { ok: false; reason: 'unavailable' | 'mismatch' }

export type ReadyGiftToken =
  | { status: 'ready'; token: string }
  | { status: 'absent' }
  | { status: 'mismatch' }
  | { status: 'unavailable' }

export function normalizeGiftPayer(payer: string): string {
  return payer.trim().toLowerCase()
}

/**
 * Link already handed out for this payment. Does not create an invite.
 * `absent` means the caller may still try `issueMarketplaceGiftInvite`.
 */
export async function readyMarketplaceGiftToken(
  store: Pick<GiftInviteStore, 'read'>,
  payer: string
): Promise<ReadyGiftToken> {
  const expected = normalizeGiftPayer(payer)
  if (!expected) return { status: 'unavailable' }
  let existing: GiftTxRecord | null
  try {
    existing = await store.read()
  } catch {
    return { status: 'unavailable' }
  }
  if (!existing?.token || !existing.payer) return { status: 'absent' }
  if (normalizeGiftPayer(existing.payer) !== expected) return { status: 'mismatch' }
  if (!existing.issued) return { status: 'absent' }
  return { status: 'ready', token: existing.token }
}

/**
 * Reserve `tx` (via the store), create the invite once, and mark it issued
 * before returning the token. A second caller gets the same token and does
 * not write another invite.
 */
export async function issueMarketplaceGiftInvite(
  store: GiftInviteStore,
  params: { payer: string; newToken: string }
): Promise<GiftIssueResult> {
  const payer = normalizeGiftPayer(params.payer)
  if (!payer || !params.newToken) return { ok: false, reason: 'unavailable' }

  let inserted: boolean | null
  try {
    inserted = await store.insertIfAbsent({
      token: params.newToken,
      payer,
      issued: false,
    })
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  if (inserted === null) return { ok: false, reason: 'unavailable' }

  let token = params.newToken
  if (!inserted) {
    let existing: GiftTxRecord | null
    try {
      existing = await store.read()
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
    if (!existing?.token || !existing.payer) return { ok: false, reason: 'unavailable' }
    if (normalizeGiftPayer(existing.payer) !== payer) return { ok: false, reason: 'mismatch' }
    token = existing.token
    if (existing.issued) return { ok: true, token, alreadyIssued: true }
  }

  try {
    const state = await store.inviteState(token)
    if (state === 'missing') {
      const created = await store.createInvite(token)
      if (!created) return { ok: false, reason: 'unavailable' }
    }
    const marked = await store.markIssued()
    if (!marked) return { ok: false, reason: 'unavailable' }
    return { ok: true, token, alreadyIssued: state === 'live' }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}
