import { IPFS_GATEWAY } from 'const/config'

export function getIPFSGateway(ipfsString: string) {
  if (!ipfsString) return ''

  // Return blob URLs as-is
  if (ipfsString.startsWith('blob:')) {
    return ipfsString
  }

  // Return full URLs as-is (already have protocol)
  if (ipfsString.startsWith('http://') || ipfsString.startsWith('https://')) {
    // Check if it's already an IPFS gateway URL
    if (ipfsString.includes('/ipfs/')) {
      return ipfsString
    }
    // Otherwise return as-is (could be any external URL)
    return ipfsString
  }

  // Return known local asset paths as-is (e.g., /assets/, /images/, etc.)
  const localAssetPaths = ['/assets/', '/images/', '/public/']
  if (
    ipfsString.startsWith('/') &&
    localAssetPaths.some((path) => ipfsString.startsWith(path))
  ) {
    return ipfsString
  }

  // Process IPFS hashes (including paths starting with / that aren't local assets)
  let hash = ipfsString.startsWith('ipfs://')
    ? ipfsString.split('ipfs://')[1]
    : ipfsString
  return `${IPFS_GATEWAY}${hash}`
}

const IPFS_GATEWAYS = [
  IPFS_GATEWAY,
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
]

async function readJsonBody(response: Response): Promise<any> {
  // Pinata (and some other gateways) often serve valid JSON metadata with
  // Content-Type: text/html. Prefer parsing the body as JSON regardless of
  // the declared type; only reject clear HTML documents.
  const raw = await response.text()
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('empty body')
  }
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    throw new Error('HTML document (not JSON metadata)')
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error('body is not JSON')
  }
}

/**
 * Fetch JSON from IPFS, trying multiple gateways.
 *
 * Uses AbortController so a slow gateway is cancelled when the timeout fires.
 * Default timeout is 8s — 3s was too aggressive for Vercel serverless → public
 * gateway round-trips and was a common cause of "Mission Loading..." fallbacks.
 *
 * Important: do NOT reject responses solely because Content-Type is text/html.
 * MoonDAO's Pinata gateway returns valid JSON metadata with that content type.
 */
export async function fetchFromIPFSWithFallback(
  ipfsHash: string,
  timeout = 8000
): Promise<any> {
  const hash = ipfsHash.startsWith('ipfs://')
    ? ipfsHash.replace('ipfs://', '')
    : ipfsHash

  if (!hash || !hash.trim()) {
    throw new Error('Empty IPFS hash')
  }

  const errors: string[] = []

  for (const gateway of IPFS_GATEWAYS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetch(`${gateway}${hash}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json, text/plain, */*' },
        redirect: 'follow',
      })

      if (!response.ok) {
        errors.push(`${gateway}: HTTP ${response.status}`)
        continue
      }

      return await readJsonBody(response)
    } catch (error: any) {
      const reason =
        error?.name === 'AbortError'
          ? 'timeout'
          : error?.message || String(error)
      errors.push(`${gateway}: ${reason}`)
      continue
    } finally {
      clearTimeout(timer)
    }
  }

  throw new Error(
    `All IPFS gateways failed for hash: ${hash} (${errors.join('; ')})`
  )
}
