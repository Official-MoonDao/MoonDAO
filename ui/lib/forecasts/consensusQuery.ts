/**
 * One builder for `/api/forecasts/consensus`. Non-fresh URLs are identical for
 * the same args so the panel and the callers list share a CDN entry. A fresh
 * URL adds `t=` so a post-write refetch is not answered from s-maxage=60.
 */
export function consensusQuery(args: {
  chain: string
  deprizeId: number
  outcomes: number
  resolved?: number[] | null
  fresh?: boolean
  now?: number
}): string {
  const params = new URLSearchParams()
  params.set('chain', args.chain)
  params.set('deprizeId', String(args.deprizeId))
  params.set('outcomes', String(args.outcomes))
  if (args.resolved != null) {
    params.set('resolved', JSON.stringify(args.resolved))
  }
  if (args.fresh) {
    params.set('t', String(args.now ?? Date.now()))
  }
  return `/api/forecasts/consensus?${params.toString()}`
}
