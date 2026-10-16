/**
 * Pure coverage rules for citizen renewal reminders.
 *
 * Reminders are on unless a citizen has opted out. This module never writes
 * to Kit, Typeform, Privy, Redis, or chain. A later change may create Kit
 * subscribers only through `futureKitAddPlan`, which refuses cancelled,
 * unsubscribed, bounced, and complained addresses.
 */

export const ARBITRUM_CITIZEN_NFT = '0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002'

/** Typeform forms the dry run searches. Presence is reported per env var, never the id. */
export const CITIZEN_TYPEFORM_FORM_ENV_KEYS = [
  'NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID',
  'NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID',
  'NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID',
] as const

/** Ops loads the Oct 2 triage batch here. The repo never stores those addresses. */
export const FIRST_RUN_EXCLUSION_SET = 'renewal:exclude:first-run'

/** Permanent opt-out, separate from the one-time first-run list. */
export const RENEWAL_SUPPRESSION_SET = 'renewal:suppress'

/**
 * This week's renewal broadcast. The numeric tag id comes from
 * RENEWAL_EXCLUSION_KIT_TAG_ID. The name is the fallback lookup key.
 */
export const RENEWAL_BROADCAST_TAG_NAME =
  'Citizens - renewal window Oct 2026 (tagged before 2025-11-29)'

/** Working name. Live mode adds this tag on day -30. This PR does not. */
export const RENEWAL_REMINDER_TAG = 'Renewal-Reminder'

/** Live mode adds this when expiresAt leaves the window, and removes Renewal-Reminder. */
export const RENEWED_TAG = 'Renewed'

/**
 * One Kit sequence, timed from the day Renewal-Reminder is applied.
 * Day 0, 16, 30, and 44 after entry are -30, -14, expiry day, and +14.
 */
export const RENEWAL_SEQUENCE_EMAILS = [
  { id: 'minus30', sequenceDay: 0, daysToExpiry: 30 },
  { id: 'minus14', sequenceDay: 16, daysToExpiry: 14 },
  { id: 'expiry', sequenceDay: 30, daysToExpiry: 0 },
  { id: 'plus14', sequenceDay: 44, daysToExpiry: -14 },
] as const

export type SequenceEmailId = (typeof RENEWAL_SEQUENCE_EMAILS)[number]['id']

export const WINDOW_POSITIONS = ['enterToday', 'inside', 'expiredWithin14', 'outOfWindow'] as const
export type WindowPosition = (typeof WINDOW_POSITIONS)[number]

export const COVERAGE_BUCKETS = ['activeKit', 'typeformOnly', 'excluded', 'noEmail'] as const
export type CoverageBucket = (typeof COVERAGE_BUCKETS)[number]

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Same rounding as `daysUntilCitizenshipExpiry` in citizenSubscription.ts. */
export function daysUntilRenewal(expiresAtSec: number, nowMs: number): number | null {
  if (!Number.isFinite(expiresAtSec)) return null
  return Math.ceil((expiresAtSec * 1000 - nowMs) / MS_PER_DAY)
}

/**
 * enterToday: 30 days left, the only day live mode would add Renewal-Reminder.
 * inside: 1 to 29 days left. expiredWithin14: expiry day through 14 days after.
 * Everyone else is out of the window.
 */
export function windowPosition(expiresAtSec: number, nowMs: number): WindowPosition | null {
  const days = daysUntilRenewal(expiresAtSec, nowMs)
  if (days === null) return null
  if (days === 30) return 'enterToday'
  if (days >= 1 && days <= 29) return 'inside'
  if (days <= 0 && days >= -14) return 'expiredWithin14'
  return 'outOfWindow'
}

export function isInReminderWindow(expiresAtSec: number, nowMs: number): boolean {
  const position = windowPosition(expiresAtSec, nowMs)
  return position != null && position !== 'outOfWindow'
}

