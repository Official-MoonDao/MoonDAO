// Safe Transaction Service short names: https://docs.safe.global/advanced/smart-account-supported-networks
export const SAFE_TX_SERVICE_SHORT_NAMES: Record<number, string> = {
  1: 'eth',
  10: 'oeth',
  137: 'pol',
  8453: 'base',
  42161: 'arb1',
  84532: 'basesep',
  11155111: 'sep',
}

export const SAFE_PROXY_ALLOWED_METHODS = ['GET', 'POST', 'DELETE']

export type SafeTxServiceUrlResult = { url: string } | { error: string }

export function buildSafeTxServiceUrl(
  chainId: unknown,
  path: unknown,
  reqUrl?: string,
): SafeTxServiceUrlResult {
  const shortName = SAFE_TX_SERVICE_SHORT_NAMES[Number(chainId)]
  if (!shortName) return { error: `Unsupported chain ID: ${chainId}` }

  const segments = Array.isArray(path) ? path : []
  if (
    !['v1', 'v2'].includes(segments[0]) ||
    segments.some((s) => typeof s !== 'string' || !/^[A-Za-z0-9_-]+$/.test(s))
  ) {
    return { error: 'Invalid path' }
  }

  const search = reqUrl?.includes('?') ? `?${reqUrl.split('?')[1]}` : ''
  return {
    url: `https://api.safe.global/tx-service/${shortName}/api/${segments.join('/')}/${search}`,
  }
}

export function serializeSafeProxyBody(method: string, body: unknown): string | undefined {
  if (method === 'GET' || body === undefined || body === '') return undefined
  return typeof body === 'string' ? body : JSON.stringify(body)
}
