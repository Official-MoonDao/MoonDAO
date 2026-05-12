import type { NextApiRequest, NextApiResponse } from 'next'

// Public Google Sheet published as CSV.
// The sheet must be published via File → Share → Publish to web → CSV.
// Set CONTRIBUTIONS_SHEET_CSV_URL in .env.local to override.
const SHEET_CSV_URL =
  process.env.CONTRIBUTIONS_SHEET_CSV_URL || ''

export type Contribution = {
  timestamp: string
  walletAddress: string
  name: string
  description: string
  links: string
  quarter: string
}

function parseCSV(csv: string): string[][] {
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
    } else if ((ch === '\r' && next === '\n' || ch === '\n') && !inQuotes) {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  if (!SHEET_CSV_URL) {
    return res.status(200).json({ contributions: [] })
  }

  try {
    const response = await fetch(SHEET_CSV_URL, { next: { revalidate: 300 } } as any)
    if (!response.ok) {
      throw new Error(`Sheet fetch failed: ${response.status}`)
    }
    const csv = await response.text()
    const rows = parseCSV(csv)
    if (rows.length < 2) {
      return res.status(200).json({ contributions: [] })
    }

    // Sheet columns (0-indexed):
    // 0: Timestamp, 1: Name/Username, 2: Email, 3: Citizen?, 4: Wallet Address,
    // 5: Area, 6: Description, 7: Time Commitment, 8: Links
    const [_header, ...dataRows] = rows
    const contributions: Contribution[] = dataRows
      .filter((row) => row[6]) // must have a description
      .map((row) => ({
        timestamp: row[0] || '',
        walletAddress: row[4] || '',
        name: row[1] || 'Anonymous',
        description: row[6] || '',
        links: row[8] || '',
        quarter: row[5] || '',
      }))
      .reverse() // newest first

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ contributions })
  } catch (error) {
    console.error('[contributions/feed]', error)
    return res.status(500).json({
      message: 'Failed to fetch contributions',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