/** One reminder entry per citizen per expiry term. Not written in this PR. */
export function renewalDedupeKey(tokenId: string, expiresAtSec: number): string {
  const id = String(tokenId).trim()
  if (!/^\d+$/.test(id)) {
    throw new Error('tokenId must be a decimal token id')
  }
  if (!Number.isInteger(expiresAtSec) || expiresAtSec < 0) {
    throw new Error('expiresAt must be a unix timestamp in seconds')
  }
  return `renewal:${id}:${expiresAtSec}`
}

export type SequencePosition = {
  sequenceDay: number
  nextEmail: SequenceEmailId | null
  missedEmails: SequenceEmailId[]
}

/** Where this citizen would be if the sequence had started on day -30. */
export function expectedSequencePosition(daysToExpiry: number): SequencePosition {
  const sequenceDay = 30 - daysToExpiry
  const missedEmails = RENEWAL_SEQUENCE_EMAILS.filter(
    (email) => email.sequenceDay < sequenceDay
  ).map((email) => email.id)
  const next = RENEWAL_SEQUENCE_EMAILS.find((email) => email.sequenceDay >= sequenceDay)
  return { sequenceDay, nextEmail: next?.id ?? null, missedEmails }
}

export const LATE_ENTRANT_CATCH_UP =
  'Do not add Renewal-Reminder. The sequence times from entry, so a late tag sends the -30 email on the wrong date. Live mode should use a separate catch-up tag for the next remaining email, or skip straight to that email, and leave the earlier emails unsent.'

export const RENEWAL_EXIT_PLAN =
  'When expiresAt moves out of the window, the future job adds the Renewed tag and removes Renewal-Reminder. A Kit rule removes anyone tagged Renewed from the sequence. This dry run does not add or remove tags.'

export function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.indexOf('@')
  if (at <= 0 || at === trimmed.length - 1) return '***'
  return `${trimmed.slice(0, 1)}***@${trimmed.slice(at + 1)}`
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const NEVER_READD = new Set(['cancelled', 'unsubscribed', 'bounced', 'complained'])

export class KitResubscribeBlocked extends Error {
  readonly state: string

  constructor(state: string) {
    super(
      `Refusing to create or re-add a Kit subscriber in state "${state}". Unsubscribed, cancelled, bounced, and complained addresses stay out.`
    )
    this.name = 'KitResubscribeBlocked'
    this.state = state
  }
}

/**
 * Hard guard for any future Kit write. `null` means the address is not in Kit
 * yet. `active` is already subscribed. Every opt-out or failure state throws,
 * including the word "unsubscribed", so a later caller cannot POST them back
 * onto a form, a tag, or the subscriber endpoint.
 */
export function assertNeverReaddKitSubscriber(state: string | null | undefined): void {
  if (state == null || state === '' || state === 'missing') return
  const normalized = state.trim().toLowerCase()
  if (normalized === 'active' || normalized === 'inactive') return
  if (NEVER_READD.has(normalized)) {
    throw new KitResubscribeBlocked(normalized)
  }
  throw new KitResubscribeBlocked(normalized)
}

export type FutureKitAddPlan = {
  executed: false
  action: 'already-active' | 'create-later' | 'leave-inactive'
  request: {
    method: 'POST'
    url: 'https://api.kit.com/v4/subscribers'
    docs: 'https://developers.kit.com/api-reference/subscribers/create-a-subscriber'
    body: {
      email_address: string
      state: 'active'
      fields: { citizen_token_id: string }
    }
  } | null
  doNotCall: string[]
}

const DO_NOT_CALL = [
  'POST https://api.convertkit.com/v3/forms/{formId}/subscribe',
  'POST https://api.kit.com/v4/forms/{form_id}/subscribers',
  'POST https://api.kit.com/v4/sequences/{sequence_id}/subscribers',
  'POST https://api.kit.com/v4/tags/{tag_id}/subscribers before the subscriber exists with state active',
]

/**
 * Describes the later add for a Typeform-only address. It does not perform
 * the request. Form subscribe is omitted on purpose: Kit sends the form
 * incentive email when a subscriber is added to a double opt-in form
 * (https://developers.kit.com/api-reference/forms/bulk-add-subscribers-to-forms).
 * Create a subscriber does not attach a form, so it does not send that email
 * or apply newsletter tags. Kit also documents that this endpoint does not
 * update state for someone who already exists, which keeps a cancelled
 * subscriber cancelled, but this function still refuses those states itself.
 */
