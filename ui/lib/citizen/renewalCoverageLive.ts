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
  renewalTermMarkerKey,
  RENEWAL_SUPPRESSION_SET,
  windowPosition,
  type CoverageInput,
  type RenewalStage,
} from '@/lib/citizen/renewalCoverage'

export const RENEWAL_OPEN_SET = 'renewal:open'
export const RENEWAL_WRITTEN_SET = 'renewal:written'
/** Token ids whose Renewed tag is still on, waiting for the next cycle. */
export const RENEWED_PRESENT_SET = 'renewal:renewed-present'

export const RENEWAL_TAG_KEYS = [
  'reminder',
  'catchupMinus7',
  'catchupExpiry',
  'catchupPlus14',
  'renewed',
] as const

export type RenewalTagKey = (typeof RENEWAL_TAG_KEYS)[number]

export const DEFAULT_RENEWAL_TAG_NAMES: Record<RenewalTagKey, string> = {
  reminder: RENEWAL_REMINDER_TAG,
  catchupMinus7: 'Renewal-Catchup-minus7',
  catchupExpiry: 'Renewal-Catchup-expiry',
  catchupPlus14: 'Renewal-Catchup-plus14',
  renewed: RENEWED_TAG,
}

const TAG_NAME_ENV: Record<RenewalTagKey, string> = {
  reminder: 'RENEWAL_REMINDER_TAG_NAME',
  catchupMinus7: 'RENEWAL_CATCHUP_MINUS7_TAG_NAME',
  catchupExpiry: 'RENEWAL_CATCHUP_EXPIRY_TAG_NAME',
  catchupPlus14: 'RENEWAL_CATCHUP_PLUS14_TAG_NAME',
  renewed: 'RENEWED_TAG_NAME',
}

const TAG_ID_ENV: Record<RenewalTagKey, string> = {
  reminder: 'RENEWAL_REMINDER_TAG_ID',
  catchupMinus7: 'RENEWAL_CATCHUP_MINUS7_TAG_ID',
  catchupExpiry: 'RENEWAL_CATCHUP_EXPIRY_TAG_ID',
  catchupPlus14: 'RENEWAL_CATCHUP_PLUS14_TAG_ID',
  renewed: 'RENEWED_TAG_ID',
}

/**
 * Known Kit tag ids. An env *_TAG_ID overrides the matching entry.
 * The -7 catch-up still defaults to the previous -14 tag id until Beacon
 * points that automation at the -7 email or sets RENEWAL_CATCHUP_MINUS7_TAG_ID.
 */
export const DEFAULT_RENEWAL_TAG_IDS: Record<RenewalTagKey, string> = {
  reminder: '24636917',
  catchupMinus7: '24636918',
  catchupExpiry: '24636919',
  catchupPlus14: '24636923',
  renewed: '24636927',
}

/**
 * Main sequence, then the one-email catch-up sequences for -7, expiry, and +14.
 * RENEWAL_SEQUENCE_IDS overrides this list.
 */
export const DEFAULT_RENEWAL_SEQUENCE_IDS = ['2929996', '2930045', '2930050', '2930051'] as const

/**
 * Kit's public API cannot remove one subscriber from one sequence.
 * Checked against the v4 OpenAPI and the v3 sequence page:
 * https://developers.kit.com/api-reference/v4.json
 * https://developers.kit.com/api-reference/sequences/add-subscriber-to-sequence
 * https://developers.kit.com/api-reference/sequences/list-subscribers-for-a-sequence
 * https://developers.kit.com/api-reference/sequences/delete-a-sequence
 * https://developers.kit.com/api-reference/v3/sequences
 * Account-wide unsubscribe is a different operation and is not called:
 * https://developers.kit.com/api-reference/subscribers/unsubscribe-subscriber
 * https://developers.kit.com/api-reference/v3/subscribers
 * https://developers.kit.com/api-reference/upgrading-to-v4
 * Stop queued mail in Kit. Exclude the Renewed tag on each sequence
 * (exclude_subscriber_sources on Update a sequence) or remove the subscriber
 * in the Kit UI:
 * https://developers.kit.com/api-reference/sequences/update-a-sequence
 * https://help.kit.com/en/articles/6211448-how-to-manually-add-or-remove-subscribers-from-a-kit-email-sequence
 */
export const SEQUENCE_REMOVAL_NOTE =
  'Unsupported. Kit v4 and v3 have no endpoint that removes one subscriber from one sequence. Account-wide unsubscribe is not used. In Kit, exclude the Renewed tag on each sequence, or remove the subscriber from the sequence in the Kit UI.'

