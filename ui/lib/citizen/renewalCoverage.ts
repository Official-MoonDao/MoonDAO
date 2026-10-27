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
 * Working name. Live mode adds this tag on the nominal entry day (30 days
 * left) and on the grace days in RENEWAL_ENTRY_GRACE_DAYS when this term
 * has no stage yet.
 */
export const RENEWAL_REMINDER_TAG = 'Renewal-Reminder'

/** Live mode adds this when expiresAt leaves the window, and removes Renewal-Reminder. */
export const RENEWED_TAG = 'Renewed'

/**
 * One Kit sequence, timed from the day Renewal-Reminder is applied.
 * Day 0, 23, 30, and 44 after entry are -30, -7, expiry day, and +14.
 * The Kit delays between those sends are 23 days, then 7 days, then 14 days.
 */
export const RENEWAL_SEQUENCE_EMAILS = [
  { id: 'minus30', sequenceDay: 0, daysToExpiry: 30 },
  { id: 'minus7', sequenceDay: 23, daysToExpiry: 7 },
  { id: 'expiry', sequenceDay: 30, daysToExpiry: 0 },
  { id: 'plus14', sequenceDay: 44, daysToExpiry: -14 },
] as const

/** Oct 2 list holds these stages only. Expiry day and +14 still send. */
export const PRE_EXPIRY_EMAILS = ['minus30', 'minus7'] as const

export function isPreExpiryEmail(id: SequenceEmailId | null): boolean {
  return id === 'minus30' || id === 'minus7'
}

export type SequenceEmailId = (typeof RENEWAL_SEQUENCE_EMAILS)[number]['id']

export const WINDOW_POSITIONS = ['enterToday', 'inside', 'expiredWithin14', 'outOfWindow'] as const
export type WindowPosition = (typeof WINDOW_POSITIONS)[number]

export const COVERAGE_BUCKETS = ['activeKit', 'typeformOnly', 'excluded', 'noEmail'] as const
export type CoverageBucket = (typeof COVERAGE_BUCKETS)[number]

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Nominal days-left bucket for Renewal-Reminder.
 * daysLeft is ceil((expiresAt - now) / 24h), so each bucket is 24 hours.
 */
export const RENEWAL_ENTRY_DAY = 30

/**
 * Extra daysLeft buckets after the nominal entry day that still get
 * Renewal-Reminder when this term has no stage yet.
 * 2 includes 29 and 28. A daily run that starts late lands on 29 when the
 * 30 bucket closed between runs. A skipped run whose next start is also
 * late lands on 28. 27 is the first bucket that stays on catch-up.
 * The term marker still allows only one stage, so grace does not tag
 * someone who was already staged at 30.
 */
export const RENEWAL_ENTRY_GRACE_DAYS = 2

/** Lowest daysLeft that still enters on Renewal-Reminder. */
export function renewalEntryMinDay(): number {
  return RENEWAL_ENTRY_DAY - RENEWAL_ENTRY_GRACE_DAYS
}

/** True for the nominal entry day and the late-run grace below it. */
export function isRenewalEntryDay(daysToExpiry: number): boolean {
  return daysToExpiry <= RENEWAL_ENTRY_DAY && daysToExpiry >= renewalEntryMinDay()
}

/** Same rounding as `daysUntilCitizenshipExpiry` in citizenSubscription.ts. */
export function daysUntilRenewal(expiresAtSec: number, nowMs: number): number | null {
  if (!Number.isFinite(expiresAtSec)) return null
  return Math.ceil((expiresAtSec * 1000 - nowMs) / MS_PER_DAY)
}

/**
 * enterToday: 28 to 30 days left. Live mode adds Renewal-Reminder when this
 * term has no stage yet. 29 and 28 are grace for a late or skipped daily run.
 * inside: 1 to 27 days left. expiredWithin14: expiry day through 14 days after.
 * Everyone else is out of the window.
 */