export function futureKitAddPlan(
  state: string | null | undefined,
  email = '<email>',
  tokenId = '<tokenId>'
): FutureKitAddPlan {
  assertNeverReaddKitSubscriber(state)
  const normalized = (state || '').trim().toLowerCase()
  if (normalized === 'active') {
    return { executed: false, action: 'already-active', request: null, doNotCall: DO_NOT_CALL }
  }
  if (normalized === 'inactive') {
    return { executed: false, action: 'leave-inactive', request: null, doNotCall: DO_NOT_CALL }
  }
  return {
    executed: false,
    action: 'create-later',
    request: {
      method: 'POST',
      url: 'https://api.kit.com/v4/subscribers',
      docs: 'https://developers.kit.com/api-reference/subscribers/create-a-subscriber',
      body: {
        email_address: email,
        state: 'active',
        fields: { citizen_token_id: tokenId },
      },
    },
    doNotCall: DO_NOT_CALL,
  }
}

export type KitReadRequest = {
  method: 'GET'
  url: string
}

/** The only Kit request this PR is allowed to build. */
export function kitReadRequest(pathAndQuery: string): KitReadRequest {
  if (!pathAndQuery.startsWith('/v4/')) {
    throw new Error('Kit reads must use the v4 API')
  }
  if (pathAndQuery.includes(' ')) {
    throw new Error('Kit read path must be encoded')
  }
  return { method: 'GET', url: `https://api.kit.com${pathAndQuery}` }
}

export function kitSubscriberLookupPath(emails: string[]): string {
  if (emails.length === 0) throw new Error('at least one email')
  const params = new URLSearchParams({
    email_address: emails.map(normalizeEmail).join(','),
    status: 'all',
    slim: 'true',
    per_page: '500',
  })
  return `/v4/subscribers?${params.toString()}`
}

export function kitTagSubscribersPath(tagId: string, after?: string): string {
  if (!/^\d+$/.test(tagId)) throw new Error('Kit tag id must be digits')
  const params = new URLSearchParams({
    status: 'all',
    slim: 'true',
    per_page: '1000',
  })
  if (after) params.set('after', after)
  return `/v4/tags/${tagId}/subscribers?${params.toString()}`
}

export function kitListTagsPath(after?: string): string {
  const params = new URLSearchParams({ per_page: '1000' })
  if (after) params.set('after', after)
  return `/v4/tags?${params.toString()}`
}

export type CoverageInput = {
  tokenId: string
  expiresAt: number
  email: string | null
  kitState: string | null
  suppressed: boolean
  firstRunRedis: boolean
  firstRunKitTag: boolean
}

export type CoverageRow = {
  tokenId: string
  position: Exclude<WindowPosition, 'outOfWindow'>
  daysToExpiry: number
  lateEntrant: boolean
  sequence: SequencePosition
  catchUp: string | null
  bucket: CoverageBucket
  exclusionReason: string | null
  emailMasked: string | null
  dedupeKey: string
  firstRunExclusion: 'redis' | 'kit-tag' | 'redis+kit-tag' | null
}

export type PositionCounts = Record<WindowPosition, number>

export type CoverageReport = {
  ok: true
  dryRun: true
  readOnly: true
  reminderPolicy: 'on-unless-opt-out'
  generatedAt: string
  sequence: {
    tag: typeof RENEWAL_REMINDER_TAG
    renewedTag: typeof RENEWED_TAG
    emails: typeof RENEWAL_SEQUENCE_EMAILS
    exit: typeof RENEWAL_EXIT_PLAN
    lateEntrants: typeof LATE_ENTRANT_CATCH_UP
  }
  counts: {
    inWindow: number
    positions: PositionCounts
    activeKit: number
    typeformOnly: number
    excluded: number
    noEmail: number
    firstRunOverlap: number
    eligibleAfterFirstRunExclusion: number
  }
  buckets: Record<CoverageBucket, CoverageRow[]>
  firstRunOverlap: CoverageRow[]
  laterKitAdd: ReturnType<typeof futureKitAddPlan>
}

