/**
 * Deduplicates /api/hats/get-wearer across all useTeamWearer / useProjectWearer instances
 * (nav, dashboard, etc.) so every surface sees the same hat list and we avoid stampedes.
 */
const WEARER_RESPONSE_TTL_MS = 45_000

type Cached = { json: any; expiresAt: number }

const cache = new Map<string, Cached>()
const inflight = new Map<string, Promise<any | null>>()

export async function fetchWearerHatsJsonCached(
  chainId: number,
  wearerAddress: string,
  propsEncoded: string
): Promise<any | null> {
  const key = `${chainId}:${wearerAddress.toLowerCase()}:${propsEncoded}`

  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return hit.json
  }

  const existing = inflight.get(key)
  if (existing) {
    return existing
  }

  const promise = (async () => {
    try {
      const res = await fetch(
        `/api/hats/get-wearer?chainId=${chainId}&wearerAddress=${wearerAddress}&props=${propsEncoded}`
      )
      if (!res.ok) {
        return null
      }
      const json = await res.json()
      cache.set(key, { json, expiresAt: Date.now() + WEARER_RESPONSE_TTL_MS })
      return json
    } catch {
      return null
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  return promise
}
