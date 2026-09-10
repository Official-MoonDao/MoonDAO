import { Redis } from '@upstash/redis'
import { getAddress } from 'viem'
import { isHexAddress } from './eligibility'

const OFAC_ETH_URL =
  'https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/master/sanctioned_addresses_ETH.txt'
const OFAC_CACHE_KEY = 'deprize:ofac:eth'
const OFAC_CACHE_TTL_SECONDS = 60 * 60 * 12

export type SanctionsResult = {
  isSanctioned: boolean
  failed: boolean
}

export function parseOfacEthList(text: string): Set<string> {
  const out = new Set<string>()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (isHexAddress(line)) out.add(line.toLowerCase())
  }
  return out
}

function extraAddresses(): Set<string> {
  const raw = process.env.DEPRIZE_SANCTIONS_EXTRA_ADDRESSES || ''
  const out = new Set<string>()
  for (const part of raw.split(',')) {
    const addr = part.trim()
    if (isHexAddress(addr)) out.add(addr.toLowerCase())
  }
  return out
}

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

async function loadOfacSet(): Promise<Set<string>> {
  const cache = redis()
  if (cache) {
    try {
      const cached = await cache.get<string[]>(OFAC_CACHE_KEY)
      if (cached && cached.length > 0) return new Set(cached)
    } catch (err) {
      console.error('[deprize] ofac cache read failed', err)
    }
  }

  const res = await fetch(OFAC_ETH_URL, {
    headers: { 'User-Agent': 'MoonDAO/1.0' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`ofac list ${res.status}`)
  const set = parseOfacEthList(await res.text())
  if (set.size === 0) throw new Error('ofac list empty')

  if (cache) {
    try {
      await cache.set(OFAC_CACHE_KEY, [...set], { ex: OFAC_CACHE_TTL_SECONDS })
    } catch (err) {
      console.error('[deprize] ofac cache write failed', err)
    }
  }
  return set
}

async function checkChainalysis(address: string): Promise<boolean | null> {
  const key = process.env.CHAINALYSIS_API_KEY
  if (!key) return null
  const res = await fetch(`https://public.chainalysis.com/api/v1/address/${address}`, {
    headers: { 'X-API-Key': key, Accept: 'application/json' },
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) throw new Error(`chainalysis ${res.status}`)
  const data = (await res.json()) as { identifications?: { category?: string }[] }
  return (data.identifications || []).some((id) => /sanction/i.test(id.category || ''))
}

export async function screenWallet(wallet: string): Promise<SanctionsResult> {
  if (!isHexAddress(wallet)) {
    return { isSanctioned: false, failed: false }
  }
  const checksummed = getAddress(wallet)
  const lower = checksummed.toLowerCase()

  try {
    if (extraAddresses().has(lower)) {
      return { isSanctioned: true, failed: false }
    }
    const chainalysis = await checkChainalysis(checksummed)
    if (chainalysis === true) {
      return { isSanctioned: true, failed: false }
    }
    const ofac = await loadOfacSet()
    return { isSanctioned: ofac.has(lower), failed: false }
  } catch (err) {
    console.error('[deprize] sanctions screen failed', err)
    return { isSanctioned: false, failed: true }
  }
}