export function windowPosition(expiresAtSec: number, nowMs: number): WindowPosition | null {
  const days = daysUntilRenewal(expiresAtSec, nowMs)
  if (days === null) return null
  if (isRenewalEntryDay(days)) return 'enterToday'
  if (days >= 1 && days < renewalEntryMinDay()) return 'inside'
  if (days <= 0 && days >= -14) return 'expiredWithin14'
  return 'outOfWindow'
}

export function isInReminderWindow(expiresAtSec: number, nowMs: number): boolean {
  const position = windowPosition(expiresAtSec, nowMs)
  return position != null && position !== 'outOfWindow'
}

export const RENEWAL_STAGES = ['minus30', 'minus7', 'expiry', 'plus14', 'renewed'] as const
export type RenewalStage = (typeof RENEWAL_STAGES)[number]

/** One reminder entry per citizen per expiry term. */
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

/**
 * Written to Upstash after a successful tag change.
 * A later run that sees the key does not tag that stage again.
 */
export function renewalStageDedupeKey(
  tokenId: string,
  expiresAtSec: number,
  stage: RenewalStage
): string {
  if (!(RENEWAL_STAGES as readonly string[]).includes(stage)) {
    throw new Error('unknown renewal stage')
  }
  return `${renewalDedupeKey(tokenId, expiresAtSec)}:${stage}`
}

/**
 * One reminder or catch-up stage occupies a term.
 * Set after that tag succeeds. Value is the stage id (`minus30`, `minus7`,
 * `expiry`, or `plus14`). A new expiresAt is a different key.
 */
export function renewalTermMarkerKey(tokenId: string, expiresAtSec: number): string {
  const base = renewalDedupeKey(tokenId, expiresAtSec)
  return `renewal:term:${base.slice('renewal:'.length)}`
}

export type SequencePosition = {
  sequenceDay: number
  nextEmail: SequenceEmailId | null
  missedEmails: SequenceEmailId[]
}

/** Where this citizen would be if the sequence had started on day -30. */
export function expectedSequencePosition(daysToExpiry: number): SequencePosition {
  const sequenceDay = RENEWAL_ENTRY_DAY - daysToExpiry
  const missedEmails = RENEWAL_SEQUENCE_EMAILS.filter(
    (email) => email.sequenceDay < sequenceDay
  ).map((email) => email.id)
  const next = RENEWAL_SEQUENCE_EMAILS.find((email) => email.sequenceDay >= sequenceDay)
  return { sequenceDay, nextEmail: next?.id ?? null, missedEmails }
}

/**
 * Label for the dry-run coverage row. Entry days, including grace, start
 * the sequence on this run: the next email is minus30 and nothing is missed.
 * `expectedSequencePosition` stays the calendar hypothetical. Using it here
 * would call a grace entry a missed minus30 while live mode tags Renewal-Reminder.
 */
export function reportedSequencePosition(daysToExpiry: number): SequencePosition {
  if (isRenewalEntryDay(daysToExpiry)) {
    return { sequenceDay: 0, nextEmail: 'minus30', missedEmails: [] }
  }
  return expectedSequencePosition(daysToExpiry)
}

export const LATE_ENTRANT_CATCH_UP = `From ${renewalEntryMinDay()} through ${RENEWAL_ENTRY_DAY} days left, a term with no stage yet still gets Renewal-Reminder. That covers a daily run that starts late or does not run. Fewer days left do not get Renewal-Reminder. The sequence times from entry, so a later tag sends the -30 email on the wrong date. Live mode adds one catch-up tag for the next remaining email and leaves the earlier emails unsent.`

export const RENEWAL_EXIT_PLAN =
  'When expiresAt moves forward past 30 days, live mode adds the Renewed tag and removes Renewal-Reminder and the catch-up tags. The Renewed tag stays until the next cycle starts. That is the first day the new expiresAt is back inside the reminder window. Removing it in the same run would race the Kit exit rule that needs the tag present. At the start of the next cycle, live mode removes Renewed with DELETE /v4/tags/{tag_id}/subscribers/{subscriber_id} before the new reminder or catch-up tag is added. It never calls a global unsubscribe and never re-adds an unsubscribed subscriber. Kit still has no public API to remove one subscriber from one sequence. Writes run only when RENEWAL_REMINDERS_LIVE is true and the request includes live=1.'

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

