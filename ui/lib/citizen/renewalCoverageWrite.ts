/**
 * Kit tag writes for citizen renewal reminders.
 * Runs only when renewalLiveDecision says writing is on.
 * Tags an existing active subscriber by id. Never creates a subscriber,
 * never calls form subscribe, and never calls sequence subscribe.
 * Renewed also asks to leave each configured sequence. That step is a no-op
 * which returns unsupported, because Kit has no per-sequence removal API.
 * The dedupe key and the per-term marker are stored after the tag calls
 * and the sequence attempts. A failed tag writes neither, so the next run can retry.
 */
import { Redis } from '@upstash/redis'
import {
  normalizeEmail,
  renewalTermMarkerKey,
  UpstreamNonJsonError,
  type CoverageInput,
} from '@/lib/citizen/renewalCoverage'
import {
  assertActiveTagTarget,
  isWinBackStage,
  kitAddTagRequest,
  kitRemoveTagRequest,
  kitSequenceRemoval,
  parseRenewalStageKey,
  planRenewalWrites,
  renewalLiveDecision,
  renewalSequenceIds,
  renewalTagNames,
  resolveRenewalTagIds,
  RENEWAL_OPEN_SET,
  RENEWAL_WRITTEN_SET,
  RENEWED_PRESENT_SET,
  selectForwardRenewals,
  toPublicRenewalWrites,
  assertNoRawEmails,
  type OpenRecord,
  type PlannedRenewalWrite,
  type PublicRenewalWrites,
  type RenewalTagKey,
} from '@/lib/citizen/renewalCoverageLive'
import {
  listKitTags,
  loadKitSubscriberRecords,
  loadKitTagEmails,
  loadTypeformEmail,
  mapWithConcurrency,
  type CitizenProfile,
} from '@/lib/citizen/renewalCoverageRead'

export type RenewalRedis = {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  sadd(key: string, members: string[]): Promise<void>
  srem(key: string, members: string[]): Promise<void>
  smembers(key: string): Promise<string[]>
}

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number }>

export type KitMutator = {
  addTag(tagId: string, subscriberId: string, state: string | null): Promise<void>
  removeTag(tagId: string, subscriberId: string, state: string | null): Promise<void>
  removeFromSequence(
    sequenceId: string,
    subscriberId: string,
    state: string | null
  ): Promise<{ status: 'unsupported' }>
}

export function upstashRenewalRedis(redis: Redis): RenewalRedis {
  return {
    async get(key) {
      const value = await redis.get<string>(key)
      return value == null ? null : String(value)
    },
    async set(key, value) {
      await redis.set(key, value)
    },
    async sadd(key, members) {
      if (members.length === 0) return
      await redis.sadd(key, members[0], ...members.slice(1))
    },
    async srem(key, members) {
      if (members.length === 0) return
      await redis.srem(key, members[0], ...members.slice(1))
    },
    async smembers(key) {
      const value = await redis.smembers(key)
      if (!Array.isArray(value)) return []
      return value.filter((item): item is string => typeof item === 'string')
    },
  }
}

export function redisFromEnv(env: NodeJS.ProcessEnv = process.env): RenewalRedis | null {
  const url = env.UPSTASH_REDIS_URL
  const token = env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  return upstashRenewalRedis(new Redis({ url, token }))
}

export function createKitMutator(fetchImpl: FetchLike, apiKey: string): KitMutator {
  if (!apiKey.trim()) throw new Error('Kit API key is missing')
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Kit-Api-Key': apiKey,
  }
  return {
    async addTag(tagId, subscriberId, state) {
      const request = kitAddTagRequest(tagId, subscriberId, state)
      const res = await fetchImpl(request.url, {
        method: request.method,
        headers,
        body: request.body,
      })
      if (!res.ok) throw new Error(`Kit tag add failed: HTTP ${res.status}`)
    },
    async removeTag(tagId, subscriberId, state) {
      const request = kitRemoveTagRequest(tagId, subscriberId, state)
      const res = await fetchImpl(request.url, {
        method: request.method,
        headers,
      })
      if (res.status === 404 || res.ok) return
      throw new Error(`Kit tag remove failed: HTTP ${res.status}`)
    },
    async removeFromSequence(sequenceId, subscriberId, state) {
      return kitSequenceRemoval(sequenceId, subscriberId, state)
    },
  }
}

