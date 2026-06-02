// Shared helper for reading community contributions out of the public
// Google Sheet that backs the Community Circle. The sheet must be published
// via File → Share → Publish to web → CSV. Set CONTRIBUTIONS_SHEET_CSV_URL to
// override the source.
//
// Used by both the public feed (`pages/api/contributions/feed.ts`) and the
// "Contributions" XP quest verifier (`pages/api/xp/has-contributed-proof.ts`)
// so the two can never disagree on what counts as a contribution.

export type Contribution = {
  timestamp: string
  walletAddress: string
  name: string
  description: string
  links: string
  area: string
}

export const CONTRIBUTIONS_SHEET_CSV_URL =
  process.env.CONTRIBUTIONS_SHEET_CSV_URL || ''

export function parseCSV(csv: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  const cols: string[] = []

  const flush = () => {
    cols.push(current.trim())
    current = ''
  }

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i]
    const next = csv[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        // escaped quote inside quoted field
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      flush()
    } else if (((ch === '\r' && next === '\n') || ch === '\n') && !inQuotes) {
      if (ch === '\r') i++ // skip \n of \r\n
      flush()
      if (cols.length > 1 || cols[0] !== '') {
        rows.push([...cols])
      }
      cols.length = 0
    } else {
      current += ch
    }
  }

  // flush last field/row
  if (current || cols.length > 0) {
    flush()
    rows.push([...cols])
  }

  return rows
}

// Fetch and parse every contribution row from the published sheet. Returns an
// empty array when the source is unset or unreachable so callers can degrade
// gracefully rather than throwing.
export async function getSheetContributions(): Promise<Contribution[]> {
  if (!CONTRIBUTIONS_SHEET_CSV_URL) {
    return []
  }

  const response = await fetch(CONTRIBUTIONS_SHEET_CSV_URL)
  if (!response.ok) {
    throw new Error(`Sheet fetch failed: ${response.status}`)
  }

  const csv = await response.text()
  const rows = parseCSV(csv)
  if (rows.length < 2) {
    return []
  }

  // Sheet columns (0-indexed):
  // 0: Timestamp, 1: Name/Username, 2: Email, 3: Citizen?, 4: Wallet Address,
  // 5: Area, 6: Description, 7: Time Commitment, 8: Links
  const [_header, ...dataRows] = rows
  return dataRows
    .filter((row) => row[6]) // must have a description
    .map((row) => ({
      timestamp: row[0] || '',
      walletAddress: row[4] || '',
      name: row[1] || 'Anonymous',
      description: row[6] || '',
      links: row[8] || '',
      area: row[5] || '',
    }))
    .reverse() // newest first
}

// Count how many contributions a given wallet address has submitted.
// Address comparison is case-insensitive since sheet entries are unvalidated.
export async function getContributionCountForAddress(
  address: string
): Promise<number> {
  const normalized = address.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return 0

  const contributions = await getSheetContributions()
  return contributions.filter(
    (c) => c.walletAddress?.trim().toLowerCase() === normalized
  ).length
}