export const SEQUENCE_REMOVAL_DOCS = [
  'https://developers.kit.com/api-reference/v4.json',
  'https://developers.kit.com/api-reference/sequences/add-subscriber-to-sequence',
  'https://developers.kit.com/api-reference/sequences/list-subscribers-for-a-sequence',
  'https://developers.kit.com/api-reference/sequences/delete-a-sequence',
  'https://developers.kit.com/api-reference/v3/sequences',
  'https://developers.kit.com/api-reference/subscribers/unsubscribe-subscriber',
  'https://developers.kit.com/api-reference/v3/subscribers',
  'https://developers.kit.com/api-reference/upgrading-to-v4',
  'https://developers.kit.com/api-reference/sequences/update-a-sequence',
  'https://help.kit.com/en/articles/6211448-how-to-manually-add-or-remove-subscribers-from-a-kit-email-sequence',
] as const

export const WRITE_BUCKETS = [
  'renewalReminder',
  'catchupMinus7',
  'catchupExpiry',
  'catchupPlus14',
  'renewed',
  'typeformOnly',
] as const

export type WriteBucket = (typeof WRITE_BUCKETS)[number]

const STAGE_BUCKET: Record<RenewalStage, Exclude<WriteBucket, 'typeformOnly'> | null> = {
  minus30: 'renewalReminder',
  minus7: 'catchupMinus7',
  expiry: 'catchupExpiry',
  plus14: 'catchupPlus14',
  renewed: 'renewed',
}

const STAGE_TAG: Record<Exclude<RenewalStage, 'renewed'>, RenewalTagKey> = {
  minus30: 'reminder',
  minus7: 'catchupMinus7',
  expiry: 'catchupExpiry',
  plus14: 'catchupPlus14',
}

/**
 * Reminder and catch-up stages that occupy the one slot for a term.
 * `renewed` is not a slot. A stored `minus14` key is read as `minus7`.
 */
export const TERM_SLOT_STAGES = ['minus30', 'minus7', 'expiry', 'plus14'] as const

export type TermSlotStage = (typeof TERM_SLOT_STAGES)[number]

/**
 * Future win-back stages. A win-back email is allowed after the one staged
 * reminder or catch-up for a term. Add the stage id here when that email is
 * built, and teach `stageForReminder` to select it. Leave this empty until then.
 */
export const WIN_BACK_STAGES: readonly RenewalStage[] = []

export function isWinBackStage(stage: RenewalStage): boolean {
  return (WIN_BACK_STAGES as readonly string[]).includes(stage)
}

function isTermSlotStage(stage: string): stage is TermSlotStage {
  return (TERM_SLOT_STAGES as readonly string[]).includes(stage)
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
  alreadyStagedThisTerm: number
  suppressed: number
  firstRun: number
  kitOptOut: number
  noEmail: number
  kitNotActive: number
  noSubscriberId: number
  typeformOnly: number
}

/** A term that already has its one reminder or catch-up stage. */
export type AlreadyStagedThisTermRow = {
  tokenId: string
  /** Kit tag name of the stage already written, such as Renewal-Reminder. */
  name: string
  stageWritten: TermSlotStage
  stageWouldApply: TermSlotStage
}

export type RenewalPlan = {
  writes: PlannedRenewalWrite[]
  skipped: RenewalSkipCounts
  alreadyStagedThisTerm: AlreadyStagedThisTermRow[]
}

export type RenewalWriteBuckets = {
  renewalReminder: { planned: number; executed: number }
  catchupMinus7: { planned: number; executed: number }
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
  alreadyStagedThisTerm: AlreadyStagedThisTermRow[]
  failures: number
  failed: Array<{ tokenId: string; stage: RenewalStage }>
  sequenceRemoval: {
    status: 'unsupported'
    note: typeof SEQUENCE_REMOVAL_NOTE
    docs: typeof SEQUENCE_REMOVAL_DOCS
    sequenceIds: string[]
    attempted: number
    failed: number
    failures: Array<{ tokenId: string; sequenceId: string }>
  }
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
    if (found) {
      ids[key] = found
      continue
    }
    if (names[key] === DEFAULT_RENEWAL_TAG_NAMES[key]) {
      ids[key] = DEFAULT_RENEWAL_TAG_IDS[key]
      continue
    }
    ids[key] = null
    missing.push(names[key])
  }
  return { ids, missing }
}

