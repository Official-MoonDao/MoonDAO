// Author details revealed after a voter makes a pick, so people can find and
// connect with whoever did work that resonated with them. Kept out of the
// matchup cards themselves: authors stay hidden until the pick is saved.
import { CITIZEN_TABLE_NAMES } from 'const/config'
import { arbitrum, sepolia } from '@/lib/rpc/chains'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import type { IdentifiedContribution } from './matchups'

export type MatchupAuthor = {
  /** Citizen name when the wallet matches a citizen, else the name typed in the form. */
  name: string
  /** Link to the citizen profile, when the wallet belongs to a citizen. */
  profileUrl: string | null
}

const WALLET_RE = /^0x[a-f0-9]{40}$/

async function citizensByWallet(
  wallets: string[]
): Promise<Record<string, { id: number | string; name: string }>> {
  if (wallets.length === 0) return {}
  const isMainnet = process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
  const tableName = CITIZEN_TABLE_NAMES[isMainnet ? 'arbitrum' : 'sepolia']
  if (!tableName) return {}

  // Wallets come from an untrusted sheet; only validated hex addresses reach SQL.
  const inClause = wallets.map((w) => `'${w}'`).join(',')
  const rows: { id: number | string; name: string; owner: string }[] =
    await queryTable(
      isMainnet ? arbitrum : sepolia,
      `SELECT id, name, owner FROM ${tableName} WHERE owner IN (${inClause})`
    )
  const out: Record<string, { id: number | string; name: string }> = {}
  for (const row of rows ?? []) {
    if (row.owner) out[row.owner.toLowerCase()] = { id: row.id, name: row.name }
  }
  return out
}

export async function getMatchupAuthors(
  contributions: IdentifiedContribution[]
): Promise<Record<string, MatchupAuthor>> {
  const walletOf = (c: IdentifiedContribution) => {
    const w = c.walletAddress?.trim().toLowerCase()
    return w && WALLET_RE.test(w) ? w : null
  }

  let citizens: Awaited<ReturnType<typeof citizensByWallet>> = {}
  try {
    const wallets = Array.from(
      new Set(contributions.map(walletOf).filter((w): w is string => !!w))
    )
    citizens = await citizensByWallet(wallets)
  } catch (err) {
    // The reveal still works without profile links.
    console.error('[matchupAuthors] citizen lookup failed:', err)
  }

  const out: Record<string, MatchupAuthor> = {}
  for (const c of contributions) {
    const wallet = walletOf(c)
    const citizen = wallet ? citizens[wallet] : undefined
    const slug = citizen?.name
      ? generatePrettyLinkWithId(citizen.name, citizen.id)
      : citizen
      ? String(citizen.id)
      : null
    out[c.id] = {
      name: citizen?.name || c.name?.trim() || 'Anonymous',
      profileUrl: slug ? `/citizen/${slug}` : null,
    }
  }
  return out
}
