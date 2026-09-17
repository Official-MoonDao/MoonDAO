export const PATRONS_MAX_PAGES = 20
export const PATRONS_PAGE_SIZE = 1000

export function parsePositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isInteger(n) || !Number.isFinite(n) || n <= 0) return null
  return n
}

/** True when the caller-supplied Juicebox id matches the registry's jbProjectId. */
export function claimedProjectMatchesRegistry(
  claimedProjectId: number,
  onChainProjectId: bigint | number | string
): boolean {
  try {
    const claimed = BigInt(claimedProjectId)
    const onChain = BigInt(onChainProjectId)
    return claimed > 0n && claimed === onChain
  } catch {
    return false
  }
}

export type RegistryProjectLookup =
  | { ok: true; projectId: bigint }
  | { ok: false; error: 'registry-unconfigured' | 'unknown-project' | 'registry-unavailable' }

export function verifyClaimedJbProject(
  claimedProjectId: number,
  lookup: RegistryProjectLookup
): { ok: true } | { ok: false; error: string } {
  if (!lookup.ok) return lookup
  if (!claimedProjectMatchesRegistry(claimedProjectId, lookup.projectId)) {
    return { ok: false, error: 'project-mismatch' }
  }
  return { ok: true }
}

export function validatePatronsRequest(input: {
  deprizeId: unknown
  chainId: unknown
  jbProjectId?: unknown
}):
  | { ok: false; error: string }
  | { ok: true; deprizeId: number; chainId: number; projectId: number } {
  const deprizeId = parsePositiveInt(input.deprizeId)
  const chainId = parsePositiveInt(input.chainId)
  const projectId = parsePositiveInt(input.jbProjectId)
  if (deprizeId == null || chainId == null || projectId == null) {
    return { ok: false, error: 'invalid-id' }
  }
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
