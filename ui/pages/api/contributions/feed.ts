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
  const lines = csv.split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    // Simple CSV split — handles quoted fields containing commas
    const cols: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cols.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    cols.push(current.trim())
    rows.push(cols)
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

    // Expected columns (0-indexed):
    // 0: Timestamp, 1: Wallet Address, 2: Name / Handle, 3: Description, 4: Links, 5: Quarter
    // Adjust indices below if the sheet columns differ.
    const [_header, ...dataRows] = rows
    const contributions: Contribution[] = dataRows
      .filter((row) => row[3]) // must have a description
      .map((row) => ({
        timestamp: row[0] || '',
        walletAddress: row[1] || '',
        name: row[2] || 'Anonymous',
        description: row[3] || '',
        links: row[4] || '',
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
