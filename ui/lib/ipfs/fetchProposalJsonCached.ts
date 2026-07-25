/**
 * Deduplicates proposal-IPFS JSON fetches across hooks/components that all
 * hit the same CID on /projects (useProposalJSON per card + ProjectRewards'
 * author-address map). Without this, N cards + 1 page-level pass = 2N
 * identical gateway requests on mount.
 */

const cache = new Map<string, Promise<any>>()
const CACHE_TTL_MS = 5 * 60 * 1000
const resolvedAt = new Map<string, number>()

function cacheKey(uri: string): string {
  return uri.trim()
}

export async function fetchProposalJsonCached(
  proposalIPFS: string | null | undefined
): Promise<any | null> {
  if (!proposalIPFS || typeof proposalIPFS !== 'string') return null
  const key = cacheKey(proposalIPFS)

  const resolved = resolvedAt.get(key)
  if (resolved && Date.now() - resolved > CACHE_TTL_MS) {
    cache.delete(key)
    resolvedAt.delete(key)
  }

  const pending = cache.get(key)
  if (pending) return pending

  const promise = (async () => {
    try {
      const res = await fetch(proposalIPFS)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const json = await res.json()
      resolvedAt.set(key, Date.now())
      return json
    } catch (err) {
      // Don't poison the cache with a failed fetch — next caller retries.
      cache.delete(key)
      resolvedAt.delete(key)
      throw err
    }
  })()

  cache.set(key, promise)
  return promise
}
