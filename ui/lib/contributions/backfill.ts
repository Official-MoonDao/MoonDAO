// Turns the reviewed backfill sheet (docs/contributions-backfill/
// contributions_backfill_review.csv) into `importBatch` rows for the
// Contributions table, and packs them into Safe transactions. Pure functions:
// the CLI in scripts/contributions-backfill.ts does the file and RPC work.
//
// Imported text is public and permanent, so anything doubtful is left out and
// listed in the manifest instead: rows marked `skip` in the review column, rows
// with no wallet, and rows from people who were never Citizens (kept offline
// per the migration plan, importable later if they become one).
import {
  AREA_MAX_BYTES,
  CONTRIBUTION_AREAS,
  DESCRIPTION_MAX_BYTES,
  LINKS_MAX_BYTES,
  MAX_LINKS,
  TITLE_MAX_BYTES,
  encodeLinks,
  normalizeLink,
  utf8Bytes,
} from './onchain'

// Contract limits not needed by the submit form.
export const METADATA_MAX_BYTES = 1000
// Building the INSERT onchain costs about 1,000 gas per statement byte
// (measured on Sepolia: 1.2 KB ≈ 1.3M gas, 12 KB ≈ 12M), and it grows faster
// than that as a batch gets longer. Arbitrum caps a transaction at 32M gas, so
// statements stay far below Tableland's 35,000-byte limit.
export const STATEMENT_BUDGET_BYTES = 12_000
export const GAS_PER_STATEMENT_BYTE = 1_100
// Each Safe transaction is a MultiSend of several importBatch calls; together
// they must fit under Arbitrum's 32M per-transaction gas cap.
export const SAFE_TX_GAS_BUDGET = 28_000_000

const COLUMNS =
  'id,cycleId,author,title,description,area,links,metadata,origin,hidden,createdAt,updatedAt,shareBps,reward'
const TRUNCATED_SUFFIX = ' […]'

/** One row of the review sheet, keyed by its header. */
export type ReviewRow = Record<string, string>

/** Mirrors `Contributions.ImportRow`. */
export type ImportRow = {
  author: `0x${string}`
  cycleId: bigint
  createdAt: bigint
  title: string
  description: string
  area: string
  links: string
  metadata: string
  shareBps: bigint
  reward: string
}

export type PlannedRow = {
  /** 1-based line in the review sheet, header excluded. */
  line: number
  source: ReviewRow
  importRow?: ImportRow
  /** Why the row is left out. Set only when importRow is not. */
  skipped?: string
  /** What was changed to fit the contract. */
  notes: string[]
}

// Areas from older forms and reports, mapped to today's six. The original
// stays in metadata.areaAsGiven.
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

export function mapArea(area: string): string {
  const key = area.trim().toLowerCase()
  const current = CONTRIBUTION_AREAS.find(
    (a) => a.code === key || a.label.toLowerCase() === key
  )
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

/** Web links in free text, normalized and de-duplicated, in order. */
export function extractLinks(text: string): string[] {
  const links: string[] = []
  for (const token of text.split(/[\s,;]+/)) {
    const url = token && /^(https?:\/\/|www\.)/i.test(token) ? normalizeLink(token) : null
    if (url && !links.includes(url)) links.push(url)
  }
  return links
}

function fitLinks(all: string[]): { links: string[]; dropped: number } {
  const links = all.slice(0, MAX_LINKS)
  while (links.length && utf8Bytes(encodeLinks(links)) > LINKS_MAX_BYTES) links.pop()
  return { links, dropped: all.length - links.length }
}

function parseReward(raw: string): Record<string, number> | null {
  if (!raw.trim()) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) return parsed
  } catch {
    // Not JSON: treat as no recorded reward.
  }
  return null
}

function reviewDecision(row: ReviewRow): 'skip' | 'include' | null {
  const value = (row.review ?? '').trim().toLowerCase()
  if (['skip', 'exclude', 'no', 'drop'].includes(value)) return 'skip'
  if (['include', 'yes', 'ok', 'import'].includes(value)) return 'include'
  return null
}

/**
 * Decides, row by row, what goes onchain. `openCycleId` is the table's
 * `currentCycleId`: later cycles are refused by the contract, and results
 * can't be imported into the open one. `now` is in seconds.
 */
