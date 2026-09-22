import { DEPRIZE_TERMS_VERSION } from './constants'

export type PayloadCopyMode = 'proposed' | 'in-force'

export const PAYLOAD_IN_FORCE_TERMS_VERSION = '1.2'

/** Shared disclaimer token for `'proposed'` copy that mentions a payload. */
export const PAYLOAD_PROPOSED_TOKEN = /draft|not in force/i

export type PayloadCopyKey =
  | 'poolStatLabel'
  | 'poolStatTooltip'
  | 'fivePercentLine'
  | 'heroPoolLabel'
  | 'cardPoolLabel'
  | 'disclosureSentence'
  | 'explainerPrefix'

export const PAYLOAD_COPY_KEYS: PayloadCopyKey[] = [
  'poolStatLabel',
  'poolStatTooltip',
  'fivePercentLine',
  'heroPoolLabel',
  'cardPoolLabel',
  'disclosureSentence',
  'explainerPrefix',
]

export type PayloadTierId = 'unknown' | 'nameplate' | 'data-capsule' | 'larger-slot'

export type PayloadTier = {
  id: PayloadTierId
  label: string
  /** One sentence for the explainer. Aspirational, never a promise. */
  blurb: string
  /** USD needed for the next tier, or null at the top / when unknown. */
  nextThresholdUsd: number | null
}

export const PAYLOAD_TIER_CAPSULE_USD = 5_000
export const PAYLOAD_TIER_SLOT_USD = 25_000
export const PAYLOAD_TIER_ROUNDING_USD = 500

const PAYLOAD_CLAIM_RE = /payload/i
const UNQUALIFIED_PAYLOAD_RE = /buys? the (community )?payload/i

function parseVersion(value: string): number[] | null {
  if (!value || typeof value !== 'string') return null
  const parts = value.trim().split('.')
  if (parts.length === 0 || parts.some((part) => !/^\d+$/.test(part))) return null
  return parts.map((part) => Number(part))
}

function compareVersions(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const left = a[i] ?? 0
    const right = b[i] ?? 0
    if (left !== right) return left - right
  }
  return 0
}

/**
 * `'in-force'` iff termsVersion >= PAYLOAD_IN_FORCE_TERMS_VERSION ('1.2').
 * Comparison is numeric per dot-separated segment — NOT lexicographic.
 * Unparseable or missing version -> `'proposed'` (fail closed).
 */
export function payloadCopyMode(termsVersion: string): PayloadCopyMode {
  const parsed = parseVersion(termsVersion)
  const floor = parseVersion(PAYLOAD_IN_FORCE_TERMS_VERSION)
  if (!parsed || !floor) return 'proposed'
  return compareVersions(parsed, floor) >= 0 ? 'in-force' : 'proposed'
}

const COPY: Record<PayloadCopyMode, Record<PayloadCopyKey, string>> = {
  proposed: {
    poolStatLabel: 'Prize pool · to winner',
    poolStatTooltip:
      'Paid to the winning competitor when the race settles. Separate from what bettors win — bettor payouts come from the betting market.',
    fivePercentLine: "5% of every bet funds this DePrize's launchpad prize pool",
    heroPoolLabel: 'prize pool',
    cardPoolLabel: 'prize pool',
    disclosureSentence:
      "Where the 5% goes. Every bet sends 5% to this prize's pool. Today that pool pays ETH to the winning competitor. MoonDAO has proposed buying a community payload on the winner's next flight instead — that change is a draft and is not in force.",
    explainerPrefix: 'Proposed / not a contract (Terms v1.1 govern).',
  },
  'in-force': {
    poolStatLabel: 'Prize pool · community payload',
    poolStatTooltip: "Buys a community payload on the winner's next flight.",
    fivePercentLine: "5% of every bet funds a community payload on the winner's next flight",
    heroPoolLabel: 'prize pool · payload',
    cardPoolLabel: 'prize pool · payload',
    disclosureSentence:
      "Where the 5% goes. Every bet sends 5% to this prize's pool. That pool buys a community payload on the winner's next flight.",
    explainerPrefix: '',
  },
}

export function payloadCopy(key: PayloadCopyKey, mode: PayloadCopyMode): string {
  return COPY[mode][key]
}

export function currentPayloadCopyMode(): PayloadCopyMode {
  return payloadCopyMode(DEPRIZE_TERMS_VERSION)
}

export function proposedCopyIsSafe(text: string): boolean {
  if (!PAYLOAD_CLAIM_RE.test(text)) return true
  return PAYLOAD_PROPOSED_TOKEN.test(text) && !UNQUALIFIED_PAYLOAD_RE.test(text)
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step
}

export function describePayloadTier(poolUsd: number | null | undefined): PayloadTier {
  if (poolUsd == null || !Number.isFinite(poolUsd) || poolUsd < 0) {
    return {
      id: 'unknown',
      label: 'Unknown',
      blurb: 'Once the pool has a USD quote we can describe a payload tier.',
      nextThresholdUsd: null,
    }
  }

  const rounded = roundToNearest(poolUsd, PAYLOAD_TIER_ROUNDING_USD)
  if (rounded < PAYLOAD_TIER_CAPSULE_USD) {
    return {
      id: 'nameplate',
      label: 'Nameplate',
      blurb: 'At this size we would be aiming for a nameplate / plaque.',
      nextThresholdUsd: PAYLOAD_TIER_CAPSULE_USD,
    }
  }
  if (rounded < PAYLOAD_TIER_SLOT_USD) {
    return {
      id: 'data-capsule',
      label: 'Data capsule',
      blurb: 'At this size we would be aiming for a small data capsule.',
      nextThresholdUsd: PAYLOAD_TIER_SLOT_USD,
    }
  }
  return {
    id: 'larger-slot',
    label: 'Larger slot',
    blurb: "At this size we would be aiming for a larger outreach / payload slot on the winner's next flight.",
    nextThresholdUsd: null,
  }
}

export function formatUsdEstimate(usd: number): string {
  return `$${Math.round(usd).toLocaleString('en-US')}`
}

export function payloadTierExplainer(input: {
  mode: PayloadCopyMode
  poolUsd: number | null | undefined
  asOf: string | null | undefined
}): string {
  const tier = describePayloadTier(input.poolUsd)
  if (tier.id === 'unknown') {
    return 'Once the pool has a USD quote we can describe a payload tier.'
  }

  const prefix = payloadCopy('explainerPrefix', input.mode)
  const prefixBit = prefix ? `${prefix} ` : ''
  const usd = formatUsdEstimate(Number(input.poolUsd))
  const asOf = input.asOf?.trim() || 'an unknown time'
  const next =
    tier.nextThresholdUsd != null ? formatUsdEstimate(tier.nextThresholdUsd) : null

  if (tier.id === 'nameplate') {
    return `${prefixBit}The pool is about ${usd} today. At this size we'd be aiming for a nameplate; a data capsule needs roughly ${next}. Pool value uses the ETH price as of ${asOf}.`
  }
  if (tier.id === 'data-capsule') {
    return `${prefixBit}The pool is about ${usd} today. At this size we'd be aiming for a data capsule; a larger slot needs roughly ${next}. Pool value uses the ETH price as of ${asOf}.`
  }
  return `${prefixBit}The pool is about ${usd} today. At this size we'd be aiming for a larger outreach / payload slot on the winner's next flight. Pool value uses the ETH price as of ${asOf}.`
}