function firstRunLabel(redis: boolean, kitTag: boolean): CoverageRow['firstRunExclusion'] {
  if (redis && kitTag) return 'redis+kit-tag'
  if (redis) return 'redis'
  if (kitTag) return 'kit-tag'
  return null
}

function exclusionForKitState(state: string): string {
  const normalized = state.trim().toLowerCase()
  if (normalized === 'cancelled' || normalized === 'unsubscribed') return 'kit-cancelled'
  if (normalized === 'bounced') return 'kit-bounced'
  if (normalized === 'complained') return 'kit-complained'
  if (normalized === 'inactive') return 'kit-inactive'
  return `kit-${normalized}`
}

export function classifyRenewalRow(row: CoverageInput, nowMs: number): CoverageRow | null {
  const position = windowPosition(row.expiresAt, nowMs)
  if (!position || position === 'outOfWindow') return null
  const daysToExpiry = daysUntilRenewal(row.expiresAt, nowMs)
  if (daysToExpiry === null) return null
  const expiresAt = Math.trunc(row.expiresAt)
  const lateEntrant = position !== 'enterToday'
  const base = {
    tokenId: String(row.tokenId),
    position,
    daysToExpiry,
    lateEntrant,
    sequence: expectedSequencePosition(daysToExpiry),
    catchUp: lateEntrant ? LATE_ENTRANT_CATCH_UP : null,
    dedupeKey: renewalDedupeKey(String(row.tokenId), expiresAt),
    firstRunExclusion: firstRunLabel(row.firstRunRedis, row.firstRunKitTag),
  }

  if (!row.email) {
    return {
      ...base,
      bucket: 'noEmail',
      exclusionReason: 'no-email',
      emailMasked: null,
    }
  }

  const emailMasked = maskEmail(row.email)
  const kitState = row.kitState?.trim().toLowerCase() || null

  if (kitState && kitState !== 'active' && kitState !== 'missing') {
    return {
      ...base,
      bucket: 'excluded',
      exclusionReason: exclusionForKitState(kitState),
      emailMasked,
    }
  }

  if (row.suppressed) {
    return {
      ...base,
      bucket: 'excluded',
      exclusionReason: 'suppressed',
      emailMasked,
    }
  }

  if (kitState === 'active') {
    return { ...base, bucket: 'activeKit', exclusionReason: null, emailMasked }
  }

  return { ...base, bucket: 'typeformOnly', exclusionReason: null, emailMasked }
}

export function countWindowPositions(
  expiresAtValues: Array<number | null>,
  nowMs: number
): PositionCounts & { unknown: number } {
  const counts: PositionCounts & { unknown: number } = {
    enterToday: 0,
    inside: 0,
    expiredWithin14: 0,
    outOfWindow: 0,
    unknown: 0,
  }
  for (const expiresAt of expiresAtValues) {
    if (expiresAt == null) {
      counts.unknown += 1
      continue
    }
    const position = windowPosition(expiresAt, nowMs)
    if (!position) {
      counts.unknown += 1
      continue
    }
    counts[position] += 1
  }
  return counts
}

