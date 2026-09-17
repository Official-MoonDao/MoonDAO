export const PATRONS_MAX_PAGES = 20
export const PATRONS_PAGE_SIZE = 1000

/** Known Juicebox project ids, keyed by chainId then deprizeId. */
export const DEPRIZE_JB_PROJECT_IDS: Record<number, Record<number, number>> = {
  11155111: { 22: 268 },
}

export function parsePositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isInteger(n) || !Number.isFinite(n) || n <= 0) return null
  return n
}

export function resolveJbProjectId(chainId: number, deprizeId: number): number | null {
  const projectId = DEPRIZE_JB_PROJECT_IDS[chainId]?.[deprizeId]
  if (!projectId || !Number.isInteger(projectId) || projectId <= 0) return null
  return projectId
}

export function validatePatronsRequest(input: {
  deprizeId: unknown
  chainId: unknown
}):
  | { ok: false; error: string }
  | { ok: true; deprizeId: number; chainId: number; projectId: number } {
  const deprizeId = parsePositiveInt(input.deprizeId)
  const chainId = parsePositiveInt(input.chainId)
  if (deprizeId == null || chainId == null) {
    return { ok: false, error: 'invalid-id' }
  }
  const projectId = resolveJbProjectId(chainId, deprizeId)
  if (projectId == null) return { ok: false, error: 'unknown-project' }
  return { ok: true, deprizeId, chainId, projectId }
}

export function buildPatronPayEventsQuery(opts: {
  projectId: number
  chainId: number
  version: string | number
  timestampCursor: number | null
}): string {
  const cursorClause =
    opts.timestampCursor != null && Number.isFinite(opts.timestampCursor)
      ? `, timestamp_lte: ${opts.timestampCursor}`
      : ''
  return `
    query {
      payEvents(
        limit: ${PATRONS_PAGE_SIZE},
        orderBy: "timestamp",
        orderDirection: "desc",
        where: {
          projectId: ${opts.projectId},
          version: ${opts.version},
          chainId: ${opts.chainId}${cursorClause}
        }
      ) {
        items {
          id
          amount
          from
          beneficiary
          timestamp
        }
      }
    }
  `
}

export function dedupeEventsById<T extends { id?: string | null }>(events: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const ev of events) {
    const id = ev.id || ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(ev)
  }
  return out
}
