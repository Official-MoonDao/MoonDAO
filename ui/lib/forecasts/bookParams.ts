export function parseBookParams(input: {
  chain?: unknown
  chainSlug?: unknown
  deprizeId?: unknown
}): { ok: true; chainSlug: string; deprizeId: number } | { ok: false; error: string } {
  const chainSlug =
    typeof input.chain === 'string'
      ? input.chain.trim()
      : typeof input.chainSlug === 'string'
        ? input.chainSlug.trim()
        : ''
  const rawId = input.deprizeId
  const deprizeId = typeof rawId === 'number' ? rawId : Number(rawId)
  if (!chainSlug) return { ok: false, error: 'missing-chain' }
  if (!Number.isInteger(deprizeId) || deprizeId <= 0) return { ok: false, error: 'missing-deprizeId' }
  return { ok: true, chainSlug, deprizeId }
}