/** Kit reads are GET requests on the v4 API. Tag writes live in a separate module. */
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
  /** Present when Kit already has this subscriber. Tag writes require it. */
  kitSubscriberId?: string | null
  suppressed: boolean
  /** Oct 2 triage list (`renewal:exclude:first-run`). Holds pre-expiry stages only. */
  firstRunRedis: boolean
  /** True when this subscriber still has the Renewed tag from an earlier term. */
  hasRenewedTag?: boolean
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
  onOct2List: boolean
  firstRunExclusion: 'redis' | null
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
    oct2HeldPreExpiry: number
    eligibleAfterFirstRunExclusion: number
  }
  buckets: Record<CoverageBucket, CoverageRow[]>
  firstRunOverlap: CoverageRow[]
  laterKitAdd: ReturnType<typeof futureKitAddPlan>
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
  const sequence = reportedSequencePosition(daysToExpiry)
  const onOct2List = row.firstRunRedis
  const base = {
    tokenId: String(row.tokenId),
    position,
    daysToExpiry,
    lateEntrant,
    sequence,
    catchUp: lateEntrant ? LATE_ENTRANT_CATCH_UP : null,
    dedupeKey: renewalDedupeKey(String(row.tokenId), expiresAt),
    onOct2List,
    firstRunExclusion: null as CoverageRow['firstRunExclusion'],
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

  if (onOct2List && isPreExpiryEmail(sequence.nextEmail)) {
    return {
      ...base,
      bucket: 'excluded',
      exclusionReason: 'oct2-pre-expiry',
      emailMasked,
      firstRunExclusion: 'redis',
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
  const firstRunOverlap = eligible.filter((row) => row.onOct2List)
  const oct2HeldPreExpiry = buckets.excluded.filter(
    (row) => row.exclusionReason === 'oct2-pre-expiry'
  ).length
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
      oct2HeldPreExpiry,
      eligibleAfterFirstRunExclusion: eligible.length,
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

export class UpstreamNonJsonError extends Error {
  readonly source: 'Tableland' | 'Kit' | 'Typeform'
  readonly status: number

  constructor(source: 'Tableland' | 'Kit' | 'Typeform', status: number, detail: string) {
    super(`${source} returned a non-JSON response (HTTP ${status}). ${detail}`)
    this.name = 'UpstreamNonJsonError'
    this.source = source
    this.status = status
  }
}

/**
 * Parse an upstream body. HTML from a retired gateway or a redirect landing
 * page becomes a named source error instead of `Unexpected token '<'`.
 */
export function parseUpstreamJson(
  source: 'Tableland' | 'Kit' | 'Typeform',
  status: number,
  contentType: string | null,
  body: string
): unknown {
  const trimmed = body.trim()
  const jsonLike = trimmed.startsWith('{') || trimmed.startsWith('[')
  if (!jsonLike) {
    const type = (contentType || '').toLowerCase()
    const kind = trimmed.startsWith('<') || type.includes('text/html') ? 'HTML' : 'a non-JSON body'
    throw new UpstreamNonJsonError(source, status, `Expected JSON and received ${kind}.`)
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new UpstreamNonJsonError(source, status, 'The body started like JSON but did not parse.')
  }
}

/** Email bucket counts are real only after both Typeform and Kit were read. */
export function renewalCountsComplete(sources: { typeform: boolean; kit: boolean }): boolean {
  return sources.typeform === true && sources.kit === true
}

/**
 * Omit dryRun, or pass 1 / true, and the route accepts the call.
 * Any explicit non-dry value is rejected. Live writes are a separate gate:
 * RENEWAL_REMINDERS_LIVE=true and ?live=1.
 */
export function nonDryRunRejection(value: unknown): string | null {
  if (value == null || value === '' || value === '1' || value === 'true' || value === true) {
    return null
  }
  return 'Omit dryRun or pass dryRun=1. Live tagging requires RENEWAL_REMINDERS_LIVE=true and live=1.'
}