async function rememberBook(redis: RenewalRedis, item: PlannedRenewalWrite): Promise<void> {
  await redis.set(item.dedupeKey, '1')
  await redis.sadd(RENEWAL_WRITTEN_SET, [item.dedupeKey])
  // Record the one staged reminder or catch-up. Renewed does not occupy the
  // term, and a future win-back write must not replace the staged stage.
  if (item.stage !== 'renewed' && !isWinBackStage(item.stage)) {
    await redis.set(renewalTermMarkerKey(item.tokenId, item.expiresAt), item.stage)
  }
  if (item.stage === 'renewed') {
    await redis.sadd(RENEWED_PRESENT_SET, [item.tokenId])
    if (item.openMembers.length > 0) await redis.srem(RENEWAL_OPEN_SET, item.openMembers)
    return
  }
  if (item.ops.some((op) => op.op === 'remove' && op.tagKey === 'renewed')) {
    await redis.srem(RENEWED_PRESENT_SET, [item.tokenId])
  }
  await redis.sadd(RENEWAL_OPEN_SET, [item.dedupeKey])
}

export async function executeRenewalWrites(args: {
  writing: boolean
  writes: PlannedRenewalWrite[]
  tagIds: Record<RenewalTagKey, string>
  sequenceIds: readonly string[]
  redis: RenewalRedis
  kit: KitMutator
}): Promise<{
  executedKeys: string[]
  failed: Array<{ tokenId: string; stage: PlannedRenewalWrite['stage'] }>
  sequenceAttempted: number
  sequenceFailures: Array<{ tokenId: string; sequenceId: string }>
}> {
  if (!args.writing) {
    return { executedKeys: [], failed: [], sequenceAttempted: 0, sequenceFailures: [] }
  }
  const executedKeys: string[] = []
  const failed: Array<{ tokenId: string; stage: PlannedRenewalWrite['stage'] }> = []
  const sequenceFailures: Array<{ tokenId: string; sequenceId: string }> = []
  let sequenceAttempted = 0
  for (const item of args.writes) {
    try {
      assertActiveTagTarget(item.kitState, item.subscriberId)
      const existing = await args.redis.get(item.dedupeKey)
      if (existing) {
        await rememberBook(args.redis, item)
        continue
      }
      for (const op of item.ops) {
        const tagId = args.tagIds[op.tagKey]
        if (!tagId) throw new Error('missing tag id')
        if (op.op === 'add') {
          await args.kit.addTag(tagId, item.subscriberId, item.kitState)
        } else {
          await args.kit.removeTag(tagId, item.subscriberId, item.kitState)
        }
      }
      if (item.stage === 'renewed') {
        for (const sequenceId of args.sequenceIds) {
          sequenceAttempted += 1
          try {
            await args.kit.removeFromSequence(sequenceId, item.subscriberId, item.kitState)
          } catch {
            sequenceFailures.push({ tokenId: item.tokenId, sequenceId })
          }
        }
      }
      await rememberBook(args.redis, item)
      executedKeys.push(item.dedupeKey)
    } catch {
      failed.push({ tokenId: item.tokenId, stage: item.stage })
    }
  }
  return { executedKeys, failed, sequenceAttempted, sequenceFailures }
}

/**
 * Read-only. Dry runs call this so alreadyStagedThisTerm matches Redis
 * without writing a marker or a dedupe key.
 */
async function readTermMarkers(
  redis: RenewalRedis,
  rows: Array<{ tokenId: string; expiresAt: number }>
): Promise<Map<string, string>> {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const expiresAt = Math.trunc(row.expiresAt)
    const id = String(row.tokenId).trim()
    if (!/^\d+$/.test(id) || !Number.isInteger(expiresAt) || expiresAt < 0) continue
    const key = renewalTermMarkerKey(id, expiresAt)
    if (seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  const markers = new Map<string, string>()
  const chunkSize = 25
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize)
    const values = await Promise.all(chunk.map((key) => redis.get(key)))
    values.forEach((value, index) => {
      if (value) markers.set(chunk[index], value)
    })
  }
  return markers
}

