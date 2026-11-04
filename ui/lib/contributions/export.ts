// CSV for the Senate's contribution review (pages/api/contributions/export.ts).
import type { ContributionEntry } from './archive'
import { areaLabel } from './onchain'

const HEADER = [
  'Timestamp',
  'Name',
  'Wallet Address',
  'Area',
  'Title',
  'Description',
  'Links',
  'Source',
  'Key',
]

/** `20264`, or a report slug like `2026-q4`. */
export function parseCycleParam(raw: unknown): number | null {
  const value = String(raw ?? '').trim().toLowerCase()
  const slug = value.match(/^(\d{4})-q([1-4])$/)
  const n = slug ? Number(slug[1]) * 10 + Number(slug[2]) : Number(value)
  return Number.isInteger(n) && n % 10 >= 1 && n % 10 <= 4 && n > 20000 ? n : null
}

function cell(value: unknown): string {
  const s = value == null ? '' : String(value)
  // A leading =, +, - or @ makes spreadsheets run the cell as a formula.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function contributionsCsv(entries: ContributionEntry[]): string {
  const rows = entries.map((e) =>
    [
      new Date(e.createdAt * 1000).toISOString(),
      e.name,
      e.wallet,
      areaLabel(e.area),
      e.title,
      e.description,
      e.links.join('\n'),
      e.source,
      e.key,
    ]
      .map(cell)
      .join(',')
  )
  return [HEADER.join(','), ...rows].join('\r\n') + '\r\n'
}
