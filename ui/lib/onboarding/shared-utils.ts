import { getAccessToken } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import cleanData from '@/lib/tableland/cleanData'
import { CitizenData } from '@/lib/typeform/citizenFormData'
import { addHttpsIfMissing, bytesOfString } from '@/lib/utils/strings'

// The citizen table stores each profile field on-chain; mirror the 1024-byte
// guard the edit modal enforces so an oversized free-text answer can't inflate
// gas or revert the mint with an opaque error.
const MAX_PROFILE_FIELD_BYTES = 1024

/**
 * Truncate a string so its UTF-8 byte length never exceeds `maxBytes`, without
 * splitting a multi-byte character.
 */
export function capToBytes(value: string, maxBytes = MAX_PROFILE_FIELD_BYTES): string {
  if (bytesOfString(value) <= maxBytes) return value
  let truncated = value
  while (truncated.length > 0 && bytesOfString(truncated) > maxBytes) {
    truncated = truncated.slice(0, -1)
  }
  return truncated
}

export type CitizenProfileMintFields = {
  bio: string
  location: string
  discord: string
  twitter: string
  website: string
  view: string
}

/**
 * Geocode a free-text location into the same `{lat,lng,name}` JSON the citizen
 * edit modal stores, so checkout-minted citizens land at their real coordinates
 * on the network globe instead of the "no coordinates" Antarctica scatter zone.
 *
 * On geocode failure (or empty input) we fall back to `{lat:0,lng:0,name}` — the
 * (0,0) sentinel is recognized downstream as "no coordinates yet, geocode later"
 * while still preserving a clean, unquoted display name. Mirrors the edit modal.
 */
async function resolveLocationField(rawLocation: string): Promise<string> {
  const trimmed = capToBytes((rawLocation || '').trim())
  if (trimmed === '') return ''
  try {
    const res = await fetch('/api/google/geocoder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: trimmed }),
    })
    const { data } = await res.json()
    const geocoded = data?.results?.[0]
    if (geocoded?.geometry?.location) {
      return JSON.stringify(
        cleanData({
          lat: geocoded.geometry.location.lat,
          lng: geocoded.geometry.location.lng,
          name: geocoded.formatted_address || trimmed,
        })
      )
    }
  } catch (err) {
    console.error('Failed to geocode citizen location at mint:', err)
  }
  return JSON.stringify(cleanData({ lat: 0, lng: 0, name: trimmed }))
}

/**
 * Builds the optional profile metadata for a citizen mint from the values the
 * user entered in the "Additional Details" step at checkout. These map 1:1 onto
 * the `Citizen.mintTo` params (bio, location, discord, twitter, website, _view).
 *
 * Without this, everything the user types — including their Public/Private
 * visibility choice — is silently dropped and every citizen is minted as a blank
 * PUBLIC profile (a privacy regression for anyone who selected Private).
 *
 * Socials are normalized and length-capped exactly like the citizen edit modal,
 * and the location is geocoded to `{lat,lng,name}` JSON so the globe renders it
 * correctly. Performs a network call (geocoder), so resolve it once per mint and
 * thread the result through both the mint and the local cache seed.
 */
export async function buildCitizenProfileMintFields(
  citizenData: CitizenData
): Promise<CitizenProfileMintFields> {
  const rawDiscord = (citizenData.discord || '').trim()
  const discord = rawDiscord.startsWith('@')
    ? rawDiscord.replace(/^@+/, '')
    : rawDiscord
  return {
    bio: capToBytes(citizenData.description || ''),
    location: await resolveLocationField(citizenData.location || ''),
    discord: capToBytes(discord),
    twitter: citizenData.twitter
      ? capToBytes(addHttpsIfMissing(citizenData.twitter.trim()))
      : '',
    website: citizenData.website
      ? capToBytes(addHttpsIfMissing(citizenData.website.trim()))
      : '',
    // Honor the user's visibility selection; default to public when untouched,
    // and constrain to the allowed enum as defense-in-depth.
    view: citizenData.view === 'private' ? 'private' : 'public',
  }
}

/**
 * Estimates gas for a transaction using the gas estimation API
 */
export async function estimateGasWithAPI(params: {
  chainId: number
  from: string
  to: string
  data: string
  value: string
}): Promise<bigint> {
  const response = await fetch('/api/rpc/estimate-gas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`Gas estimation API returned ${response.status}`)
  }

  const data = await response.json()
  if (data.error) throw new Error(data.error)

  return BigInt(data.gasEstimate)
}

/**
 * Applies a buffer percentage to a gas estimate
 */
export function applyGasBuffer(gasEstimate: bigint, bufferPercent: number): bigint {
  return (gasEstimate * BigInt(bufferPercent)) / BigInt(100)
}

