import { BENDYSTRAW_JB_VERSION } from 'const/config'
import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { normalizeProtocolAddress } from '@/lib/deprize/payerClassification'
import { aggregatePatrons, applyPatronSuppression } from '@/lib/deprize/patrons-math'
import {
  PATRONS_MAX_PAGES,
  buildPatronPayEventsQuery,
  dedupeEventsById,
  validatePatronsRequest,
} from '@/lib/deprize/patrons-query'

const CHAIN_SLUG: Record<number, string> = {
  11155111: 'sepolia',
  42161: 'arbitrum',
  421614: 'arbitrum-sepolia',
}

function bendystrawUrl(): string | null {
  const key = process.env.BENDYSTRAW_API_KEY
  if (!key) return null
  return `https://${
    process.env.NEXT_PUBLIC_CHAIN !== 'mainnet' ? 'testnet.' : ''
  }bendystraw.xyz/${key}/graphql`
}

function suppressionSet(): Set<string> {
  const raw = process.env.DEPRIZE_PATRON_SUPPRESSION || ''
  return new Set(
    raw
      .split(',')
      .map((part) => normalizeProtocolAddress(part.trim()))
      .filter((part): part is string => Boolean(part))
  )
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

async function resolveEnsNames(addresses: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  await Promise.all(
    addresses.map(async (address) => {
      try {
        const res = await fetch(`https://api.ensideas.com/ens/resolve/${address}`)
        if (!res.ok) return
        const body = await res.json()
        if (typeof body?.name === 'string' && body.name.endsWith('.eth')) {
          out.set(address, body.name)
        }
      } catch {
        // ENS is never load-bearing.
      }
    })
  )
  return out
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const parsed = validatePatronsRequest({
    deprizeId: req.query.deprizeId,
    chainId: req.query.chainId,
  })
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error })
  }

  const slug = CHAIN_SLUG[parsed.chainId]
  if (!slug) return res.status(400).json({ error: 'unsupported-chain' })

  const fresh = req.query.fresh === '1'
  if (fresh) {
    res.setHeader('Cache-Control', 'no-store')
  } else {
    setCDNCacheHeaders(res, 60, 300)
  }

  const url = bendystrawUrl()
  if (!url) return res.status(503).json({ error: 'subgraph-unconfigured' })

  const events: Array<{
    id?: string
    amount?: string
    from?: string
    beneficiary?: string
    timestamp?: number
  }> = []
  let cursor: number | null = null
  let exhausted = false

  for (let page = 0; page < PATRONS_MAX_PAGES; page++) {
    const query = buildPatronPayEventsQuery({
      projectId: parsed.projectId,
      chainId: parsed.chainId,
      version: BENDYSTRAW_JB_VERSION,
      timestampCursor: cursor,
    })
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!upstream.ok) {
      console.error('[deprize] patrons upstream error', upstream.status)
      return res.status(502).json({ error: 'upstream' })
    }
    const body = await upstream.json()
    const items = body?.data?.payEvents?.items
    if (!Array.isArray(items)) {
      return res.status(502).json({ error: 'upstream' })
    }
    if (items.length === 0) {
      exhausted = true
      break
    }
    events.push(...items)
    const last = items[items.length - 1]
    const nextCursor = Number(last?.timestamp)
    if (!Number.isFinite(nextCursor) || items.length < 1000) {
      exhausted = true
      break
    }
    cursor = nextCursor
  }

  if (!exhausted) {
    console.warn('[deprize] patrons hit MAX_PAGES; refusing partial aggregates')
    return res.status(200).json({
      asOf: Date.now(),
      complete: false,
      chainId: parsed.chainId,
      projectId: parsed.projectId,
    })
  }

  const unique = dedupeEventsById(events)
  const aggregated = applyPatronSuppression(aggregatePatrons(unique, slug), suppressionSet())
  console.info('[deprize] patrons exclusions', {
    chainId: parsed.chainId,
    projectId: parsed.projectId,
    ...aggregated.excluded,
  })

  const ens = await resolveEnsNames(aggregated.patrons.map((row) => row.payer))
  return res.status(200).json({
    asOf: Date.now(),
    complete: true,
    chainId: parsed.chainId,
    projectId: parsed.projectId,
    patronCount: aggregated.patronCount,
    totalDirectWei: aggregated.totalDirectWei.toString(),
    patrons: aggregated.patrons.map((row) => ({
      payer: row.payer,
      displayName: ens.get(row.payer) || shortAddress(row.payer),
      totalWei: row.totalWei.toString(),
      count: row.count,
      firstTs: row.firstTs,
      lastTs: row.lastTs,
    })),
    otherRoutes: {
      count: aggregated.otherRoutes.count,
      totalWei: aggregated.otherRoutes.totalWei.toString(),
    },
  })
}

export default withMiddleware(handler, rateLimit)
