/**
 * Pure planning for citizen renewal reminder tags.
 * This module does not call Kit, Redis, Typeform, or chain.
 * Live execution lives in renewalCoverageWrite.ts and runs only when
 * RENEWAL_REMINDERS_LIVE is exactly "true" and the request has live=1.
 */
import {
  daysUntilRenewal,
  expectedSequencePosition,
  FIRST_RUN_EXCLUSION_SET,
  KitResubscribeBlocked,
  maskEmail,
  RENEWAL_REMINDER_TAG,
  RENEWED_TAG,
  renewalStageDedupeKey,
  RENEWAL_SUPPRESSION_SET,
  windowPosition,
  type CoverageInput,
  type RenewalStage,
} from '@/lib/citizen/renewalCoverage'

export const RENEWAL_OPEN_SET = 'renewal:open'
export const RENEWAL_WRITTEN_SET = 'renewal:written'

export const RENEWAL_TAG_KEYS = [
  'reminder',
  'catchupMinus14',
  'catchupExpiry',
  'catchupPlus14',
  'renewed',
] as const

export type RenewalTagKey = (typeof RENEWAL_TAG_KEYS)[number]

export const DEFAULT_RENEWAL_TAG_NAMES: Record<RenewalTagKey, string> = {
  reminder: RENEWAL_REMINDER_TAG,
  catchupMinus14: 'Renewal-Catchup-minus14',
  catchupExpiry: 'Renewal-Catchup-expiry',
  catchupPlus14: 'Renewal-Catchup-plus14',
  renewed: RENEWED_TAG,
}

const TAG_NAME_ENV: Record<RenewalTagKey, string> = {
  reminder: 'RENEWAL_REMINDER_TAG_NAME',
  catchupMinus14: 'RENEWAL_CATCHUP_MINUS14_TAG_NAME',
  catchupExpiry: 'RENEWAL_CATCHUP_EXPIRY_TAG_NAME',
  catchupPlus14: 'RENEWAL_CATCHUP_PLUS14_TAG_NAME',
  renewed: 'RENEWED_TAG_NAME',
}

const TAG_ID_ENV: Record<RenewalTagKey, string> = {
  reminder: 'RENEWAL_REMINDER_TAG_ID',
  catchupMinus14: 'RENEWAL_CATCHUP_MINUS14_TAG_ID',
  catchupExpiry: 'RENEWAL_CATCHUP_EXPIRY_TAG_ID',
  catchupPlus14: 'RENEWAL_CATCHUP_PLUS14_TAG_ID',
  renewed: 'RENEWED_TAG_ID',
}

export const WRITE_BUCKETS = [
  'renewalReminder',
  'catchupMinus14',
  'catchupExpiry',
  'catchupPlus14',
  'renewed',
  'typeformOnly',
] as const

export type WriteBucket = (typeof WRITE_BUCKETS)[number]

const STAGE_BUCKET: Record<RenewalStage, Exclude<WriteBucket, 'typeformOnly'> | null> = {
  minus30: 'renewalReminder',
  minus14: 'catchupMinus14',
  expiry: 'catchupExpiry',
  plus14: 'catchupPlus14',
  renewed: 'renewed',
}

const STAGE_TAG: Record<Exclude<RenewalStage, 'renewed'>, RenewalTagKey> = {
  minus30: 'reminder',
  minus14: 'catchupMinus14',
  expiry: 'catchupExpiry',
  plus14: 'catchupPlus14',
}

const OPT_OUT = new Set(['cancelled', 'unsubscribed', 'bounced', 'complained'])

export type RenewalTagNames = Record<RenewalTagKey, string>

export type OpenRecord = {
  tokenId: string
  expiresAt: number
  stage: RenewalStage
  key: string
}

export type ForwardRenewal = {
  tokenId: string
  expiresAt: number
  previousExpiresAt: number
  openMembers: string[]
}

export type PlannedRenewalWrite = {
  tokenId: string
  expiresAt: number
  emailMasked: string
  subscriberId: string
  kitState: string
  stage: RenewalStage
  bucket: Exclude<WriteBucket, 'typeformOnly'>
  dedupeKey: string
  ops: Array<{ op: 'add' | 'remove'; tagKey: RenewalTagKey }>
  openMembers: string[]
}

export type RenewalSkipCounts = {
  deduped: number
  suppressed: number
  firstRun: number
  kitOptOut: number
  noEmail: number
  kitNotActive: number
  noSubscriberId: number
  typeformOnly: number
}

export type RenewalPlan = {
  writes: PlannedRenewalWrite[]
  skipped: RenewalSkipCounts
}

export type RenewalWriteBuckets = {
  renewalReminder: { planned: number; executed: number }
  catchupMinus14: { planned: number; executed: number }
  catchupExpiry: { planned: number; executed: number }
  catchupPlus14: { planned: number; executed: number }
  renewed: { planned: number; executed: number }
  typeformOnly: { planned: number; executed: number; reported: number }
}

