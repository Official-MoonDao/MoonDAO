/**
 * Server-side JSON-RPC with per-chain fallback endpoints.
 *
 * The app's primary RPC (Infura) can hit its rate limit (HTTP 429), which used
 * to make /api/rpc/* routes return 500 and broke gas estimation for mission
 * contributions. Each call tries the primary key first, then public endpoints.
 * Server-only: public endpoints here are not subject to the browser CSP.
 */

import {
  cacheGetMany,
  cacheSetMany,
  hashKey,
  stableStringify,
} from './rpcCache'

const infuraKey = process.env.NEXT_PUBLIC_INFURA_KEY

// How long a "latest"/state read (eth_call, balances, code) may be reused.
// A couple of seconds collapses duplicate reads fired by concurrent page loads
// without staling balances/prices enough to matter for display or estimation.
const SHORT_TTL_MS = Number(process.env.RPC_CACHE_TTL_MS) || 3000
// Reads pinned to a specific block/hash (or chain identity) never change.
const IMMUTABLE_TTL_MS = 5 * 60 * 1000

function usableUrl(u: string): boolean {
  return typeof u === 'string' && u.length > 0 && !u.includes('undefined')
}

const INFURA_SUBDOMAINS: Record<number, string> = {
  1: 'mainnet',
  137: 'polygon-mainnet',
  42161: 'arbitrum-mainnet',
  8453: 'base-mainnet',
  11155111: 'sepolia',
  421614: 'arbitrum-sepolia',
  11155420: 'optimism-sepolia',
  84532: 'base-sepolia',
}

const PUBLIC_RPC_URLS: Record<number, string[]> = {
  1: [
    'https://cloudflare-eth.com',
    'https://ethereum.publicnode.com',
    'https://eth.llamarpc.com',
    'https://1rpc.io/eth',
  ],
  137: ['https://polygon-rpc.com', 'https://polygon-bor.publicnode.com'],
  42161: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one.publicnode.com'],
  8453: ['https://mainnet.base.org', 'https://base.publicnode.com'],
  11155111: ['https://rpc.sepolia.org', 'https://ethereum-sepolia.publicnode.com'],
  421614: ['https://sepolia-rollup.arbitrum.io/rpc'],
  11155420: ['https://sepolia.optimism.io'],
  84532: ['https://sepolia.base.org', 'https://base-sepolia.publicnode.com'],
}

export function serverRpcUrlsForChain(chainId: number): string[] {
  const infuraSubdomain = INFURA_SUBDOMAINS[chainId]
  const infuraUrl =
    infuraSubdomain && infuraKey
      ? `https://${infuraSubdomain}.infura.io/v3/${infuraKey}`
      : ''
  return [infuraUrl, ...(PUBLIC_RPC_URLS[chainId] ?? [])].filter(usableUrl)
}

export function isSupportedRpcChain(chainId: number): boolean {
  return serverRpcUrlsForChain(chainId).length > 0
}

/** JSON-RPC error returned by a node (e.g. execution revert), as opposed to a transport failure. */
export class JsonRpcNodeError extends Error {}

type JsonRpcOptions = {
  timeoutMs?: number
  /**
   * When true, a node-level JSON-RPC error (e.g. estimateGas revert) aborts
   * immediately instead of trying the next endpoint, since the call would
   * fail identically everywhere.
   */
  abortOnNodeError?: boolean
}

/**
 * Run a JSON-RPC call against the chain's endpoints in order, returning the
 * first successful `result`. Throws only when every endpoint fails (or on a
 * node error with `abortOnNodeError`).
 */
export async function jsonRpcWithFallback(
  chainId: number,
  method: string,
  params: unknown[],
  { timeoutMs = 20_000, abortOnNodeError = false }: JsonRpcOptions = {}
): Promise<any> {
  const urls = serverRpcUrlsForChain(chainId)
  if (urls.length === 0) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }

  let lastError: Error | null = null
  for (const url of urls) {
    let data: any
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) {
        lastError = new Error(`RPC request failed: ${response.status}`)
        continue
      }
      data = await response.json()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown RPC error')
      continue
    }

    if (data?.error) {
      lastError = new JsonRpcNodeError(data.error.message || 'RPC error')
      if (abortOnNodeError) throw lastError
      continue
    }
    if (data?.result === undefined || data?.result === null) {
      lastError = new Error(`No result returned for ${method}`)
      continue
    }
    return data.result
  }

  throw lastError ?? new Error(`All RPC endpoints failed for ${method}`)
}

export type JsonRpcProxyResult = {
  status: number
  body: unknown
}

function hasResultOrError(entry: unknown): boolean {
  return (
    !!entry &&
    typeof entry === 'object' &&
    ('result' in (entry as object) || 'error' in (entry as object))
  )
}

