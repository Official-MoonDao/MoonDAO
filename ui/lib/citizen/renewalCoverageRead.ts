/**
 * Read-only inputs for the renewal coverage dry run.
 * Every outbound Kit, Typeform, and chain call in this file is a GET or an
 * eth_call. Redis is SMEMBERS only. There is no subscriber create, tag, or send.
 */
import { Redis } from '@upstash/redis'
import { CITIZEN_ADDRESSES, CITIZEN_TABLE_NAMES } from 'const/config'
import { ethers } from 'ethers'
import {
  ARBITRUM_CITIZEN_NFT,
  CITIZEN_TYPEFORM_FORM_ENV_KEYS,
  FIRST_RUN_EXCLUSION_SET,
  kitListTagsPath,
  kitReadRequest,
  kitSubscriberLookupPath,
  kitTagSubscribersPath,
  normalizeEmail,
  parseUpstreamJson,
  RENEWAL_SUPPRESSION_SET,
  UpstreamNonJsonError,
  type CoverageInput,
} from '@/lib/citizen/renewalCoverage'
import { extractEmailFromTypeformAnswers } from '@/lib/marketplace/vendorEmail'
import { tablelandQueryEndpoint } from '@/lib/tableland/endpoint'

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
const PUBLIC_ARBITRUM_RPC = 'https://arb1.arbitrum.io/rpc'
const ARBITRUM_CHAIN_ID = 42161

async function readUpstreamJson(
  source: 'Tableland' | 'Kit' | 'Typeform',
  res: Response
): Promise<unknown> {
  if (res.status >= 300 && res.status < 400) {
    throw new UpstreamNonJsonError(
      source,
      res.status,
      'The server redirected instead of returning JSON.'
    )
  }
  const body = await res.text()
  return parseUpstreamJson(source, res.status, res.headers.get('content-type'), body)
}

export type CitizenProfile = {
  tokenId: string
  formId: string | null
}

export type LoadedExclusions = {
  suppressed: Set<string>
  firstRunRedis: Set<string>
  suppressionChecked: boolean
  firstRunRedisChecked: boolean
  warnings: string[]
}

function assertCitizenNft(): string {
  const configured = CITIZEN_ADDRESSES.arbitrum
  if (!configured || configured.toLowerCase() !== ARBITRUM_CITIZEN_NFT.toLowerCase()) {
    throw new Error(
      `Citizen NFT address is ${configured || 'unset'}, expected ${ARBITRUM_CITIZEN_NFT}`
    )
  }
  return configured
}

function arbitrumRpcUrl(): string {
  if (process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL) return process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL
  if (process.env.NEXT_PUBLIC_INFURA_KEY) {
    return `https://arbitrum-mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_KEY}`
  }
  return PUBLIC_ARBITRUM_RPC
}

export function citizenTypeformFormIds(): string[] {
  return CITIZEN_TYPEFORM_FORM_ENV_KEYS.map((key) => process.env[key]).filter(
    (id): id is string => typeof id === 'string' && id.trim().length > 0
  )
}

export function citizenProfileQueryUrl(statement: string): string {
  return `${tablelandQueryEndpoint(ARBITRUM_CHAIN_ID)}?statement=${encodeURIComponent(statement)}`
}

export async function loadCitizenProfiles(): Promise<CitizenProfile[]> {
  const table = CITIZEN_TABLE_NAMES.arbitrum
  const statement = `SELECT id, formId FROM ${table}`
  const res = await fetch(citizenProfileQueryUrl(statement), {
    method: 'GET',
    redirect: 'manual',
    headers: { Accept: 'application/json' },
  })
  if (res.status >= 300 && res.status < 400) {
    await readUpstreamJson('Tableland', res)
  }
  if (!res.ok) {
    const text = await res.text()
    if (text.trim().startsWith('<')) {
      throw new UpstreamNonJsonError('Tableland', res.status, 'Expected JSON and received HTML.')
    }
    throw new Error(`Tableland query failed: HTTP ${res.status}`)
  }
  const parsed = await readUpstreamJson('Tableland', res)
  const rows = parsed as Array<Record<string, unknown>>
  if (!Array.isArray(rows)) {
    throw new Error('Tableland query did not return a row list')
  }
  return rows
    .map((row) => {
      const id = row.id ?? row.ID
      const formRaw = row.formId ?? row.formid ?? row.FORMID
      const tokenId = String(id ?? '').trim()
      const formId = typeof formRaw === 'string' ? formRaw.trim() : ''
      return {
        tokenId,
        formId: formId && formId !== '0000' ? formId : null,
      }
    })
    .filter((row) => /^\d+$/.test(row.tokenId))
}