async function readBook(redis: RenewalRedis): Promise<{
  openRecords: OpenRecord[]
  writtenKeys: Set<string>
  renewedPresentTokenIds: Set<string>
}> {
  const [openRaw, writtenRaw, renewedRaw] = await Promise.all([
    redis.smembers(RENEWAL_OPEN_SET),
    redis.smembers(RENEWAL_WRITTEN_SET),
    redis.smembers(RENEWED_PRESENT_SET),
  ])
  return {
    openRecords: openRaw
      .map((value) => parseRenewalStageKey(value))
      .filter((record): record is OpenRecord => record != null && record.stage !== 'renewed'),
    writtenKeys: new Set(writtenRaw),
    renewedPresentTokenIds: new Set(renewedRaw),
  }
}

async function hydrateRenewals(args: {
  forward: ReturnType<typeof selectForwardRenewals>
  profiles: CitizenProfile[]
  formIds: string[]
  typeformToken: string
  exclusionSets: {
    suppressed: Set<string>
    firstRunRedis: Set<string>
  }
}): Promise<Array<CoverageInput & { openMembers: string[] }>> {
  if (args.forward.length === 0) return []
  const byToken = new Map(args.profiles.map((profile) => [profile.tokenId, profile]))
  const lookedUp = await mapWithConcurrency(args.forward, 6, async (item) => {
    const profile = byToken.get(item.tokenId)
    if (!profile?.formId) return { item, email: null as string | null }
    const email = await loadTypeformEmail(profile.formId, args.formIds, args.typeformToken)
    if (email === 'unauthorized' || email === 'failed') {
      throw new Error('Typeform read failed while checking a renewal')
    }
    return { item, email }
  })
  const records = await loadKitSubscriberRecords(
    lookedUp.map((row) => row.email).filter((email): email is string => Boolean(email))
  )
  return lookedUp.map(({ item, email }) => {
    const normalized = email ? normalizeEmail(email) : null
    const record = normalized ? records.get(normalized) : undefined
    return {
      tokenId: item.tokenId,
      expiresAt: item.expiresAt,
      email: normalized,
      kitState: record?.state ?? null,
      kitSubscriberId: record?.id ?? null,
      suppressed: normalized ? args.exclusionSets.suppressed.has(normalized) : false,
      firstRunRedis: normalized ? args.exclusionSets.firstRunRedis.has(normalized) : false,
      openMembers: item.openMembers,
    }
  })
}