export type PublicRenewalAction = {
  tokenId: string
  emailMasked: string
  bucket: Exclude<WriteBucket, 'typeformOnly'>
  stage: RenewalStage
  dedupeKey: string
  planned: true
  executed: boolean
  ops: Array<{ op: 'add' | 'remove'; tag: string }>
}

export type RenewalLiveDecision = {
  writing: boolean
  live: boolean
  liveRequested: boolean
  reason: string
}

export type PublicRenewalWrites = {
  live: boolean
  liveRequested: boolean
  writing: boolean
  reason: string
  tags: RenewalTagNames
  tagIds: Record<RenewalTagKey, string | null> | null
  missingTags: string[]
  buckets: RenewalWriteBuckets
  skipped: RenewalSkipCounts
  failures: number
  failed: Array<{ tokenId: string; stage: RenewalStage }>
  actions: PublicRenewalAction[]
  warnings: string[]
  exclusionKeys: {
    suppress: typeof RENEWAL_SUPPRESSION_SET
    firstRun: typeof FIRST_RUN_EXCLUSION_SET
  }
}

export function renewalTagNames(env: NodeJS.ProcessEnv): RenewalTagNames {
  const names = { ...DEFAULT_RENEWAL_TAG_NAMES }
  for (const key of RENEWAL_TAG_KEYS) {
    const override = env[TAG_NAME_ENV[key]]?.trim()
    if (override) names[key] = override
  }
  return names
}

export function isRenewalLiveEnabled(
  env: NodeJS.ProcessEnv,
  liveParam: string | undefined
): boolean {
  return env.RENEWAL_REMINDERS_LIVE === 'true' && liveParam === '1'
}

export function renewalLiveDecision(
  env: NodeJS.ProcessEnv,
  liveParam: string | undefined,
  safety: {
    exclusionsReady: boolean
    dedupeReady: boolean
    tagsReady: boolean
    tagLookupFailed?: boolean
  }
): RenewalLiveDecision {
  const envOn = env.RENEWAL_REMINDERS_LIVE === 'true'
  const queryOn = liveParam === '1'
  const liveRequested = envOn && queryOn
  if (!envOn || !queryOn) {
    const reason =
      !envOn && queryOn
        ? 'Dry run. RENEWAL_REMINDERS_LIVE is not true.'
        : envOn && !queryOn
        ? 'Dry run. live=1 was not set.'
        : 'Dry run. RENEWAL_REMINDERS_LIVE is not true or live=1 was not set.'
    return { writing: false, live: false, liveRequested, reason }
  }
  if (!safety.exclusionsReady) {
    return {
      writing: false,
      live: false,
      liveRequested,
      reason: 'Dry run. Exclusion sets were not read, so nothing was written.',
    }
  }
  if (!safety.dedupeReady) {
    return {
      writing: false,
      live: false,
      liveRequested,
      reason: 'Dry run. The dedupe book was not read, so nothing was written.',
    }
  }
  if (!safety.tagsReady) {
    return {
      writing: false,
      live: false,
      liveRequested,
      reason: safety.tagLookupFailed
        ? 'Dry run. Kit tag ids could not be resolved, so nothing was written.'
        : 'Dry run. One or more Kit tags are missing, so nothing was written.',
    }
  }
  return {
    writing: true,
    live: true,
    liveRequested,
    reason: 'Live writes are enabled.',
  }
}

export function resolveRenewalTagIds(
  names: RenewalTagNames,
  env: NodeJS.ProcessEnv,
  listed: Array<{ id: string; name: string }>
): { ids: Record<RenewalTagKey, string | null>; missing: string[] } {
  const byName = new Map<string, string>()
  for (const tag of listed) {
    if (tag.name && /^\d+$/.test(tag.id)) byName.set(tag.name, tag.id)
  }
  const ids = {} as Record<RenewalTagKey, string | null>
  const missing: string[] = []
  for (const key of RENEWAL_TAG_KEYS) {
    const fromEnv = env[TAG_ID_ENV[key]]?.trim()
    if (fromEnv) {
      if (!/^\d+$/.test(fromEnv)) {
        throw new Error(`${TAG_ID_ENV[key]} must be digits`)
      }
      ids[key] = fromEnv
      continue
    }
    const found = byName.get(names[key]) || null
    ids[key] = found
    if (!found) missing.push(names[key])
  }
  return { ids, missing }
}

export function parseRenewalStageKey(value: string): OpenRecord | null {
  const match = /^renewal:(\d+):(\d+):(minus30|minus14|expiry|plus14|renewed)$/.exec(value)
  if (!match) return null
  return {
    tokenId: match[1],
    expiresAt: Number(match[2]),
    stage: match[3] as RenewalStage,
    key: value,
  }
}

