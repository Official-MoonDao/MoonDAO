/**
 * Vendor notification-email resolution for marketplace purchases.
 *
 * Two independent failure modes have dropped vendor emails in production:
 *
 * 1. Team id. For ERC20 listings the purchase tx's `to` is the token (or a
 *    router), not the vendor, so `getOwnedNFTs(tx.to)` is empty. Prefer the
 *    listing row's teamId; fall back to the on-chain recipient and, last, the
 *    client-sent teamId (already on every buy payload).
 *
 * 2. Typeform email. The team onboarding form does not collect an email
 *    (`formatTeamFormData` has no email field). Vendors only get a Typeform
 *    email if they later submit the optional "update email" form. When that
 *    is missing, look up the citizen Typeform email of the team NFT owner —
 *    and, when the owner is a Safe, each Safe owner. The A Heart for Space
 *    listing (#32, team #22) is this case: a 1-of-1 Safe whose owner holds
 *    a citizen profile with an email.
 *
 * This module is I/O-free so the decision can be unit-tested. The purchase
 * API supplies Tableland / Typeform / chain / Safe lookups.
 */

export function normalizeTeamId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) return null
  return String(n)
}

export function resolveVendorTeamId(params: {
  listingTeamId?: unknown
  onchainTeamTokenId?: unknown
  clientTeamId?: unknown
}): string | null {
  return (
    normalizeTeamId(params.listingTeamId) ||
    normalizeTeamId(params.onchainTeamTokenId) ||
    normalizeTeamId(params.clientTeamId)
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_RE.test(value.trim())
}

/**
 * Pull an email out of a Typeform `answers` array. Prefers explicit email
 * fields, then any answer whose text looks like an email (some forms use
 * short_text for contact).
 */
export function extractEmailFromTypeformAnswers(answers: unknown): string | null {
  if (!Array.isArray(answers)) return null

  const candidates: string[] = []
  const preferred: string[] = []

  for (const answer of answers) {
    if (!answer || typeof answer !== 'object') continue
    const a = answer as {
      type?: string
      email?: unknown
      text?: unknown
      value?: unknown
      field?: { type?: string }
    }
    const isEmailField = a.type === 'email' || a.field?.type === 'email'
    for (const raw of [a.email, a.text, a.value]) {
      if (!isValidEmail(raw)) continue
      const email = raw.trim()
      if (isEmailField) preferred.push(email)
      else candidates.push(email)
    }
  }

  return preferred[0] || candidates[0] || null
}

export function safeTransactionApiUrl(chainSlug: string): string | null {
  if (chainSlug === 'arbitrum') {
    return 'https://safe-transaction-arbitrum.safe.global'
  }
  if (chainSlug === 'sepolia') {
    return 'https://safe-transaction-sepolia.safe.global'
  }
  if (chainSlug === 'ethereum' || chainSlug === 'mainnet') {
    return 'https://safe-transaction-mainnet.safe.global'
  }
  return null
}

export type VendorEmailLookupDeps = {
  getTeamFormId: (teamId: string) => Promise<string | null>
  fetchTypeformEmail: (formIds: string[], responseId: string) => Promise<string | null>
  getTeamOwner: (teamId: string) => Promise<string | null>
  getSafeOwners: (address: string) => Promise<string[]>
  getCitizenFormId: (wallet: string) => Promise<string | null>
  teamFormIds: string[]
  citizenFormIds: string[]
}

/**
 * Best-effort vendor email. Team Typeform first; if that response has no
 * email, the citizen Typeform of the team owner / Safe owners.
 */
export async function lookupVendorEmail(
  teamId: string,
  deps: VendorEmailLookupDeps
): Promise<string | null> {
  const normalizedTeamId = normalizeTeamId(teamId)
  if (!normalizedTeamId) return null

  try {
    const teamFormId = await deps.getTeamFormId(normalizedTeamId)
    if (teamFormId) {
      const teamEmail = await deps.fetchTypeformEmail(deps.teamFormIds, teamFormId)
      if (teamEmail) return teamEmail
    }
  } catch {
    // Fall through to the citizen-owner lookup.
  }

  const wallets = new Set<string>()
  try {
    const owner = await deps.getTeamOwner(normalizedTeamId)
    if (owner) {
      wallets.add(owner.toLowerCase())
      for (const safeOwner of await deps.getSafeOwners(owner)) {
        if (typeof safeOwner === 'string' && safeOwner) {
          wallets.add(safeOwner.toLowerCase())
        }
      }
    }
  } catch {
    // No owner / Safe info — nothing else to try.
    return null
  }

  for (const wallet of wallets) {
    try {
      const citizenFormId = await deps.getCitizenFormId(wallet)
      if (!citizenFormId) continue
      const citizenEmail = await deps.fetchTypeformEmail(deps.citizenFormIds, citizenFormId)
      if (citizenEmail) return citizenEmail
    } catch {
      continue
    }
  }

  return null
}