export async function loadExpiresAt(tokenIds: string[]): Promise<Map<string, number | null>> {
  const nft = assertCitizenNft()
  const provider = new ethers.providers.JsonRpcProvider(arbitrumRpcUrl(), 42161)
  const expiresIface = new ethers.utils.Interface([
    'function expiresAt(uint256 tokenId) view returns (uint256)',
  ])
  const multicall = new ethers.Contract(
    MULTICALL3,
    [
      'function aggregate3((address target, bool allowFailure, bytes callData)[] calls) view returns ((bool success, bytes returnData)[] returnData)',
    ],
    provider
  )
  const out = new Map<string, number | null>()
  const chunkSize = 200
  for (let i = 0; i < tokenIds.length; i += chunkSize) {
    const chunk = tokenIds.slice(i, i + chunkSize)
    const calls = chunk.map((tokenId) => ({
      target: nft,
      allowFailure: true,
      callData: expiresIface.encodeFunctionData('expiresAt', [tokenId]),
    }))
    // callStatic forces eth_call. ethers v5 would otherwise try to send a transaction.
    const results = (await multicall.callStatic.aggregate3(calls)) as Array<{
      success: boolean
      returnData: string
    }>
    results.forEach((result, index) => {
      const tokenId = chunk[index]
      if (!result.success || result.returnData === '0x') {
        out.set(tokenId, null)
        return
      }
      try {
        const [expiresAt] = expiresIface.decodeFunctionResult('expiresAt', result.returnData)
        out.set(tokenId, Number(expiresAt.toString()))
      } catch {
        out.set(tokenId, null)
      }
    })
  }
  return out
}