/**
 * Validate that an upstream body is a well-formed JSON-RPC response for the
 * given request. Public fallback RPCs sometimes answer a batch with a single
 * error object, drop entries, or return entries with neither `result` nor
 * `error`. Forwarding those to the browser makes thirdweb resolve individual
 * eth_calls with `undefined`, which crashes viem's ABI decoder ("Cannot read
 * properties of undefined (reading 'buffer')" / Safari: "undefined is not an
 * object (evaluating 'e.buffer')") — seen in citizen onboarding reads.
 */
function isWellFormedJsonRpcResponse(request: unknown, body: unknown): boolean {
  if (Array.isArray(request)) {
    if (!Array.isArray(body) || body.length !== request.length) return false
    return body.every(hasResultOrError)
  }
  return hasResultOrError(body)
}

type JsonRpcRequest = {
  jsonrpc?: string
  id?: unknown
  method?: string
  params?: unknown[]
}

// Reads whose result is a pure function of chain state at a given block. Anything
// that mutates, depends on the mempool (pending), or must be fresh for correctness
// (nonce, gas estimate, tx receipt) is intentionally absent so it never caches.
const CACHEABLE_READ_METHODS = new Set([
  'eth_call',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_chainId',
  'net_version',
])

// Block tag arg position per method (the tag decides short vs immutable TTL).
const BLOCK_TAG_INDEX: Record<string, number> = {
  eth_call: 1,
  eth_getBalance: 1,
  eth_getCode: 1,
  eth_getStorageAt: 2,
  eth_getBlockByNumber: 0,
}

/** null → do not cache; otherwise the TTL to use for this block tag. */
function ttlForBlockTag(tag: unknown): number | null {
  // Missing tag defaults to "latest".
  if (tag === undefined || tag === null) return SHORT_TTL_MS
  if (typeof tag === 'object') {
    // EIP-1898 { blockNumber } / { blockHash } → pinned, immutable.
    const obj = tag as Record<string, unknown>
    if ('blockHash' in obj || 'blockNumber' in obj) return IMMUTABLE_TTL_MS
    return null
  }
  if (typeof tag !== 'string') return null
  const t = tag.toLowerCase()
  if (t === 'pending') return null // mempool-dependent, never cache
  if (t === 'latest' || t === 'safe' || t === 'finalized') return SHORT_TTL_MS
  if (t === 'earliest') return IMMUTABLE_TTL_MS
  // A concrete block number (0x...) is immutable once mined.
  if (t.startsWith('0x')) return IMMUTABLE_TTL_MS
  return null
}

/**
 * Decide whether a single JSON-RPC request may be cached, and under what key /
 * TTL. Returns null for anything that must always hit the node.
 */
function cachePolicyFor(
  chainId: number,
  req: JsonRpcRequest
): { key: string; ttlMs: number } | null {
  if (!req || typeof req !== 'object') return null
  // Notifications (no id) can't be matched back into a response — skip.
  if (req.id === undefined || req.id === null) return null
  const method = req.method
  if (!method || !CACHEABLE_READ_METHODS.has(method)) return null

  const params = Array.isArray(req.params) ? req.params : []

  let ttlMs: number
  if (method === 'eth_chainId' || method === 'net_version') {
    ttlMs = IMMUTABLE_TTL_MS
  } else if (method === 'eth_getBlockByHash') {
    ttlMs = IMMUTABLE_TTL_MS
  } else {
    const tagTtl = ttlForBlockTag(params[BLOCK_TAG_INDEX[method]])
    if (tagTtl === null) return null
    ttlMs = tagTtl
  }

  const key = `rpc:${chainId}:${hashKey(`${method}:${stableStringify(params)}`)}`
  return { key, ttlMs }
}

/** Only cache successful results (never errors or empty payloads). */
function isCacheableResponse(entry: unknown): boolean {
  return (
    !!entry &&
    typeof entry === 'object' &&
    'result' in (entry as object) &&
    (entry as { result?: unknown }).result !== undefined &&
    (entry as { result?: unknown }).result !== null
  )
}

/**
 * Forward a raw JSON-RPC payload (single call or batch array) through the
 * chain's endpoint list. Used by `/api/rpc/[chainId]` so browser thirdweb
 * reads survive Infura 429s the same way mission gas estimation does.
 *
 * Returns the first HTTP 200 JSON body that looks like a JSON-RPC response.
 * Transport failures / 429s advance to the next URL.
 */
