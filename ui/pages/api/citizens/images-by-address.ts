import type { NextApiRequest, NextApiResponse } from 'next'
import { CITIZEN_TABLE_NAMES } from 'const/config'
import { arbitrum, sepolia } from '@/lib/rpc/chains'
import queryTable from '@/lib/tableland/queryTable'

/**
 * GET /api/citizens/images-by-address?addresses=0xabc,0xdef
 *
 * Returns a map of { [lowercaseAddress]: ipfsImageUri } for citizens
 * whose owner address matches one of the supplied addresses.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const raw = req.query.addresses
  if (!raw || raw === '') return res.status(400).json({ error: 'addresses required' })

  const addresses = (Array.isArray(raw) ? raw.join(',') : raw)
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)

  if (addresses.length === 0) return res.status(400).json({ error: 'no valid addresses' })

  const isMainnet = process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
  const chainKey = isMainnet ? 'arbitrum' : 'sepolia'
  const chain = isMainnet ? arbitrum : sepolia
  const tableName = CITIZEN_TABLE_NAMES[chainKey]
  if (!tableName) return res.status(500).json({ error: 'no citizen table configured' })

  const inClause = addresses.map((a) => `'${a}'`).join(',')
  const sql = `SELECT owner, image FROM ${tableName} WHERE owner IN (${inClause})`

  try {
    const rows: { owner: string; image: string }[] = await queryTable(chain, sql)

    const result: Record<string, string> = {}
    for (const row of rows ?? []) {
      if (row.owner && row.image) {
        result[row.owner.toLowerCase()] = row.image
      }
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(result)
  } catch (err: any) {
    console.error('[citizens/images-by-address]', err)
    return res.status(500).json({ error: err.message })
  }
}