/**
 * Open reminder tags whose expiry moved forward to more than 30 days out.
 * Time passing out the back of the window is not a renewal.
 */
export function selectForwardRenewals(
  openRecords: OpenRecord[],
  expiresAtByToken: Map<string, number | null>,
  nowMs: number
): ForwardRenewal[] {
  const byToken = new Map<string, OpenRecord[]>()
  for (const record of openRecords) {
    if (record.stage === 'renewed') continue
    const list = byToken.get(record.tokenId) || []
    list.push(record)
    byToken.set(record.tokenId, list)
  }
  const renewals: ForwardRenewal[] = []
  for (const [tokenId, records] of byToken) {
    const current = expiresAtByToken.get(tokenId)
    if (current == null) continue
    const expiresAt = Math.trunc(current)
    const previousExpiresAt = Math.max(...records.map((record) => record.expiresAt))
    if (!(expiresAt > previousExpiresAt)) continue
    const days = daysUntilRenewal(expiresAt, nowMs)
    if (days == null || days <= 30) continue
    renewals.push({
      tokenId,
      expiresAt,
      previousExpiresAt,
      openMembers: records.map((record) => record.key),
    })
  }
  return renewals
}

/**
 * Day -30 gets Renewal-Reminder. Anyone already past -30 gets the catch-up
 * tag for the next email only, never Renewal-Reminder.
 */
export function stageForReminder(expiresAtSec: number, nowMs: number): RenewalStage | null {
  const expiresAt = Math.trunc(expiresAtSec)
  const position = windowPosition(expiresAt, nowMs)
  if (!position || position === 'outOfWindow') return null
  if (position === 'enterToday') return 'minus30'
  const days = daysUntilRenewal(expiresAt, nowMs)
  if (days == null) return null
  const next = expectedSequencePosition(days).nextEmail
  if (next === 'minus14' || next === 'expiry' || next === 'plus14') return next
  return null
}

function emptySkips(): RenewalSkipCounts {
  return {
    deduped: 0,
    suppressed: 0,
    firstRun: 0,
    kitOptOut: 0,
    noEmail: 0,
    kitNotActive: 0,
    noSubscriberId: 0,
    typeformOnly: 0,
  }
}

type SkipReason = keyof RenewalSkipCounts

function skipReason(row: CoverageInput): SkipReason | null {
  if (!row.email) return 'noEmail'
  const state = row.kitState?.trim().toLowerCase() || null
  if (state && OPT_OUT.has(state)) return 'kitOptOut'
  if (state !== 'active') {
    if (!state || state === 'missing') return 'typeformOnly'
    return 'kitNotActive'
  }
  if (row.suppressed) return 'suppressed'
  if (row.firstRunRedis || row.firstRunKitTag) return 'firstRun'
  if (!row.kitSubscriberId || !/^\d+$/.test(row.kitSubscriberId)) return 'noSubscriberId'
  return null
}

function reminderOps(stage: Exclude<RenewalStage, 'renewed'>): PlannedRenewalWrite['ops'] {
  return [{ op: 'add', tagKey: STAGE_TAG[stage] }]
}

function renewedOps(): PlannedRenewalWrite['ops'] {
  return [
    { op: 'add', tagKey: 'renewed' },
    { op: 'remove', tagKey: 'reminder' },
    { op: 'remove', tagKey: 'catchupMinus14' },
    { op: 'remove', tagKey: 'catchupExpiry' },
    { op: 'remove', tagKey: 'catchupPlus14' },
  ]
}

export function planRenewalWrites(args: {
  rows: CoverageInput[]
  renewals: Array<CoverageInput & { openMembers: string[] }>
  nowMs: number
  writtenKeys: ReadonlySet<string>
}): RenewalPlan {
  const skipped = emptySkips()
  const writes: PlannedRenewalWrite[] = []

  for (const row of args.rows) {
    const stage = stageForReminder(row.expiresAt, args.nowMs)
    if (!stage || stage === 'renewed') continue
    const reason = skipReason(row)
    if (reason) {
      skipped[reason] += 1
      continue
    }
    const expiresAt = Math.trunc(row.expiresAt)
    const dedupeKey = renewalStageDedupeKey(row.tokenId, expiresAt, stage)
    if (args.writtenKeys.has(dedupeKey)) {
      skipped.deduped += 1
      continue
    }
    const bucket = STAGE_BUCKET[stage]
    if (!bucket) continue
    writes.push({
      tokenId: String(row.tokenId),
      expiresAt,
      emailMasked: maskEmail(row.email || ''),
      subscriberId: row.kitSubscriberId as string,
      kitState: 'active',
      stage,
      bucket,
      dedupeKey,
      ops: reminderOps(stage),
      openMembers: [],
    })
  }

  for (const row of args.renewals) {
    const reason = skipReason(row)
    if (reason) {
      skipped[reason] += 1
      continue
    }
    const expiresAt = Math.trunc(row.expiresAt)
    const dedupeKey = renewalStageDedupeKey(row.tokenId, expiresAt, 'renewed')
    if (args.writtenKeys.has(dedupeKey)) {
      skipped.deduped += 1
      continue
    }
    writes.push({
      tokenId: String(row.tokenId),
      expiresAt,
      emailMasked: maskEmail(row.email || ''),
      subscriberId: row.kitSubscriberId as string,
      kitState: 'active',
      stage: 'renewed',
      bucket: 'renewed',
      dedupeKey,
      ops: renewedOps(),
      openMembers: row.openMembers,
    })
  }

  return { writes, skipped }
}

