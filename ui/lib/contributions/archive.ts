// The contribution archive: every contribution from before the in-app form,
// kept offchain in a private Google Sheet because those people never agreed to
// a permanent public record. Deleting a row here really deletes it. The site
// reads the sheet on the server with a service account; it is never published
// to the web. New contributions live in the onchain table instead, and
// `getContributions` merges the two.
import {
  CONTRIBUTION_AREAS,
  TITLE_MAX_BYTES,
  decodeLinks,
  normalizeLink,
  utf8Bytes,
} from './onchain'

/** The archive sheet's header row, in order. */
export const ARCHIVE_COLUMNS = [
  'archive_id',
  'cycleId',
  'citizen_id',
  'wallet',
  'display_name',
  'title',
  'description',
  'area',
  'links',
  'createdAt',
  'share_pct',
  'reward_json',
  'hidden',
] as const

export type ArchiveRecord = Record<(typeof ARCHIVE_COLUMNS)[number], string>

/** One contribution from either store, in the shape every reader uses. */
export type ContributionEntry = {
  /** `chain:<row id>` or `archive:<archive_id>`. */
  key: string
  source: 'onchain' | 'archive'
  /** Onchain row ID, for edit and remove. Archive rows have none. */
  id?: number
  cycleId: number
  /** Lower-cased. Empty when the archive never had one. */
  wallet: string
  /** Citizen name when known, otherwise the name the person gave. */
  name: string
  title: string
  description: string
  /** An area code from CONTRIBUTION_AREAS. */
  area: string
  links: string[]
  /** Seconds. */
  createdAt: number
  /** What the person was paid that quarter. Past payouts were per person. */
  result?: { sharePct?: number; reward?: Record<string, number> }
}

// Areas from older forms and reports, mapped to today's six.
const AREA_ALIASES: Record<string, string> = {
  'community contribution': 'other',
  'marketing (en)': 'content',
  'marketing (cn)': 'content',
  constitution: 'governance',
  'discord operations': 'community',
  'cn community operations': 'community',
  'project operations': 'governance',
  'ticket to space nft': 'other',
  'legal operations': 'governance',
  'website development': 'technical',
  'community guild': 'community',
  'stewardship q2-2023': 'governance',
}

/** An area code for a code, a current label, a label with its "(e.g. …)" hint, or an old area. */
export function mapArea(area: string): string {
  const key = area
    .replace(/\s*\(e\.g\..*\)\s*$/i, '')
    .trim()
    .toLowerCase()
  const current = CONTRIBUTION_AREAS.find((a) => a.code === key || a.label.toLowerCase() === key)
  return current?.code ?? AREA_ALIASES[key] ?? 'other'
}

/** Cuts text to at most `max` UTF-8 bytes without splitting a character. */
export function truncateBytes(text: string, max: number, suffix = ''): string {
  if (utf8Bytes(text) <= max) return text
  const budget = max - utf8Bytes(suffix)
  let out = ''
  let used = 0
  for (const ch of text) {
    const n = utf8Bytes(ch)
    if (used + n > budget) break
    out += ch
    used += n
  }
  return out.trimEnd() + suffix
}

/** A title for text that never had one: its first line, cut to the onchain limit. */
export function deriveTitle(description: string): string {
  const first = description.trim().split(/\n/)[0].trim()
  return truncateBytes(first, TITLE_MAX_BYTES, '…')
}

/** Web links in free text, normalized and de-duplicated. */
export function extractLinks(text: string): string[] {
  const links: string[] = []
  for (const token of text.split(/[\s,;]+/)) {
    const url = /^(https?:\/\/|www\.)/i.test(token) ? normalizeLink(token) : null
    if (url && !links.includes(url)) links.push(url)
  }
  return links
}

function parseReward(raw: string): Record<string, number> | undefined {
  if (!raw?.trim()) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) return parsed
  } catch {
    // Not JSON: no recorded reward.
  }
  return undefined
}