/** Comma-separated digits. Blank falls back to DEFAULT_RENEWAL_SEQUENCE_IDS. */
export function renewalSequenceIds(env: NodeJS.ProcessEnv): string[] {
  const raw = env.RENEWAL_SEQUENCE_IDS?.trim()
  if (!raw) return [...DEFAULT_RENEWAL_SEQUENCE_IDS]
  const ids: string[] = []
  const seen = new Set<string>()
  for (const part of raw.split(',')) {
    const id = part.trim()
    if (!id) continue
    if (!/^\d+$/.test(id)) {
      throw new Error('RENEWAL_SEQUENCE_IDS must be a comma-separated list of digits')
    }
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  if (ids.length === 0) {
    throw new Error('RENEWAL_SEQUENCE_IDS must be a comma-separated list of digits')
  }
  return ids
}

export function parseRenewalStageKey(value: string): OpenRecord | null {
  const match = /^renewal:(\d+):(\d+):(minus30|minus14|minus7|expiry|plus14|renewed)$/.exec(value)
  if (!match) return null
  const rawStage = match[3]
  const stage = (rawStage === 'minus14' ? 'minus7' : rawStage) as RenewalStage
  return {
    tokenId: match[1],
    expiresAt: Number(match[2]),
    stage,
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
 * That choice is the one stage for the term. Later days do not advance it.
 * A future win-back stage would be selected here and listed in WIN_BACK_STAGES
 * so the term marker does not block it. Win-back is not selected today.
 */
export function stageForReminder(expiresAtSec: number, nowMs: number): RenewalStage | null {
  const expiresAt = Math.trunc(expiresAtSec)
  const position = windowPosition(expiresAt, nowMs)
  if (!position || position === 'outOfWindow') return null
  if (position === 'enterToday') return 'minus30'
  const days = daysUntilRenewal(expiresAt, nowMs)
  if (days == null) return null
  const next = expectedSequencePosition(days).nextEmail
  if (next === 'minus7' || next === 'expiry' || next === 'plus14') return next
  return null
}

function emptySkips(): RenewalSkipCounts {
  return {
    deduped: 0,
    alreadyStagedThisTerm: 0,
    suppressed: 0,
    firstRun: 0,
    kitOptOut: 0,
    noEmail: 0,
    kitNotActive: 0,
    noSubscriberId: 0,
    typeformOnly: 0,
  }
}

function stageFromMarker(value: string | undefined): TermSlotStage | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed === 'minus14') return 'minus7'
  return isTermSlotStage(trimmed) ? trimmed : null
}

/** Earliest reminder or catch-up stage recorded in `renewal:written`, per term. */
export function indexWrittenTermSlots(writtenKeys: Iterable<string>): Map<string, TermSlotStage> {
  const found = new Map<string, Set<TermSlotStage>>()
  for (const key of writtenKeys) {
    const parsed = parseRenewalStageKey(key)
    if (!parsed || !isTermSlotStage(parsed.stage)) continue
    const termKey = renewalTermMarkerKey(parsed.tokenId, parsed.expiresAt)
    const stages = found.get(termKey) || new Set<TermSlotStage>()
    stages.add(parsed.stage)
    found.set(termKey, stages)
  }
  const indexed = new Map<string, TermSlotStage>()
  for (const [termKey, stages] of found) {
    const earliest = TERM_SLOT_STAGES.find((stage) => stages.has(stage))
    if (earliest) indexed.set(termKey, earliest)
  }
  return indexed
}

/**
 * Stage already written for this term, if any.
 * The term marker wins when it names a slot stage. Otherwise the earliest
 * reminder or catch-up member of `renewal:written` is used. `renewed` does
 * not occupy the slot, so a new term can still be staged after an extension.
 * A non-empty marker that does not name a stage still blocks the term.
 */
export function stageWrittenForTerm(
  tokenId: string,
  expiresAt: number,
  writtenSlots: ReadonlyMap<string, TermSlotStage>,
  termMarkers?: ReadonlyMap<string, string>
): { blocked: boolean; stageWritten: TermSlotStage | null } {
  const termKey = renewalTermMarkerKey(tokenId, expiresAt)
  const fromWritten = writtenSlots.get(termKey) || null
  const marked = termMarkers?.get(termKey)
  if (marked && marked.trim()) {
    return { blocked: true, stageWritten: stageFromMarker(marked) || fromWritten }
  }
  if (fromWritten) return { blocked: true, stageWritten: fromWritten }
  return { blocked: false, stageWritten: null }
}

type SkipReason = keyof RenewalSkipCounts

function skipReason(row: CoverageInput, stage: RenewalStage): SkipReason | null {
  if (!row.email) return 'noEmail'
  const state = row.kitState?.trim().toLowerCase() || null
  if (state && OPT_OUT.has(state)) return 'kitOptOut'
  if (state !== 'active') {
    if (!state || state === 'missing') return 'typeformOnly'
    return 'kitNotActive'
  }
  if (row.suppressed) return 'suppressed'
  if (stage !== 'renewed' && row.firstRunRedis && (stage === 'minus30' || stage === 'minus7')) {
    return 'firstRun'
  }
  if (!row.kitSubscriberId || !/^\d+$/.test(row.kitSubscriberId)) return 'noSubscriberId'
  return null
}

function shouldClearRenewed(
  row: CoverageInput,
  renewedPresentTokenIds?: ReadonlySet<string>
): boolean {
  if (row.hasRenewedTag) return true
  return renewedPresentTokenIds?.has(String(row.tokenId)) === true
}

function reminderOps(
  stage: Exclude<RenewalStage, 'renewed'>,
  clearRenewed: boolean
): PlannedRenewalWrite['ops'] {
  const ops: PlannedRenewalWrite['ops'] = []
  if (clearRenewed) ops.push({ op: 'remove', tagKey: 'renewed' })
  ops.push({ op: 'add', tagKey: STAGE_TAG[stage] })
  return ops
}

function renewedOps(): PlannedRenewalWrite['ops'] {
  return [
    { op: 'add', tagKey: 'renewed' },
    { op: 'remove', tagKey: 'reminder' },
    { op: 'remove', tagKey: 'catchupMinus7' },
    { op: 'remove', tagKey: 'catchupExpiry' },
    { op: 'remove', tagKey: 'catchupPlus14' },
  ]
}

export function planRenewalWrites(args: {
  rows: CoverageInput[]
  renewals: Array<CoverageInput & { openMembers: string[] }>
  nowMs: number
  writtenKeys: ReadonlySet<string>
  /** Values of `renewal:term:{tokenId}:{expiresAt}` read from Redis. */
  termMarkers?: ReadonlyMap<string, string>
  renewedPresentTokenIds?: ReadonlySet<string>
}): RenewalPlan {
  const skipped = emptySkips()
  const writes: PlannedRenewalWrite[] = []
  const alreadyStagedThisTerm: AlreadyStagedThisTermRow[] = []
  const writtenSlots = indexWrittenTermSlots(args.writtenKeys)

  for (const row of args.rows) {
    const stage = stageForReminder(row.expiresAt, args.nowMs)
    if (!stage || stage === 'renewed') continue
    const reason = skipReason(row, stage)
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
    // Win-back is the only later stage allowed after the term slot is filled.
    if (!isWinBackStage(stage)) {
      const staged = stageWrittenForTerm(
        String(row.tokenId),
        expiresAt,
        writtenSlots,
        args.termMarkers
      )
      if (staged.blocked) {
        skipped.alreadyStagedThisTerm += 1
        if (staged.stageWritten) {
          alreadyStagedThisTerm.push({
            tokenId: String(row.tokenId),
            name: DEFAULT_RENEWAL_TAG_NAMES[STAGE_TAG[staged.stageWritten]],
            stageWritten: staged.stageWritten,
            stageWouldApply: stage,
          })
        }
        continue
      }
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
      ops: reminderOps(stage, shouldClearRenewed(row, args.renewedPresentTokenIds)),
      openMembers: [],
    })
  }

  for (const row of args.renewals) {
    const reason = skipReason(row, 'renewed')
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

  return { writes, skipped, alreadyStagedThisTerm }
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

/**
 * No-op. Kit documents no per-sequence removal, and this does not call Kit.
 * Returns unsupported so a caller can record the gap without sending a request.
 */
export function kitSequenceRemoval(
  sequenceId: string,
  subscriberId: string,
  state: string | null | undefined
): { status: 'unsupported' } {
  assertActiveTagTarget(state, subscriberId)
  if (!/^\d+$/.test(sequenceId)) throw new Error('Kit sequence id must be digits')
  return { status: 'unsupported' }
}

export function toPublicRenewalWrites(args: {
  decision: RenewalLiveDecision
  plan: RenewalPlan
  tagNames: RenewalTagNames
  tagIds: Record<RenewalTagKey, string | null> | null
  missingTags: string[]
  executedKeys: ReadonlySet<string>
  failed: Array<{ tokenId: string; stage: RenewalStage }>
  sequenceIds: string[]
  sequenceAttempted: number
  sequenceFailures: Array<{ tokenId: string; sequenceId: string }>
  warnings?: string[]
}): PublicRenewalWrites {
  const buckets: RenewalWriteBuckets = {
    renewalReminder: { planned: 0, executed: 0 },
    catchupMinus7: { planned: 0, executed: 0 },
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
    alreadyStagedThisTerm: args.plan.alreadyStagedThisTerm.map((row) => ({
      ...row,
      name: args.tagNames[STAGE_TAG[row.stageWritten]],
    })),
    failures: args.failed.length,
    failed: args.failed,
    sequenceRemoval: {
      status: 'unsupported',
      note: SEQUENCE_REMOVAL_NOTE,
      docs: SEQUENCE_REMOVAL_DOCS,
      sequenceIds: args.sequenceIds,
      attempted: args.sequenceAttempted,
      failed: args.sequenceFailures.length,
      failures: args.sequenceFailures,
    },
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