export function kitAddTagRequest(
  tagId: string,
  subscriberId: string,
  state: string | null | undefined
): { method: 'POST'; url: string; body: '{}' } {
  assertActiveTagTarget(state, subscriberId)
  if (!/^\d+$/.test(tagId)) throw new Error('Kit tag id must be digits')
  return {
    method: 'POST',
    url: `https://api.kit.com/v4/tags/${tagId}/subscribers/${subscriberId}`,
    body: '{}',
  }
}

export function kitRemoveTagRequest(
  tagId: string,
  subscriberId: string,
  state: string | null | undefined
): { method: 'DELETE'; url: string } {
  assertActiveTagTarget(state, subscriberId)
  if (!/^\d+$/.test(tagId)) throw new Error('Kit tag id must be digits')
  return {
    method: 'DELETE',
    url: `https://api.kit.com/v4/tags/${tagId}/subscribers/${subscriberId}`,
  }
}

/**
 * Tag changes are allowed only for an existing active subscriber id.
 * Opt-out states throw KitResubscribeBlocked before any request is built.
 */
export function assertActiveTagTarget(
  state: string | null | undefined,
  subscriberId: string
): void {
  const normalized = (state || '').trim().toLowerCase()
  if (OPT_OUT.has(normalized)) {
    throw new KitResubscribeBlocked(normalized)
  }
  if (normalized !== 'active') {
    throw new Error('Refusing to tag a Kit subscriber who is not active')
  }
  if (!/^\d+$/.test(subscriberId)) {
    throw new Error('Refusing to tag without an existing Kit subscriber id')
  }
}

export function toPublicRenewalWrites(args: {
  decision: RenewalLiveDecision
  plan: RenewalPlan
  tagNames: RenewalTagNames
  tagIds: Record<RenewalTagKey, string | null> | null
  missingTags: string[]
  executedKeys: ReadonlySet<string>
  failed: Array<{ tokenId: string; stage: RenewalStage }>
  warnings?: string[]
}): PublicRenewalWrites {
  const buckets: RenewalWriteBuckets = {
    renewalReminder: { planned: 0, executed: 0 },
    catchupMinus14: { planned: 0, executed: 0 },
    catchupExpiry: { planned: 0, executed: 0 },
    catchupPlus14: { planned: 0, executed: 0 },
    renewed: { planned: 0, executed: 0 },
    typeformOnly: {
      planned: 0,
      executed: 0,
      reported: args.plan.skipped.typeformOnly,
    },
  }
  const actions: PublicRenewalAction[] = []
  for (const write of args.plan.writes) {
    const executed = args.executedKeys.has(write.dedupeKey)
    buckets[write.bucket].planned += 1
    if (executed) buckets[write.bucket].executed += 1
    actions.push({
      tokenId: write.tokenId,
      emailMasked: write.emailMasked,
      bucket: write.bucket,
      stage: write.stage,
      dedupeKey: write.dedupeKey,
      planned: true,
      executed,
      ops: write.ops.map((op) => ({ op: op.op, tag: args.tagNames[op.tagKey] })),
    })
  }
  return {
    live: args.decision.live,
    liveRequested: args.decision.liveRequested,
    writing: args.decision.writing,
    reason: args.decision.reason,
    tags: args.tagNames,
    tagIds: args.tagIds,
    missingTags: args.missingTags,
    buckets,
    skipped: args.plan.skipped,
    failures: args.failed.length,
    failed: args.failed,
    actions,
    warnings: args.warnings || [],
    exclusionKeys: {
      suppress: RENEWAL_SUPPRESSION_SET,
      firstRun: FIRST_RUN_EXCLUSION_SET,
    },
  }
}

export function assertNoRawEmails(value: unknown, rawEmails: string[]): void {
  const encoded = JSON.stringify(value).toLowerCase()
  for (const email of rawEmails) {
    const normalized = email.trim().toLowerCase()
    if (normalized.includes('@') && encoded.includes(normalized)) {
      throw new Error('Renewal response included a raw email')
    }
  }
}