/**
 * Calculates total mint cost including gas and optional cross-chain fees
 */
export function calculateTotalMintCost(
  renewalCost: bigint,
  gasEstimate: bigint,
  gasPrice: bigint,
  options?: { crossChainFee?: bigint }
): number {
  const gasCostWei = gasEstimate * gasPrice
  const gasCostEth = Number(gasCostWei) / 1e18
  let totalCost = Number(ethers.utils.formatEther(renewalCost)) + gasCostEth

  if (options?.crossChainFee) {
    totalCost += Number(options.crossChainFee) / 1e18
  }

  return totalCost
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Privy's `getAccessToken()` can hang indefinitely right after an OAuth redirect
 * (the SDK reports `authenticated` from cached state while the token layer is
 * still re-initializing). Awaiting it directly would freeze the whole submission
 * with no timeout and no logs, so we race it against a timeout and treat a
 * non-resolving call as "no token yet" (the next poll attempt retries).
 */
async function getAccessTokenWithTimeout(timeoutMs: number): Promise<string | null> {
  try {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs)
    })
    const token = await Promise.race([getAccessToken(), timeout])
    if (timer) clearTimeout(timer)
    return (token as string | null) ?? null
  } catch {
    return null
  }
}

// Each server poll is now cheap (it bails out fast with 404 until Typeform has
// indexed the response), so we poll frequently to catch the answer within ~1s
// of it becoming available, over a ~45s total window before surfacing a retry.
const TYPEFORM_POLL_MAX_ATTEMPTS = 36
const TYPEFORM_POLL_INITIAL_DELAY_MS = 250
const TYPEFORM_POLL_MAX_DELAY_MS = 1000

/**
 * Handles Typeform submission with data formatting and cleaning.
 * Single request loop (no separate wait-then-fetch) with short backoff between polls.
 */
export async function handleTypeformSubmission(params: {
  formId: string
  responseId: string
  formatter: (answers: any, responseId: string) => any
  /** Skips heavy Tableland ownership checks — use for new citizen/team onboarding only. */
  onboarding?: boolean
}): Promise<any> {
  const onboarding = params.onboarding ?? true

  let lastStatus = 0
  // Fetch the token up front, but with a timeout so a stalled Privy SDK can't
  // freeze the whole submission. If it's not ready we retry a bounded number of
  // times below (a late-arriving token is common right after an OAuth redirect).
  let accessToken = await getAccessTokenWithTimeout(8000)
  let tokenRetries = 0
  const MAX_TOKEN_RETRIES = 4

  for (let attempt = 0; attempt < TYPEFORM_POLL_MAX_ATTEMPTS; attempt++) {
    if (!accessToken && tokenRetries < MAX_TOKEN_RETRIES) {
      tokenRetries++
      accessToken = await getAccessTokenWithTimeout(3000)
    }
    if (!accessToken && tokenRetries >= MAX_TOKEN_RETRIES) {
      // Privy never produced a session token — polling would just 401 forever.
      // Fail fast so the UI shows the retry prompt instead of hanging.
      throw new Error(
        'Could not verify your session. Please try again in a moment.'
      )
    }
    const authHeaders: HeadersInit = accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {}

    const response = await fetch('/api/typeform/response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        accessToken,
        responseId: params.responseId,
        formId: params.formId,
        onboarding,
      }),
    })

    lastStatus = response.status

    if (response.ok) {
      const data = await response.json()
      if (data.answers) {
        const formattedData = params.formatter(data.answers, params.responseId)
        return cleanData(formattedData)
      }
    }

    if (attempt < TYPEFORM_POLL_MAX_ATTEMPTS - 1) {
      const delay = Math.min(
        TYPEFORM_POLL_INITIAL_DELAY_MS + attempt * 250,
        TYPEFORM_POLL_MAX_DELAY_MS
      )
      await sleep(delay)
    }
  }

  throw new Error(
    `Failed to load Typeform response (last status: ${lastStatus}). Please try again.`
  )
}

/**
 * Extracts token ID from a transaction receipt by parsing the ERC-721 Transfer event.
 * ERC-721 Transfer has 4 topics (sig + from + to + tokenId), while ERC-20 Transfer
 * has 3 topics (sig + from + to) with the same signature, so we filter by topic count.
 */
export function extractTokenIdFromReceipt(receipt: any): string | null {
  if (!receipt?.logs) return null

  const transferEventSignature = ethers.utils.id('Transfer(address,address,uint256)')
  const transferLog = receipt.logs.find(
    (log: any) => log.topics[0] === transferEventSignature && log.topics.length === 4
  )

  if (!transferLog) return null

  return ethers.BigNumber.from(transferLog.topics[3]).toString()
}