export function buildRenewalCoverageReport(
  rows: CoverageInput[],
  nowMs: number,
  positionCounts?: PositionCounts
): CoverageReport {
  const buckets: Record<CoverageBucket, CoverageRow[]> = {
    activeKit: [],
    typeformOnly: [],
    excluded: [],
    noEmail: [],
  }
  const fromRows: PositionCounts = {
    enterToday: 0,
    inside: 0,
    expiredWithin14: 0,
    outOfWindow: positionCounts?.outOfWindow ?? 0,
  }

  for (const row of rows) {
    const classified = classifyRenewalRow(row, nowMs)
    if (!classified) continue
    buckets[classified.bucket].push(classified)
    fromRows[classified.position] += 1
  }

  const positions = positionCounts ?? fromRows
  const eligible = [...buckets.activeKit, ...buckets.typeformOnly]
  const firstRunOverlap = eligible.filter((row) => row.firstRunExclusion)
  const inWindow = positions.enterToday + positions.inside + positions.expiredWithin14

  return {
    ok: true,
    dryRun: true,
    readOnly: true,
    reminderPolicy: 'on-unless-opt-out',
    generatedAt: new Date(nowMs).toISOString(),
    sequence: {
      tag: RENEWAL_REMINDER_TAG,
      renewedTag: RENEWED_TAG,
      emails: RENEWAL_SEQUENCE_EMAILS,
      exit: RENEWAL_EXIT_PLAN,
      lateEntrants: LATE_ENTRANT_CATCH_UP,
    },
    counts: {
      inWindow,
      positions,
      activeKit: buckets.activeKit.length,
      typeformOnly: buckets.typeformOnly.length,
      excluded: buckets.excluded.length,
      noEmail: buckets.noEmail.length,
      firstRunOverlap: firstRunOverlap.length,
      eligibleAfterFirstRunExclusion: eligible.length - firstRunOverlap.length,
    },
    buckets,
    firstRunOverlap,
    laterKitAdd: futureKitAddPlan(null),
  }
}

export type RenewalDryRunReadFlags = {
  tableland: boolean
  arbitrumExpiresAt: boolean
  typeform: boolean
  kit: boolean
  firstRunExclusion: boolean
}

/**
 * Boolean diagnostics for the dry-run JSON. Env entries are presence only.
 * Read entries are true only after that source returned successfully.
 * Values, form ids, emails, and key material never appear here.
 */
export type RenewalDryRunSources = {
  TYPEFORM_PERSONAL_ACCESS_TOKEN: boolean
  CONVERT_KIT_V4_API_KEY: boolean
  CONVERT_KIT_API_KEY: boolean
  UPSTASH_REDIS_URL: boolean
  UPSTASH_REDIS_TOKEN: boolean
  NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID: boolean
  NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID: boolean
  NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID: boolean
  tableland: boolean
  arbitrumExpiresAt: boolean
  typeform: boolean
  kit: boolean
  'renewal:exclude:first-run': boolean
}

export function envVarPresent(env: NodeJS.ProcessEnv, key: string): boolean {
  const value = env[key]
  return typeof value === 'string' && value.trim().length > 0
}

export function renewalDryRunSources(
  env: NodeJS.ProcessEnv,
  read: RenewalDryRunReadFlags
): RenewalDryRunSources {
  return {
    TYPEFORM_PERSONAL_ACCESS_TOKEN: envVarPresent(env, 'TYPEFORM_PERSONAL_ACCESS_TOKEN'),
    CONVERT_KIT_V4_API_KEY: envVarPresent(env, 'CONVERT_KIT_V4_API_KEY'),
    CONVERT_KIT_API_KEY: envVarPresent(env, 'CONVERT_KIT_API_KEY'),
    UPSTASH_REDIS_URL: envVarPresent(env, 'UPSTASH_REDIS_URL'),
    UPSTASH_REDIS_TOKEN: envVarPresent(env, 'UPSTASH_REDIS_TOKEN'),
    NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID: envVarPresent(
      env,
      'NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID'
    ),
    NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID: envVarPresent(
      env,
      'NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID'
    ),
    NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID: envVarPresent(
      env,
      'NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID'
    ),
    tableland: read.tableland,
    arbitrumExpiresAt: read.arbitrumExpiresAt,
    typeform: read.typeform,
    kit: read.kit,
    [FIRST_RUN_EXCLUSION_SET]: read.firstRunExclusion,
  }
}

/** Email bucket counts are real only after both Typeform and Kit were read. */
export function renewalCountsComplete(sources: { typeform: boolean; kit: boolean }): boolean {
  return sources.typeform === true && sources.kit === true
}

/**
 * Omit dryRun, or pass 1 / true, and the route stays a dry run.
 * Any explicit non-dry value is rejected.
 */
export function nonDryRunRejection(value: unknown): string | null {
  if (value == null || value === '' || value === '1' || value === 'true' || value === true) {
    return null
  }
  return 'This route is dry-run only. Omit dryRun or pass dryRun=1. Live tagging and sending are not implemented.'
}