async function kitGet(pathAndQuery: string): Promise<unknown> {
  const apiKey = process.env.CONVERT_KIT_V4_API_KEY || process.env.CONVERT_KIT_API_KEY
  if (!apiKey) throw new Error('CONVERT_KIT_V4_API_KEY or CONVERT_KIT_API_KEY is not set')
  const request = kitReadRequest(pathAndQuery)
  const res = await fetch(request.url, {
    method: request.method,
    headers: {
      Accept: 'application/json',
      'X-Kit-Api-Key': apiKey,
    },
  })
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Kit rejected the API key (HTTP ${res.status})`)
  }
  if (!res.ok) {
    throw new Error(`Kit read failed: HTTP ${res.status}`)
  }
  return readUpstreamJson('Kit', res)
}

type KitPage = {
  subscribers?: Array<{ id?: number | string; email_address?: string; state?: string }>
  tags?: Array<{ id?: number | string; name?: string }>
  pagination?: { has_next_page?: boolean; end_cursor?: string | null }
}

export type KitSubscriberRecord = {
  state: string | null
  id: string | null
}

async function eachKitPage(
  firstPath: string,
  nextPath: (cursor: string) => string
): Promise<KitPage[]> {
  const pages: KitPage[] = []
  let path = firstPath
  for (let i = 0; i < 20; i += 1) {
    const page = (await kitGet(path)) as KitPage
    pages.push(page)
    if (!page.pagination?.has_next_page || !page.pagination.end_cursor) break
    path = nextPath(page.pagination.end_cursor)
  }
  return pages
}

export async function loadKitSubscriberRecords(
  emails: string[]
): Promise<Map<string, KitSubscriberRecord>> {
  const unique = [...new Set(emails.map(normalizeEmail))]
  const records = new Map<string, KitSubscriberRecord>()
  unique.forEach((email) => records.set(email, { state: null, id: null }))
  const batchSize = 25
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize)
    const pages = await eachKitPage(kitSubscriberLookupPath(batch), (cursor) => {
      const path = kitSubscriberLookupPath(batch)
      return `${path}&after=${encodeURIComponent(cursor)}`
    })
    for (const page of pages) {
      for (const subscriber of page.subscribers || []) {
        if (!subscriber.email_address || !subscriber.state) continue
        const id = subscriber.id == null ? null : String(subscriber.id)
        records.set(normalizeEmail(subscriber.email_address), {
          state: subscriber.state.toLowerCase(),
          id: id && /^\d+$/.test(id) ? id : null,
        })
      }
    }
  }
  return records
}

export async function loadKitStates(emails: string[]): Promise<Map<string, string | null>> {
  const records = await loadKitSubscriberRecords(emails)
  const states = new Map<string, string | null>()
  records.forEach((record, email) => states.set(email, record.state))
  return states
}

export async function listKitTags(): Promise<Array<{ id: string; name: string }>> {
  const pages = await eachKitPage(kitListTagsPath(), (cursor) => kitListTagsPath(cursor))
  const tags: Array<{ id: string; name: string }> = []
  for (const page of pages) {
    for (const tag of page.tags || []) {
      if (!tag.name || tag.id == null) continue
      const id = String(tag.id)
      if (/^\d+$/.test(id)) tags.push({ id, name: tag.name })
    }
  }
  return tags
}

export async function loadKitTagEmails(tagId: string): Promise<Set<string>> {
  const emails = new Set<string>()
  const pages = await eachKitPage(kitTagSubscribersPath(tagId), (cursor) =>
    kitTagSubscribersPath(tagId, cursor)
  )
  for (const page of pages) {
    for (const subscriber of page.subscribers || []) {
      if (subscriber.email_address) emails.add(normalizeEmail(subscriber.email_address))
    }
  }
  return emails
}

function readSetMembers(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

async function loadRedisEmailSet(
  key: string
): Promise<{ checked: boolean; emails: Set<string>; warning?: string }> {
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) {
    return { checked: false, emails: new Set() }
  }
  try {
    const redis = new Redis({ url, token })
    const members = readSetMembers(await redis.smembers(key))
    return {
      checked: true,
      emails: new Set(members.map((email) => normalizeEmail(email)).filter(Boolean)),
    }
  } catch (error) {
    return {
      checked: false,
      emails: new Set(),
      warning: error instanceof Error ? error.message : 'Redis read failed',
    }
  }
}

export async function loadExclusions(): Promise<LoadedExclusions> {
  const warnings: string[] = []
  const [suppression, firstRun] = await Promise.all([
    loadRedisEmailSet(RENEWAL_SUPPRESSION_SET),
    loadRedisEmailSet(FIRST_RUN_EXCLUSION_SET),
  ])
  if (!suppression.checked) {
    warnings.push(
      `${RENEWAL_SUPPRESSION_SET} was not read. Suppressed addresses are not excluded until Redis is configured.`
    )
  }
  if (suppression.warning) warnings.push(suppression.warning)
  if (!firstRun.checked) {
    warnings.push(
      `${FIRST_RUN_EXCLUSION_SET} was not read. The Oct 2 triage list is not applied until ops loads it into Redis.`
    )
  }
  if (firstRun.warning) warnings.push(firstRun.warning)

  return {
    suppressed: suppression.emails,
    firstRunRedis: firstRun.emails,
    suppressionChecked: suppression.checked,
    firstRunRedisChecked: firstRun.checked,
    warnings,
  }
}

async function typeformEmailOnForm(
  formId: string,
  responseId: string,
  token: string
): Promise<string | null | 'unauthorized' | 'failed'> {
  const url = `https://api.typeform.com/forms/${encodeURIComponent(
    formId
  )}/responses?included_response_ids=${encodeURIComponent(responseId)}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401 || res.status === 403) return 'unauthorized'
  if (res.status === 404) return null
  if (!res.ok) return 'failed'
  let data: { items?: Array<{ answers?: unknown }> }
  try {
    data = (await readUpstreamJson('Typeform', res)) as { items?: Array<{ answers?: unknown }> }
  } catch (error) {
    if (error instanceof UpstreamNonJsonError) throw error
    return 'failed'
  }
  const answers = data.items?.[0]?.answers
  return extractEmailFromTypeformAnswers(answers)
}