export async function runRenewalWritePass(args: {
  env: NodeJS.ProcessEnv
  liveParam: string | undefined
  rows: CoverageInput[]
  profiles: CitizenProfile[]
  expiresAt: Map<string, number | null>
  nowMs: number
  formIds: string[]
  typeformToken: string
  exclusionsReady: boolean
  exclusionSets: {
    suppressed: Set<string>
    firstRunRedis: Set<string>
  }
  redis?: RenewalRedis | null
  fetchImpl?: FetchLike
  listTags?: () => Promise<Array<{ id: string; name: string }>>
  allowKitReads?: boolean
}): Promise<PublicRenewalWrites> {
  const tagNames = renewalTagNames(args.env)
  const sequenceIds = renewalSequenceIds(args.env)
  const warningsEmails = args.rows
    .map((row) => row.email)
    .filter((email): email is string => Boolean(email))
  let openRecords: OpenRecord[] = []
  let writtenKeys = new Set<string>()
  let termMarkers = new Map<string, string>()
  let renewedPresentTokenIds = new Set<string>()
  let dedupeReady = false
  if (args.exclusionsReady && args.redis) {
    try {
      const book = await readBook(args.redis)
      openRecords = book.openRecords
      writtenKeys = book.writtenKeys
      renewedPresentTokenIds = book.renewedPresentTokenIds
      termMarkers = await readTermMarkers(args.redis, args.rows)
      dedupeReady = true
    } catch {
      dedupeReady = false
    }
  }

  const warnings: string[] = []
  let renewals: Array<CoverageInput & { openMembers: string[] }> = []
  if (dedupeReady) {
    try {
      const forward = selectForwardRenewals(openRecords, args.expiresAt, args.nowMs)
      renewals = await hydrateRenewals({
        forward,
        profiles: args.profiles,
        formIds: args.formIds,
        typeformToken: args.typeformToken,
        exclusionSets: args.exclusionSets,
      })
      for (const row of renewals) {
        if (row.email) warningsEmails.push(row.email)
      }
    } catch (error) {
      if (error instanceof UpstreamNonJsonError) throw error
      renewals = []
      warnings.push('Renewed swaps were not planned because a profile read failed.')
    }
  }

  let listed: Array<{ id: string; name: string }> = []
  let tagIds: Record<RenewalTagKey, string | null> | null = null
  let missingTags: string[] = []
  let tagLookupFailed = false
  const gatesOn = args.env.RENEWAL_REMINDERS_LIVE === 'true' && args.liveParam === '1'
  const shouldResolve = gatesOn || args.allowKitReads === true
  if (shouldResolve) {
    try {
      listed = args.listTags ? await args.listTags() : await listKitTags()
    } catch (error) {
      if (error instanceof UpstreamNonJsonError) throw error
      if (error instanceof Error && error.message.includes('must be digits')) throw error
      warnings.push('Kit tag list was not read.')
      listed = []
    }
    try {
      const resolved = resolveRenewalTagIds(tagNames, args.env, listed)
      tagIds = resolved.ids
      missingTags = resolved.missing
    } catch (error) {
      if (error instanceof Error && error.message.includes('must be digits')) throw error
      tagLookupFailed = true
      warnings.push('Kit tag ids were not resolved.')
      tagIds = null
    }
  }

  let rowsForPlan = args.rows
  if (args.allowKitReads === true && tagIds?.renewed) {
    try {
      const renewedEmails = await loadKitTagEmails(tagIds.renewed)
      rowsForPlan = args.rows.map((row) => {
        if (!row.email || !renewedEmails.has(normalizeEmail(row.email))) return row
        return { ...row, hasRenewedTag: true }
      })
    } catch (error) {
      if (error instanceof UpstreamNonJsonError) throw error
      if (error instanceof Error && error.message.includes('must be digits')) throw error
      warnings.push(
        'Renewed tag subscribers were not read. Clearance still uses the Redis set renewal:renewed-present.'
      )
    }
  }

  const plan = planRenewalWrites({
    rows: rowsForPlan,
    renewals,
    nowMs: args.nowMs,
    writtenKeys,
    termMarkers,
    renewedPresentTokenIds,
  })

  const tagsReady = !tagLookupFailed && missingTags.length === 0 && tagIds != null
  const decision = renewalLiveDecision(args.env, args.liveParam, {
    exclusionsReady: args.exclusionsReady,
    dedupeReady,
    tagsReady,
    tagLookupFailed,
  })

  let executedKeys: string[] = []
  let failed: Array<{ tokenId: string; stage: PlannedRenewalWrite['stage'] }> = []
  let sequenceAttempted = 0
  let sequenceFailures: Array<{ tokenId: string; sequenceId: string }> = []
  let decisionForReport = decision
  if (decision.writing && args.redis && tagIds) {
    const apiKey = args.env.CONVERT_KIT_V4_API_KEY || args.env.CONVERT_KIT_API_KEY || ''
    if (!apiKey.trim()) {
      decisionForReport = {
        writing: false,
        live: false,
        liveRequested: true,
        reason: 'Dry run. Kit API key is missing, so nothing was written.',
      }
    } else {
      const fetchImpl = args.fetchImpl || fetch
      const kit = createKitMutator(fetchImpl, apiKey)
      const ids = tagIds as Record<RenewalTagKey, string>
      const result = await executeRenewalWrites({
        writing: true,
        writes: plan.writes,
        tagIds: ids,
        sequenceIds,
        redis: args.redis,
        kit,
      })
      executedKeys = result.executedKeys
      failed = result.failed
      sequenceAttempted = result.sequenceAttempted
      sequenceFailures = result.sequenceFailures
      if (sequenceAttempted > 0) {
        warnings.push(
          sequenceFailures.length > 0
            ? 'Sequence removal is unsupported by the Kit API. A sequence attempt failed and the rest were still processed. Exclude the Renewed tag on each sequence in Kit.'
            : 'Sequence removal is unsupported by the Kit API, so no subscriber was removed from a sequence. Exclude the Renewed tag on each sequence in Kit.'
        )
      }
    }
  }

  const publicWrites = toPublicRenewalWrites({
    decision: decisionForReport,
    plan,
    tagNames,
    tagIds,
    missingTags,
    executedKeys: new Set(executedKeys),
    failed,
    sequenceIds,
    sequenceAttempted,
    sequenceFailures,
    warnings,
  })
  assertNoRawEmails(publicWrites, warningsEmails)
  return publicWrites
}
