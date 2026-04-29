import { BENDYSTRAW_JB_VERSION, DEFAULT_CHAIN_V5 } from 'const/config'

/**
 * Aggregate stats describing a wrapped-up Juicebox raise. Computed from the
 * raw payEvents rather than the project totals so we can derive things the
 * subgraph doesn't pre-aggregate (median contribution, unique beneficiaries).
 *
 * All amount values are wei-as-string so the object stays JSON-serializable
 * across `getServerSideProps`. The UI converts to ETH/USD client-side.
 */
export interface MissionFundingStats {
  totalContributions: number
  uniqueBackers: number
  medianAmountWei: string
  meanAmountWei: string
  largestAmountWei: string
  totalAmountWei: string
}

const PAGE_SIZE = 1000
const MAX_PAGES = 20 // safety net (~20K events) for runaway pagination

function buildPayEventsQuery(
  projectId: number,
  timestampCursor: number | null
): string {
  const cursorClause =
    timestampCursor != null && Number.isFinite(timestampCursor)
      ? `, timestamp_lt: ${timestampCursor}`
      : ''
  return `
    query {
      payEvents(
        limit: ${PAGE_SIZE},
        orderBy: "timestamp",
        orderDirection: "desc",
        where: {
          projectId: ${projectId},
          version: ${BENDYSTRAW_JB_VERSION},
          chainId: ${DEFAULT_CHAIN_V5.id}${cursorClause}
        }
      ) {
        items {
          amount
          beneficiary
          timestamp
        }
      }
    }
  `
}

interface PayEventRow {
  amount: string | number | null | undefined
  beneficiary: string | null | undefined
  timestamp: number | null | undefined
}

/**
 * Fetch every payEvent for a project from Bendystraw and aggregate funding
 * stats. Designed to run in `getServerSideProps` (SSR) — uses a direct
 * fetch to the subgraph URL rather than going through `/api/juicebox/query`
 * (which would require an absolute URL during SSR).
 *
 * Returns null on any subgraph error so the caller can render a graceful
 * fallback. Pagination uses `timestamp_lt` cursors to walk the dataset
 * deterministically without relying on offset (Bendystraw caps `limit` at
 * 1000 per query).
 */
export async function fetchMissionFundingStats(
  projectId: number | undefined
): Promise<MissionFundingStats | null> {
  if (
    projectId == null ||
    !Number.isFinite(projectId) ||
    projectId <= 0
  ) {
    return null
  }

  const apiKey = process.env.BENDYSTRAW_API_KEY
  if (!apiKey) return null
  const subgraphUrl = `https://${
    process.env.NEXT_PUBLIC_CHAIN !== 'mainnet' ? 'testnet.' : ''
  }bendystraw.xyz/${apiKey}/graphql`

  const allEvents: PayEventRow[] = []
  let cursor: number | null = null

  for (let page = 0; page < MAX_PAGES; page++) {
    let res: Response
    try {
      res = await fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: buildPayEventsQuery(projectId, cursor) }),
      })
    } catch (error) {
      console.warn('[fetchMissionFundingStats] network error:', error)
      return null
    }

    if (!res.ok) {
      console.warn(
        `[fetchMissionFundingStats] non-OK status ${res.status} for project ${projectId}`
      )
      return null
    }

    let payload: any
    try {
      payload = await res.json()
    } catch (error) {
      console.warn('[fetchMissionFundingStats] invalid JSON:', error)
      return null
    }

    if (payload?.errors?.length) {
      console.warn(
        '[fetchMissionFundingStats] subgraph errors:',
        payload.errors
      )
      return null
    }

    const items: PayEventRow[] = payload?.data?.payEvents?.items ?? []
    if (items.length === 0) break
    allEvents.push(...items)

    // Find the oldest timestamp in this page; use it as the next cursor
    // (timestamp_lt strictly excludes equality, so we may miss events that
    // share the exact same timestamp as the cursor — extremely unlikely for
    // payments, but if it ever happens, the safety bound below kicks in).
    let oldest = Number.POSITIVE_INFINITY
    for (const ev of items) {
      const ts = Number(ev.timestamp ?? NaN)
      if (Number.isFinite(ts) && ts < oldest) oldest = ts
    }
    if (!Number.isFinite(oldest) || items.length < PAGE_SIZE) break
    cursor = oldest
  }

  if (allEvents.length === 0) {
    return {
      totalContributions: 0,
      uniqueBackers: 0,
      medianAmountWei: '0',
      meanAmountWei: '0',
      largestAmountWei: '0',
      totalAmountWei: '0',
    }
  }

  const amounts: bigint[] = []
  const backers = new Set<string>()
  let total = BigInt(0)
  let largest = BigInt(0)
  for (const ev of allEvents) {
    let amt: bigint
    try {
      amt = BigInt(ev.amount ?? 0)
    } catch {
      continue
    }
    if (amt <= BigInt(0)) continue
    amounts.push(amt)
    total += amt
    if (amt > largest) largest = amt
    if (typeof ev.beneficiary === 'string' && ev.beneficiary) {
      backers.add(ev.beneficiary.toLowerCase())
    }
  }

  if (amounts.length === 0) {
    return {
      totalContributions: 0,
      uniqueBackers: 0,
      medianAmountWei: '0',
      meanAmountWei: '0',
      largestAmountWei: '0',
      totalAmountWei: '0',
    }
  }

  amounts.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const mid = Math.floor(amounts.length / 2)
  const median =
    amounts.length % 2 === 1
      ? amounts[mid]
      : (amounts[mid - 1] + amounts[mid]) / BigInt(2)
  const mean = total / BigInt(amounts.length)

  return {
    totalContributions: amounts.length,
    uniqueBackers: backers.size,
    medianAmountWei: median.toString(),
    meanAmountWei: mean.toString(),
    largestAmountWei: largest.toString(),
    totalAmountWei: total.toString(),
  }
}