export async function loadTypeformEmail(
  responseId: string,
  formIds: string[],
  token: string
): Promise<string | null | 'unauthorized' | 'failed'> {
  for (const formId of formIds) {
    const email = await typeformEmailOnForm(formId, responseId, token)
    if (email === 'unauthorized' || email === 'failed') return email
    if (email) return normalizeEmail(email)
  }
  return null
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function run() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()))
  return results
}

export type AssembleCoverageResult =
  | {
      ok: true
      rows: CoverageInput[]
      expiryUnknown: number
      typeformRead: true
      kitRead: true
    }
  | { ok: false; error: string; typeformRead: boolean; kitRead: boolean }

export async function assembleCoverageInputs(args: {
  profiles: CitizenProfile[]
  expiresAt: Map<string, number | null>
  nowMs: number
  formIds: string[]
  typeformToken: string | null
  kitConfigured: boolean
  exclusions: LoadedExclusions
}): Promise<AssembleCoverageResult> {
  const { isInReminderWindow } = await import('@/lib/citizen/renewalCoverage')
  const inWindow = args.profiles.filter((profile) => {
    const expires = args.expiresAt.get(profile.tokenId)
    return expires != null && isInReminderWindow(expires, args.nowMs)
  })
  const expiryUnknown = args.profiles.filter(
    (profile) => args.expiresAt.get(profile.tokenId) == null
  ).length

  if (!args.typeformToken || args.formIds.length === 0) {
    return {
      ok: false,
      error: 'Typeform is not configured',
      typeformRead: false,
      kitRead: false,
    }
  }
  if (!args.kitConfigured) {
    return {
      ok: false,
      error: 'Kit is not configured',
      typeformRead: false,
      kitRead: false,
    }
  }

  let lookedUp: Array<{ profile: CitizenProfile; email: string | null }>
  try {
    lookedUp = await mapWithConcurrency(inWindow, 6, async (profile) => {
      if (!profile.formId) return { profile, email: null as string | null }
      const email = await loadTypeformEmail(
        profile.formId,
        args.formIds,
        args.typeformToken as string
      )
      if (email === 'unauthorized') {
        throw new Error('Typeform rejected TYPEFORM_PERSONAL_ACCESS_TOKEN')
      }
      if (email === 'failed') {
        throw new Error('Typeform read failed')
      }
      return { profile, email }
    })
  } catch (error) {
    if (error instanceof UpstreamNonJsonError) throw error
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Typeform read failed',
      typeformRead: false,
      kitRead: false,
    }
  }

  let kitRecords = new Map<string, KitSubscriberRecord>()
  try {
    kitRecords = await loadKitSubscriberRecords(
      lookedUp.map((row) => row.email).filter((email): email is string => Boolean(email))
    )
  } catch (error) {
    if (error instanceof UpstreamNonJsonError) throw error
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Kit read failed',
      typeformRead: true,
      kitRead: false,
    }
  }

  const rows: CoverageInput[] = lookedUp.map(({ profile, email }) => {
    const expires = args.expiresAt.get(profile.tokenId) as number
    const normalized = email ? normalizeEmail(email) : null
    const record = normalized ? kitRecords.get(normalized) : undefined
    return {
      tokenId: profile.tokenId,
      expiresAt: expires,
      email: normalized,
      kitState: record?.state ?? null,
      kitSubscriberId: record?.id ?? null,
      suppressed: normalized ? args.exclusions.suppressed.has(normalized) : false,
      firstRunRedis: normalized ? args.exclusions.firstRunRedis.has(normalized) : false,
    }
  })

  return { ok: true, rows, expiryUnknown, typeformRead: true, kitRead: true }
}
