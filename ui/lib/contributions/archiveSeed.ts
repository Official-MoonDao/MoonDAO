// Builds the archive sheet's rows (see ARCHIVE_COLUMNS) from the reviewed
// backfill sheet and, for the open quarter, the Google Form's responses.
// Used once to seed the archive and again after the form closes.
import { createHash } from 'crypto'
import { ARCHIVE_COLUMNS, deriveTitle, extractLinks, type ArchiveRecord } from './archive'
import { encodeLinks } from './onchain'

function stableId(cycleId: number | string, ...parts: string[]): string {
  const hash = createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 10)
  return `${cycleId}-${hash}`
}

function emptyRecord(): ArchiveRecord {
  return Object.fromEntries(ARCHIVE_COLUMNS.map((c) => [c, ''])) as ArchiveRecord
}

/** Lower-cased first 200 characters with spacing collapsed, to spot the same text twice. */
export function textFingerprint(wallet: string, description: string): string {
  return `${wallet.toLowerCase()}|${description.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 200)}`
}

/** A row of contributions_backfill_review.csv, or null if the review says skip or it has no text. */
export function reviewRowToArchive(row: Record<string, string>): ArchiveRecord | null {
  if (['skip', 'exclude', 'no', 'drop'].includes((row.review ?? '').trim().toLowerCase()))
    return null
  const description = (row.description_verbatim ?? '').trim()
  const cycleId = Number(row.cycleId)
  if (!description || !Number.isInteger(cycleId) || cycleId <= 0) return null
  const wallet = (row.author ?? '').trim().toLowerCase()
  const reward = (row.result_reward ?? '').trim()
  return {
    ...emptyRecord(),
    archive_id: stableId(cycleId, row.source ?? '', row.source_ref ?? '', wallet, row.createdAt ?? ''),
    cycleId: String(cycleId),
    citizen_id: (row.citizen_id ?? '').trim(),
    wallet,
    display_name: (row.citizen_name || row.author_name_as_given || '').trim(),
    title: (row.title_derived ?? '').trim() || deriveTitle(description),
    description,
    area: (row.area ?? '').trim(),
    links: encodeLinks(extractLinks(row.links ?? '')),
    createdAt: (row.createdAt ?? '').trim(),
    share_pct: (row.result_share_pct ?? '').trim(),
    reward_json: reward === '{}' ? '' : reward,
  }
}

/** Google Forms' "M/D/YYYY H:MM:SS", read as UTC. Seconds, or null. */
export function parseFormTimestamp(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const [, mo, d, y, h, mi, s] = m.map(Number)
  return Math.floor(Date.UTC(y, mo - 1, d, h, mi, s || 0) / 1000)
}

/**
 * A row of the Google Form's response sheet. Columns by position, as in
 * getSheetContributions: 0 Timestamp, 1 Name, 2 Email (never copied),
 * 3 Citizen?, 4 Wallet, 5 Area, 6 Description, 7 Time, 8 Links.
 */
export function formRowToArchive(cells: string[], cycleId: number): ArchiveRecord | null {
  const createdAt = parseFormTimestamp(cells[0] ?? '')
  const description = (cells[6] ?? '').trim()
  if (createdAt == null || !description) return null
  const wallet = (cells[4] ?? '').trim().toLowerCase()
  return {
    ...emptyRecord(),
    archive_id: stableId(cycleId, 'form', cells[0] ?? '', wallet, description.slice(0, 200)),
    cycleId: String(cycleId),
    wallet: /^0x[0-9a-f]{40}$/.test(wallet) ? wallet : '',
    display_name: (cells[1] ?? '').trim(),
    title: deriveTitle(description),
    description,
    area: (cells[5] ?? '').trim(),
    links: encodeLinks(extractLinks(cells[8] ?? '')),
    createdAt: String(createdAt),
  }
}

/** Review rows first, then form rows whose text isn't already there. Oldest first. */
export function mergeArchive(review: ArchiveRecord[], form: ArchiveRecord[]): ArchiveRecord[] {
  const seen = new Set(review.map((r) => textFingerprint(r.wallet, r.description)))
  const ids = new Set(review.map((r) => r.archive_id))
  const added = form.filter((r) => {
    const fp = textFingerprint(r.wallet, r.description)
    if (seen.has(fp) || ids.has(r.archive_id)) return false
    seen.add(fp)
    ids.add(r.archive_id)
    return true
  })
  return [...review, ...added].sort(
    (a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0) || a.archive_id.localeCompare(b.archive_id)
  )
}
