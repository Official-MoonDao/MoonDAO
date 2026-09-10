export type VpnCheckResult = {
  isVpnOrProxy: boolean
  failed: boolean
}

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
  'akamai',
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

export function hostingLooksLikeProxy(orgOrAsn: string | null | undefined): boolean {
  if (!orgOrAsn) return false
  const hay = orgOrAsn.toLowerCase()
  return HOSTING_HINTS.some((hint) => hay.includes(hint))
}

type PrivacyFlags = {
  vpn?: boolean
  proxy?: boolean
  tor?: boolean
  relay?: boolean
  hosting?: boolean
}

function flagsAreProxy(flags: PrivacyFlags | undefined): boolean {
  if (!flags) return false
  return Boolean(flags.vpn || flags.proxy || flags.tor || flags.relay || flags.hosting)
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

async function checkIpapi(
  ip: string
): Promise<{ flags?: PrivacyFlags; org?: string; asn?: string }> {
  const key = process.env.IPAPI_KEY
  const url = key
    ? `https://ipapi.co/${encodeURIComponent(ip)}/json/?key=${key}`
    : `https://ipapi.co/${encodeURIComponent(ip)}/json/`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MoonDAO/1.0' },
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`ipapi ${res.status}`)
  const data = (await res.json()) as {
    org?: string
    asn?: string
    security?: PrivacyFlags
  }
  return { flags: data.security, org: data.org, asn: data.asn }
}

export async function checkVpnOrProxy(ip: string): Promise<VpnCheckResult> {
  if (isPrivateOrLocalIp(ip)) {
    return { isVpnOrProxy: false, failed: false }
  }
  try {
    const ipinfo = await checkIpinfo(ip)
    if (ipinfo) {
      return { isVpnOrProxy: flagsAreProxy(ipinfo), failed: false }
    }
    const ipapi = await checkIpapi(ip)
    if (ipapi.flags) {
      return { isVpnOrProxy: flagsAreProxy(ipapi.flags), failed: false }
    }
    const hinted = hostingLooksLikeProxy(ipapi.org) || hostingLooksLikeProxy(ipapi.asn)
    return { isVpnOrProxy: hinted, failed: false }
  } catch (err) {
    console.error('[deprize] vpn check failed', err)
    return { isVpnOrProxy: false, failed: true }
  }
}