async function sendUpstream(
  chainId: number,
  payload: unknown,
  { timeoutMs = 20_000 }: { timeoutMs?: number } = {}
): Promise<JsonRpcProxyResult> {
  const urls = serverRpcUrlsForChain(chainId)
  if (urls.length === 0) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }

  let lastStatus = 502
  let lastBody: unknown = { error: 'All RPC endpoints failed' }

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      })
      const text = await response.text()
      let data: unknown
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        lastStatus = response.status || 502
        lastBody = { error: 'Invalid JSON from upstream RPC' }
        continue
      }

      // Rate limits / gateway errors → try the next endpoint.
      if (response.status === 429 || response.status >= 500) {
        lastStatus = response.status
        lastBody = data ?? { error: `Upstream RPC ${response.status}` }
        continue
      }

      if (!response.ok) {
        lastStatus = response.status
        lastBody = data ?? { error: `Upstream RPC ${response.status}` }
        continue
      }

      // Empty / non-JSON-RPC payloads cause thirdweb's ABI decoder to throw
      // `Cannot read properties of undefined (reading 'buffer')`.
      if (data == null) {
        lastStatus = 502
        lastBody = { error: 'Empty RPC response' }
        continue
      }

      // Malformed batch responses (single object for a batch request, missing
      // entries, entries with neither result nor error) crash viem the same
      // way — try the next endpoint instead of forwarding them.
      if (!isWellFormedJsonRpcResponse(payload, data)) {
        lastStatus = 502
        lastBody = { error: 'Malformed JSON-RPC response from upstream' }
        continue
      }

      return { status: 200, body: data }
    } catch (err) {
      lastStatus = 502
      lastBody = {
        error: err instanceof Error ? err.message : 'Unknown RPC error',
      }
    }
  }

  return { status: lastStatus, body: lastBody }
}

/**
 * Cache-aware wrapper around {@link sendUpstream}. Serves idempotent reads
 * (eth_call, balances, code, blocks, chain id) from the shared cache and only
 * forwards genuine misses to the upstream node — the main lever for cutting
 * Infura credit usage. Batches are split so cached and uncached sub-calls in
 * the same request are handled independently, then re-merged in order. Falls
 * back to a plain passthrough for anything that can't be cached.
 */
export async function proxyJsonRpcRequest(
  chainId: number,
  payload: unknown,
  opts: { timeoutMs?: number } = {}
): Promise<JsonRpcProxyResult> {
  const isBatch = Array.isArray(payload)
  const requests = (isBatch ? payload : [payload]) as JsonRpcRequest[]

  // Map each sub-request to its cache policy (or null if uncacheable).
  const policies = requests.map((req) => cachePolicyFor(chainId, req))
  const cacheableIdx = policies
    .map((p, i) => (p ? i : -1))
    .filter((i) => i >= 0)

  // Nothing is cacheable → straight passthrough (preserves prior behavior).
  if (cacheableIdx.length === 0) {
    return sendUpstream(chainId, payload, opts)
  }

  const cachedValues = await cacheGetMany(
    cacheableIdx.map((i) => policies[i]!.key)
  )

  // Responses we already have, keyed by original index.
  const responses: (unknown | undefined)[] = new Array(requests.length)
  cacheableIdx.forEach((origIdx, j) => {
    const value = cachedValues[j]
    if (value !== undefined) {
      responses[origIdx] = {
        jsonrpc: '2.0',
        id: requests[origIdx].id,
        result: value,
      }
    }
  })

  // Everything without a cached response must be fetched upstream.
  const missIdx = requests.map((_, i) => i).filter((i) => responses[i] === undefined)

  if (missIdx.length > 0) {
    const missPayload = isBatch
      ? missIdx.map((i) => requests[i])
      : requests[missIdx[0]]

    const upstream = await sendUpstream(chainId, missPayload, opts)
    if (upstream.status !== 200) {
      // Can't partially serve a failed fetch — surface the upstream error.
      return upstream
    }

    const upstreamBody = upstream.body
    const upstreamArr = (
      Array.isArray(upstreamBody) ? upstreamBody : [upstreamBody]
    ) as JsonRpcRequest[]

    // Match upstream entries back to requests by id (batch order isn't
    // guaranteed), falling back to positional mapping.
    const byId = new Map<unknown, unknown>()
    for (const entry of upstreamArr) {
      if (entry && typeof entry === 'object' && 'id' in entry) {
        byId.set(entry.id, entry)
      }
    }

    const toCache: { key: string; value: unknown; ttlMs: number }[] = []
    missIdx.forEach((origIdx, position) => {
      const req = requests[origIdx]
      const entry =
        (req.id !== undefined && byId.get(req.id)) || upstreamArr[position]
      responses[origIdx] = entry

      const policy = policies[origIdx]
      if (policy && isCacheableResponse(entry)) {
        toCache.push({
          key: policy.key,
          value: (entry as { result: unknown }).result,
          ttlMs: policy.ttlMs,
        })
      }
    })

    if (toCache.length > 0) {
      // Fire-and-forget; a cache write failure must not delay the response.
      void cacheSetMany(toCache)
    }
  }

  const body = isBatch ? responses : responses[0]
  return { status: 200, body }
}