export function planBackfill(
  rows: ReviewRow[],
  { openCycleId, now }: { openCycleId: number; now: number }
): PlannedRow[] {
  const planned = rows.map((source, i): PlannedRow => {
    const line = i + 1
    const notes: string[] = []
    const skip = (skipped: string): PlannedRow => ({ line, source, skipped, notes })

    const decision = reviewDecision(source)
    if (decision === 'skip') return skip('marked skip in review')

    const author = (source.author ?? '').trim().toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(author) || /^0x0{40}$/.test(author)) return skip('no wallet')
    if (!source.citizen_id?.trim() && decision !== 'include')
      return skip('never a Citizen: kept offline')

    const cycleId = Number(source.cycleId)
    if (!Number.isInteger(cycleId) || cycleId <= 0) return skip('no cycle')
    if (cycleId > openCycleId) return skip(`cycle ${cycleId} is after the open cycle`)

    const createdAt = Number(source.createdAt)
    if (!Number.isInteger(createdAt) || createdAt <= 0 || createdAt > now)
      return skip('bad timestamp')

    const fullText = (source.description_verbatim ?? '').trim()
    if (!fullText) return skip('no text')
    if (fullText.includes('\u0000')) return skip('text contains a NUL byte')
    const description = truncateBytes(fullText, DESCRIPTION_MAX_BYTES, TRUNCATED_SUFFIX)
    if (description !== fullText) notes.push(`description cut from ${utf8Bytes(fullText)} bytes`)

    const titleSource =
      (source.title_derived ?? '').trim() || fullText.split('\n')[0].trim()
    const title = truncateBytes(titleSource, TITLE_MAX_BYTES, '…')

    const areaAsGiven = (source.area ?? '').trim()
    const area = mapArea(areaAsGiven)

    const { links, dropped } = fitLinks(extractLinks(source.links ?? ''))
    if (dropped) notes.push(`${dropped} link(s) dropped to fit`)

    // Past payouts were per person per quarter, not per contribution, so the
    // result sits in metadata (shown once per quarter on the profile) and
    // shareBps stays 0. The open cycle gets its results from recordResults.
    const sharePct = Number(source.result_share_pct)
    const reward = parseReward(source.result_reward ?? '')
    const hasResult = (Number.isFinite(sharePct) && sharePct > 0) || !!reward
    const cycleReward =
      hasResult && cycleId < openCycleId
        ? { ...(sharePct > 0 ? { sharePct } : {}), ...(reward ?? {}) }
        : undefined

    const meta: Record<string, unknown> = {
      source: source.source,
      sourceRef: source.source_ref || undefined,
      titleGenerated: true,
      areaAsGiven: areaAsGiven && areaAsGiven !== area ? areaAsGiven : undefined,
      dateApprox: source.submitted_at_approx === 'True' || undefined,
      descriptionBytes: description !== fullText ? utf8Bytes(fullText) : undefined,
      linksDropped: dropped || undefined,
      cycleReward,
      rewardScope: cycleReward ? 'person' : undefined,
    }
    let metadata = JSON.stringify(meta)
    if (utf8Bytes(metadata) > METADATA_MAX_BYTES) {
      delete meta.source
      metadata = JSON.stringify(meta)
      notes.push('source name dropped from metadata')
    }
    if (utf8Bytes(metadata) > METADATA_MAX_BYTES) return skip('metadata too long')
    if (utf8Bytes(area) > AREA_MAX_BYTES) return skip('area too long')

    return {
      line,
      source,
      notes,
      importRow: {
        author: author as `0x${string}`,
        cycleId: BigInt(cycleId),
        createdAt: BigInt(createdAt),
        title,
        description,
        area,
        links: encodeLinks(links),
        metadata,
        shareBps: BigInt(0),
        reward: '',
      },
    }
  })
  // Oldest first, so row IDs follow history.
  return planned.sort(
    (a, b) =>
      Number(a.importRow?.createdAt ?? 0) - Number(b.importRow?.createdAt ?? 0) ||
      a.line - b.line
  )
}

function sqlQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

/** Bytes this row adds to the INSERT, matching `Contributions._importValues`. */
export function rowStatementBytes(row: ImportRow): number {
  // Row IDs and the import time are filled in onchain; assume wide values.
  const id = '9'.repeat(9)
  const importedAt = '9'.repeat(10)
  const values = [
    id,
    row.cycleId.toString(),
    sqlQuote(row.author),
    sqlQuote(row.title),
    sqlQuote(row.description),
    sqlQuote(row.area),
    sqlQuote(row.links),
    sqlQuote(row.metadata),
    '1',
    '0',
    row.createdAt.toString(),
    importedAt,
    row.shareBps.toString(),
    sqlQuote(row.reward),
  ].join(',')
  // "(...)" plus the comma before every row after the first.
  return utf8Bytes(values) + 3
}

/** Splits rows into importBatch calls that each fit one Tableland statement. */
export function packStatements(
  rows: ImportRow[],
  tableName: string,
  budget = STATEMENT_BUDGET_BYTES
): ImportRow[][] {
  const header = utf8Bytes(`INSERT INTO ${tableName}(${COLUMNS})VALUES`)
  const batches: ImportRow[][] = []
  let current: ImportRow[] = []
  let size = header
  for (const row of rows) {
    const bytes = rowStatementBytes(row)
    if (header + bytes > budget) throw new Error(`Row "${row.title}" is too large for one statement`)
    if (current.length && size + bytes > budget) {
      batches.push(current)
      current = []
      size = header
    }
    current.push(row)
    size += bytes
  }
  if (current.length) batches.push(current)
  return batches
}

/** Rough gas for one importBatch call, before simulation measures it. */
export function estimateImportGas(rows: ImportRow[]): number {
  return 500_000 + rows.reduce((n, r) => n + rowStatementBytes(r), 0) * GAS_PER_STATEMENT_BYTE
}

/** Groups calls into Safe transactions so each stays under a gas budget. */
export function packSafeTransactions<T extends { gas: number }>(
  calls: T[],
  budget = SAFE_TX_GAS_BUDGET
): T[][] {
  const groups: T[][] = []
  let current: T[] = []
  let gas = 0
  for (const call of calls) {
    if (current.length && gas + call.gas > budget) {
      groups.push(current)
      current = []
      gas = 0
    }
    current.push(call)
    gas += call.gas
  }
  if (current.length) groups.push(current)
  return groups
}
