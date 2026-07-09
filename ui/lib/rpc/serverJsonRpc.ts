/**
 * Server-side JSON-RPC with per-chain fallback endpoints.
 *
 * The app's primary RPC (Infura) can hit its rate limit (HTTP 429), which used
 * to make /api/rpc/* routes return 500 and broke gas estimation for mission
 * contributions. Each call tries the primary key first, then public endpoints.
 * Server-only: public endpoints here are not subject to the browser CSP.
 */

const infuraKey = process.env.NEXT_PUBLIC_INFURA_KEY

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

/**
 * Forward a raw JSON-RPC payload (single call or batch array) through the
 * chain's endpoint list. Used by `/api/rpc/[chainId]` so browser thirdweb
 * reads survive Infura 429s the same way mission gas estimation does.
 *
 * Returns the first HTTP 200 JSON body that looks like a JSON-RPC response.
 * Transport failures / 429s advance to the next URL.
 */
export async function proxyJsonRpcRequest(
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
