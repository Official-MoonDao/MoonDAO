import { DEFAULT_CHAIN_V5 } from 'const/config'
import type { Chain } from '@/lib/rpc/chains'
import { v4SlugToV5Chain } from '@/lib/thirdweb/chain'

export type ResolvedTablelandChain = { ok: true; chain: Chain } | { ok: false }

/**
 * Explicit `chain` query param selects that chain. Omitted or blank keeps
 * `DEFAULT_CHAIN_V5` so existing callers stay on the app chain. An unknown
 * explicit slug does not fall through to the default.
 */
export function resolveTablelandQueryChain(chainSlug?: string | null): ResolvedTablelandChain {
  const slug = typeof chainSlug === 'string' ? chainSlug.trim() : ''
  if (!slug) return { ok: true, chain: DEFAULT_CHAIN_V5 }
  const chain = v4SlugToV5Chain(slug)
  if (!chain) return { ok: false }
  return { ok: true, chain }
}
