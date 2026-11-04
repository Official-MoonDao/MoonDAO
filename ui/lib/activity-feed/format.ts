// Pure helpers that shape raw rows into feed items. Kept free of config and
// network imports so they can be unit tested directly.
import { createHash } from 'crypto'
import { absoluteUrl, FeedItem } from './rss'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function truncate(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean
}

// The Google Form stored labels like "Community Growth & Engagement (e.g.,
// events, moderation, onboarding)", sometimes several joined by commas.
export function shortArea(area: string): string {
  return area.replace(/\s*\(e\.g\.[^)]*\)/g, '').trim()
}

// Town Hall summaries open with "Town Hall Summary" and then repeat the title,
// which the item title already shows.
export function townHallExcerpt(title: string, text: string): string {
  let body = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^Town Hall Summary\s*/i, '')
  const cleanTitle = title.replace(/\s+/g, ' ').trim()
  if (cleanTitle && body.startsWith(cleanTitle)) body = body.slice(cleanTitle.length).trim()
  return body
}

/** Monday 00:00 UTC of the week `date` falls in. */
export function weekStart(date: Date): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
  return day
}

export type ContributionEntry = {
  // Identifies the contributor across rows: wallet address, or name when a
  // sheet row has none.
  person: string
  name: string
  text: string
  area?: string
  at: Date
}

/**
 * One item per contributor per week (Monday to Sunday, UTC), so a prolific
 * week doesn't bury everything else in the digest. Only finished weeks are
 * listed: an item's guid can't change once a reader has seen it, so a week
 * still taking contributions would lose the ones that came in after.
 */
export function groupContributions(
  entries: ContributionEntry[],
  opts: { now: Date; since: Date }
): FeedItem[] {
  const groups = new Map<string, { start: Date; entries: ContributionEntry[] }>()
  for (const entry of entries) {
    if (Number.isNaN(entry.at.getTime()) || !entry.text.trim()) continue
    const start = weekStart(entry.at)
    const end = start.getTime() + WEEK_MS
    if (end > opts.now.getTime() || end <= opts.since.getTime()) continue
    const key = `${entry.person.toLowerCase()}|${start.toISOString()}`
    const group = groups.get(key) ?? { start, entries: [] }
    group.entries.push(entry)
    groups.set(key, group)
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const sorted = [...group.entries].sort((a, b) => a.at.getTime() - b.at.getTime())
    const name = sorted[sorted.length - 1].name
    const areas = Array.from(
      new Set(sorted.flatMap((e) => (e.area ? e.area.split(/,\s*(?=[A-Z])/) : [])).filter(Boolean))
    )
    const personHash = createHash('sha1').update(key.split('|')[0]).digest('hex').slice(0, 10)
    const base = {
      guid: `contributions-${personHash}-${group.start.toISOString().slice(0, 10)}`,
      link: absoluteUrl('/contributions'),
      pubDate: new Date(group.start.getTime() + WEEK_MS),
      category: 'Contribution' as const,
    }
    if (sorted.length === 1) {
      return {
        ...base,
        title: `${name} contributed: ${truncate(sorted[0].text, 90)}`,
        summary: [areas.join(', '), truncate(sorted[0].text, 280)].filter(Boolean).join(' · '),
      }
    }
    return {
      ...base,
      title: `${name} made ${sorted.length} contributions`,
      summary: areas.join(', ') || undefined,
      lines: sorted.map((e) => truncate(e.text, 160)),
    }
  })
}
