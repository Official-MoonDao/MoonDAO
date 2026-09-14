export type ConnectionKind =
  | 'clear'
  | 'vpn'
  | 'proxy'
  | 'tor'
  | 'relay'
  | 'hosting'
  | 'unknown'

export type VpnCheckResult = {
  isVpnOrProxy: boolean
  isLocationPreservingRelay: boolean
  kind: ConnectionKind
  failed: boolean
}

export type PrivacyFlags = {
  vpn?: boolean
  proxy?: boolean
  tor?: boolean
  relay?: boolean
  hosting?: boolean
}

// Unambiguous hosting / anonymizer names. Short tokens (aws, ovh) are matched
// with word boundaries so "laws" / "ovhene" do not false-positive. Akamai is
// omitted: it carries Apple Private Relay egress.
const HOSTING_HINTS = [
  'vpn',
  'proxy',
  'tor exit',
  'tor-',
  'datacenter',
  'data center',
  'digitalocean',
  'amazon.com',
  'amazon technologies',
  'aws',
  'google cloud',
  'microsoft azure',
  'hetzner',
  'ovh',
  'linode',
  'vultr',
  'm247',
  'datacamp',
  'choopa',
  'leaseweb',
  'hivelocity',
]

export function isPrivateOrLocalIp(ip: string): boolean {
  if (
    ip === '0.0.0.0' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.')
  ) {
    return true
  }
  const rfc1918 = /^172\.(\d+)\./.exec(ip)
  if (rfc1918) {
    const second = Number(rfc1918[1])
    return second >= 16 && second <= 31
  }
  return false
}

function hintNeedsWordBoundary(hint: string): boolean {
  return hint.length <= 4 && !hint.includes(' ') && !hint.includes('.') && !hint.includes('-')
}

export function hostingLooksLikeProxy(orgOrAsn: string | null | undefined): boolean {
  if (!orgOrAsn) return false
  const hay = orgOrAsn.toLowerCase()
  return HOSTING_HINTS.some((hint) => {
    if (hintNeedsWordBoundary(hint)) {
      const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(hay)
    }
    return hay.includes(hint)
  })
}

export function classifyPrivacyFlags(flags: PrivacyFlags | undefined): {
  isVpnOrProxy: boolean
  isLocationPreservingRelay: boolean
  kind: ConnectionKind
} {
  if (!flags) {
    return { isVpnOrProxy: false, isLocationPreservingRelay: false, kind: 'unknown' }
  }
  if (flags.vpn) {
    return { isVpnOrProxy: true, isLocationPreservingRelay: false, kind: 'vpn' }
  }
  if (flags.proxy) {
    return { isVpnOrProxy: true, isLocationPreservingRelay: false, kind: 'proxy' }
  }
  if (flags.tor) {
    return { isVpnOrProxy: true, isLocationPreservingRelay: false, kind: 'tor' }
  }
  // Relays (Apple Private Relay, WARP, Google One) preserve country. Allow
  // even when the provider also marks the egress as hosting.
  if (flags.relay) {
    return { isVpnOrProxy: false, isLocationPreservingRelay: true, kind: 'relay' }
  }
  if (flags.hosting) {
    return { isVpnOrProxy: true, isLocationPreservingRelay: false, kind: 'hosting' }
  }
  return { isVpnOrProxy: false, isLocationPreservingRelay: false, kind: 'clear' }
}

export function classifyLocalIp(isProd: boolean): VpnCheckResult {
  if (isProd) {
    return {
      isVpnOrProxy: false,
      isLocationPreservingRelay: false,
      kind: 'unknown',
      failed: true,
    }
  }
  return {
    isVpnOrProxy: false,
    isLocationPreservingRelay: false,
    kind: 'clear',
    failed: false,
  }
}

function isProduction(): boolean {
  return process.env.NEXT_PUBLIC_ENV === 'prod'
}

function resultFromClassification(
  classified: ReturnType<typeof classifyPrivacyFlags>
): VpnCheckResult {
  return { ...classified, failed: false }
}

async function checkIpinfo(ip: string): Promise<PrivacyFlags | null> {
  const token = process.env.IPINFO_TOKEN
  if (!token) return null
  const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/privacy?token=${token}`, {
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`ipinfo ${res.status}`)
  return (await res.json()) as PrivacyFlags
}

export type IpapiBody = {
  error?: boolean
  org?: string
  asn?: string
  security?: PrivacyFlags
}

export function vpnResultFromIpapiBody(data: IpapiBody): VpnCheckResult {
  if (data.error) {
    return {
      isVpnOrProxy: false,
      isLocationPreservingRelay: false,
      kind: 'unknown',
      failed: true,
    }
  }
  if (data.security) {
    return resultFromClassification(classifyPrivacyFlags(data.security))
  }
  if (data.org || data.asn) {
    const hinted = hostingLooksLikeProxy(data.org) || hostingLooksLikeProxy(data.asn)
    if (hinted) {
      return {
        isVpnOrProxy: true,
        isLocationPreservingRelay: false,
        kind: 'hosting',
        failed: false,
      }
    }
    return {
      isVpnOrProxy: false,
      isLocationPreservingRelay: false,
      kind: 'clear',
      failed: false,
    }
  }
  return {
    isVpnOrProxy: false,
    isLocationPreservingRelay: false,
    kind: 'unknown',
    failed: true,
  }
}

async function checkIpapi(ip: string): Promise<IpapiBody> {
  const key = process.env.IPAPI_KEY
  const url = key
    ? `https://ipapi.co/${encodeURIComponent(ip)}/json/?key=${key}`
    : `https://ipapi.co/${encodeURIComponent(ip)}/json/`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MoonDAO/1.0' },
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`ipapi ${res.status}`)
  return (await res.json()) as IpapiBody
}

export async function checkVpnOrProxy(ip: string): Promise<VpnCheckResult> {
  if (!ip) {
    return {
      isVpnOrProxy: false,
      isLocationPreservingRelay: false,
      kind: 'unknown',
      failed: true,
    }
  }
  if (isPrivateOrLocalIp(ip)) {
    return classifyLocalIp(isProduction())
  }
  try {
    const ipinfo = await checkIpinfo(ip)
    if (ipinfo) {
      return resultFromClassification(classifyPrivacyFlags(ipinfo))
    }
    return vpnResultFromIpapiBody(await checkIpapi(ip))
  } catch (err) {
    console.error('[deprize] vpn check failed', err)
    return {
      isVpnOrProxy: false,
      isLocationPreservingRelay: false,
      kind: 'unknown',
      failed: true,
    }
  }
}
