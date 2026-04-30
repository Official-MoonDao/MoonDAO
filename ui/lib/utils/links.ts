export function isValidYouTubeUrl(url: string): boolean {
  if (!url || url.trim().length === 0) return false

  const youtubeRegex =
    /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+(\S+)?$/
  return youtubeRegex.test(url.trim())
}

function isIPv4Address(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length !== 4) return false

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false
    const value = Number(part)
    return value >= 0 && value <= 255
  })
}

function isPrivateIPv4Address(hostname: string): boolean {
  if (!isIPv4Address(hostname)) return false

  const [first, second] = hostname.split('.').map(Number)

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function isDisallowedFetchHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (normalized.length === 0) return true

  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === 'local'
  ) {
    return true
  }

  if (isPrivateIPv4Address(normalized)) return true

  const bracketlessIPv6 = normalized.replace(/^\[|\]$/g, '')
  if (
    bracketlessIPv6 === '::' ||
    bracketlessIPv6 === '::1' ||
    bracketlessIPv6.startsWith('fc') ||
    bracketlessIPv6.startsWith('fd') ||
    bracketlessIPv6.startsWith('fe8') ||
    bracketlessIPv6.startsWith('fe9') ||
    bracketlessIPv6.startsWith('fea') ||
    bracketlessIPv6.startsWith('feb')
  ) {
    return true
  }

  return false
}

/**
 * Returns true when `value` is a string that is safe for server-side
 * `fetch()` in this application: either a valid ipfs:// or ipns:// URI, or
 * a public http(s):// URL that does not target localhost or private/link-
 * local network addresses. Malformed values and internal-only destinations
 * are rejected so callers can skip them without risking `ERR_INVALID_URL`
 * or SSRF to local infrastructure.
 */
export function isFetchableUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false

  const trimmed = value.trim()
  if (trimmed.length === 0) return false

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return false
  }

  if (parsed.protocol === 'ipfs:' || parsed.protocol === 'ipns:') {
    return (parsed.hostname + parsed.pathname).length > 0
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false
  }

  if (parsed.username || parsed.password) {
    return false
  }

  return !isDisallowedFetchHostname(parsed.hostname)
}