/** Noon UTC on the last day of a quarter-code cycle, for rows with no date. */
export function quarterEnd(cycleId: number): number {
  const year = Math.floor(cycleId / 10)
  const quarter = cycleId % 10
  return Math.floor(Date.UTC(year, quarter * 3, 0, 12) / 1000)
}

/** A sheet row as an entry, or null when it is hidden or unusable. */
export function archiveRecordToEntry(record: Partial<ArchiveRecord>): ContributionEntry | null {
  // A leading apostrophe only marks text that starts with "=" (see the seed script).
  const get = (k: keyof ArchiveRecord) =>
    String(record[k] ?? '')
      .trim()
      .replace(/^'(?==)/, '')
  if (['1', 'true', 'yes'].includes(get('hidden').toLowerCase())) return null
  const archiveId = get('archive_id')
  const cycleId = Number(get('cycleId'))
  const createdAt = Number(get('createdAt'))
  const description = get('description')
  if (!archiveId || !Number.isInteger(cycleId) || cycleId <= 0 || !description) return null

  const wallet = get('wallet').toLowerCase()
  const sharePct = Number(get('share_pct'))
  const reward = parseReward(get('reward_json'))
  const hasShare = get('share_pct') !== '' && Number.isFinite(sharePct) && sharePct > 0
  return {
    key: `archive:${archiveId}`,
    source: 'archive',
    cycleId,
    wallet: /^0x[0-9a-f]{40}$/.test(wallet) ? wallet : '',
    name: get('display_name') || 'Anonymous',
    title: get('title') || deriveTitle(description),
    description,
    area: mapArea(get('area')),
    links: decodeLinks(get('links')),
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : quarterEnd(cycleId),
    result:
      hasShare || reward
        ? { ...(hasShare ? { sharePct } : {}), ...(reward ? { reward } : {}) }
        : undefined,
  }
}

// Server-only from here: the credentials must never reach the browser.
const SHEET_ID = process.env.CONTRIBUTIONS_ARCHIVE_SHEET_ID || ''
const CLIENT_EMAIL = process.env.CONTRIBUTIONS_ARCHIVE_CLIENT_EMAIL || ''
// Vercel stores the key with literal "\n"s.
const PRIVATE_KEY = (process.env.CONTRIBUTIONS_ARCHIVE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
const CACHE_MS = 10 * 60 * 1000

export function isArchiveConfigured(): boolean {
  return !!(SHEET_ID && CLIENT_EMAIL && PRIVATE_KEY)
}

let cache: { at: number; entries: Promise<ContributionEntry[]> } | null = null

async function loadArchive(): Promise<ContributionEntry[]> {
  // Loaded lazily so client bundles that import the types above never pull it in.
  const { GoogleSpreadsheet } = await import('google-spreadsheet')
  const doc = new GoogleSpreadsheet(SHEET_ID)
  await doc.useServiceAccountAuth({ client_email: CLIENT_EMAIL, private_key: PRIVATE_KEY })
  await doc.loadInfo()
  const sheet = doc.sheetsByTitle['archive'] ?? doc.sheetsByIndex[0]
  const rows = await sheet.getRows()
  return rows
    .map((row: any) =>
      archiveRecordToEntry(Object.fromEntries(ARCHIVE_COLUMNS.map((c) => [c, row[c] ?? ''])))
    )
    .filter((e): e is ContributionEntry => e !== null)
}

/**
 * Every visible archive row, cached for ten minutes per server instance.
 * Empty when the archive isn't configured. A failed read throws, so callers
 * can tell "no archive" from "archive unreachable".
 */
export async function getArchiveEntries(): Promise<ContributionEntry[]> {
  if (!isArchiveConfigured()) return []
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const entries = loadArchive()
    cache = { at: Date.now(), entries }
    entries.catch(() => {
      if (cache?.entries === entries) cache = null
    })
  }
  return cache.entries
}
