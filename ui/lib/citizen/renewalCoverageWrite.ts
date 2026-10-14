/**
 * Kit tag writes for citizen renewal reminders.
 * Runs only when renewalLiveDecision says writing is on.
 * Tags an existing active subscriber by id. Never creates a subscriber,
 * never calls form subscribe, and never calls sequence subscribe.
 * The dedupe key is stored after the tag calls succeed.
 */
import { Redis } from '@upstash/redis'
import { normalizeEmail, type CoverageInput } from '@/lib/citizen/renewalCoverage'
import {
  assertActiveTagTarget,
  kitAddTagRequest,
  kitRemoveTagRequest,
  parseRenewalStageKey,
  planRenewalWrites,
  renewalLiveDecision,
  renewalTagNames,
  resolveRenewalTagIds,
  RENEWAL_OPEN_SET,
  RENEWAL_WRITTEN_SET,
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
  }
}

async function rememberBook(redis: RenewalRedis, item: PlannedRenewalWrite): Promise<void> {
  await redis.set(item.dedupeKey, '1')
  await redis.sadd(RENEWAL_WRITTEN_SET, [item.dedupeKey])
  if (item.stage === 'renewed') {
    if (item.openMembers.length > 0) await redis.srem(RENEWAL_OPEN_SET, item.openMembers)
    return
  }
  await redis.sadd(RENEWAL_OPEN_SET, [item.dedupeKey])
}

export async function executeRenewalWrites(args: {
  writing: boolean
  writes: PlannedRenewalWrite[]
  tagIds: Record<RenewalTagKey, string>
  redis: RenewalRedis
  kit: KitMutator
}): Promise<{
  executedKeys: string[]
  failed: Array<{ tokenId: string; stage: PlannedRenewalWrite['stage'] }>
}> {
  if (!args.writing) return { executedKeys: [], failed: [] }
  const executedKeys: string[] = []
  const failed: Array<{ tokenId: string; stage: PlannedRenewalWrite['stage'] }> = []
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
      await rememberBook(args.redis, item)
      executedKeys.push(item.dedupeKey)
    } catch {
      failed.push({ tokenId: item.tokenId, stage: item.stage })
    }
  }
  return { executedKeys, failed }
}

async function readBook(redis: RenewalRedis): Promise<{
  openRecords: OpenRecord[]
  writtenKeys: Set<string>
}> {
  const [openRaw, writtenRaw] = await Promise.all([
    redis.smembers(RENEWAL_OPEN_SET),
    redis.smembers(RENEWAL_WRITTEN_SET),
  ])
  return {
    openRecords: openRaw
      .map((value) => parseRenewalStageKey(value))
      .filter((record): record is OpenRecord => record != null && record.stage !== 'renewed'),
    writtenKeys: new Set(writtenRaw),
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
    firstRunKitTag: Set<string>
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
      firstRunKitTag: normalized ? args.exclusionSets.firstRunKitTag.has(normalized) : false,
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
    firstRunKitTag: Set<string>
  }
  redis?: RenewalRedis | null
  fetchImpl?: FetchLike
  listTags?: () => Promise<Array<{ id: string; name: string }>>
  allowKitReads?: boolean
}): Promise<PublicRenewalWrites> {
  const tagNames = renewalTagNames(args.env)
  const warningsEmails = args.rows
    .map((row) => row.email)
    .filter((email): email is string => Boolean(email))
  let openRecords: OpenRecord[] = []
  let writtenKeys = new Set<string>()
  let dedupeReady = false
  if (args.exclusionsReady && args.redis) {
    try {
      const book = await readBook(args.redis)
      openRecords = book.openRecords
      writtenKeys = book.writtenKeys
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
    } catch {
      renewals = []
      warnings.push('Renewed swaps were not planned because a profile read failed.')
    }
  }

  const plan = planRenewalWrites({
    rows: args.rows,
    renewals,
    nowMs: args.nowMs,
    writtenKeys,
  })

  let listed: Array<{ id: string; name: string }> = []
  let tagIds: Record<RenewalTagKey, string | null> | null = null
  let missingTags: string[] = []
  let tagLookupFailed = false
  const gatesOn = args.env.RENEWAL_REMINDERS_LIVE === 'true' && args.liveParam === '1'
  const shouldResolve = gatesOn || args.allowKitReads === true
  if (shouldResolve) {
    try {
      listed = args.listTags ? await args.listTags() : await listKitTags()
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

  const tagsReady = !tagLookupFailed && missingTags.length === 0 && tagIds != null
  const decision = renewalLiveDecision(args.env, args.liveParam, {
    exclusionsReady: args.exclusionsReady,
    dedupeReady,
    tagsReady,
    tagLookupFailed,
  })

  let executedKeys: string[] = []
  let failed: Array<{ tokenId: string; stage: PlannedRenewalWrite['stage'] }> = []
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
        redis: args.redis,
        kit,
      })
      executedKeys = result.executedKeys
      failed = result.failed
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
    warnings,
  })
  assertNoRawEmails(publicWrites, warningsEmails)
  return publicWrites
}
