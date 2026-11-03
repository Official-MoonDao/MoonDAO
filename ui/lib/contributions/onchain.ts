// Field rules and row shapes for the onchain Contributions table. Shared by the
// submit form, the API routes and the feed, so the browser rejects exactly what
// the deployed contracts revert on. Those contracts never truncate: an over-long
// field fails the whole transaction.
import { CONTRIBUTIONS_ADDRESSES, CONTRIBUTIONS_TABLE_NAMES } from 'const/config'

// Byte limits of the deployed contracts (see CONTRIBUTIONS_ADDRESSES). Solidity
// measures UTF-8 bytes, not characters, so non-Latin text reaches the limit
// sooner. The contracts revert above DESCRIPTION_MAX (8,000 bytes), matching
// Contributions.sol.
export const TITLE_MAX_BYTES = 120
export const DESCRIPTION_MAX_BYTES = 8000
export const AREA_MAX_BYTES = 32
export const LINKS_MAX_BYTES = 1000
export const MAX_LINKS = 10

// The same five areas as the 2026 Google Form, stored as short codes so they fit
// the contract's 32-byte `area` column. One main area per contribution.
export const CONTRIBUTION_AREAS = [
  {
    code: 'community',
    label: 'Community Growth & Engagement',
    hint: 'Events, moderation, onboarding',
  },
  {
    code: 'content',
    label: 'Content Creation & Marketing',
    hint: 'Articles, social media, graphics',
  },
  {
    code: 'space',
    label: 'Space Exploration & Research',
    hint: 'Payloads, research, development',
  },
  {
    code: 'technical',
    label: 'Technical Development',
    hint: 'Smart contracts, website, tooling',
  },
  {
    code: 'governance',
    label: 'Governance & Operations',
    hint: 'Proposal review, documentation',
  },
  { code: 'other', label: 'Other', hint: 'Anything else that moves the mission forward' },
] as const

export type ContributionAreaCode = (typeof CONTRIBUTION_AREAS)[number]['code']

export function areaLabel(area: string): string {
  return CONTRIBUTION_AREAS.find((a) => a.code === area)?.label ?? area
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length
}

/** `20264` → "Q4 2026". Cycle IDs are quarter codes: year then quarter. */
export function cycleLabel(cycleId: number | string): string {
  const n = Number(cycleId)
  const quarter = n % 10
  const year = Math.floor(n / 10)
  if (!Number.isInteger(n) || quarter < 1 || quarter > 4 || year < 2000) return `Cycle ${cycleId}`
  return `Q${quarter} ${year}`
}

/** A live submission. Imported rows are origin 1. A missing origin counts as live. */
export function isSubmittedOrigin(origin: unknown): boolean {
  if (origin == null || origin === '') return true
  return Number(origin) === 0
}

/** Address and table name for a chain, or null until the contract is deployed there. */
export function contributionsTable(chainSlug: string): { address: string; name: string } | null {
  const address = CONTRIBUTIONS_ADDRESSES[chainSlug]
  const name = CONTRIBUTIONS_TABLE_NAMES[chainSlug]
  if (!address || !name) return null
  return { address, name }
}

/** Accepts "example.com/x" as https. Returns null for anything that isn't an http(s) URL. */
export function normalizeLink(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

/** Links are stored as a JSON array of URLs in the `links` column. */
export function encodeLinks(links: readonly string[]): string {
  return links.length ? JSON.stringify(links) : ''
}

/** Reads the JSON array this form writes, and plain newline-separated text from imports. */
export function decodeLinks(stored: string | null | undefined): string[] {
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    // Not JSON: imported rows may hold plain text.
  }
  return stored
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export type ContributionDraft = {
  title: string
  description: string
  area: string
  links: string[]
}

export type ContributionFieldErrors = Partial<
  Record<'title' | 'description' | 'area' | 'links', string>
>

/** Mirrors the contract's checks so a bad field never reaches a signature. */
export function validateContribution(draft: ContributionDraft): {
  errors: ContributionFieldErrors
  links: string[]
} {
  const errors: ContributionFieldErrors = {}
  const title = draft.title.trim()
  const description = draft.description.trim()

  if (!title) errors.title = 'Add a short title.'
  else if (utf8Bytes(title) > TITLE_MAX_BYTES) errors.title = 'The title is too long.'

  if (!description) errors.description = 'Describe what you did.'
  else if (utf8Bytes(description) > DESCRIPTION_MAX_BYTES)
    errors.description = 'The description is too long. Shorten it or link to a longer write-up.'

  if (!CONTRIBUTION_AREAS.some((a) => a.code === draft.area)) errors.area = 'Pick an area.'

  const filled = draft.links.map((l) => l.trim()).filter(Boolean)
  const links: string[] = []
  for (const raw of filled) {
    const url = normalizeLink(raw)
    if (!url) {
      errors.links = `"${raw}" isn't a web link.`
      break
    }
    if (!links.includes(url)) links.push(url)
  }
  if (!errors.links && links.length > MAX_LINKS) errors.links = `Add at most ${MAX_LINKS} links.`
  if (!errors.links && utf8Bytes(encodeLinks(links)) > LINKS_MAX_BYTES)
    errors.links = 'These links are too long together. Remove one or use shorter URLs.'

  return { errors, links }
}

/** One row of the Contributions table as Tableland returns it. */
export type ContributionRow = {
  id: number
  cycleId: number
  author: string
  title: string
  description: string
  area: string
  links: string
  metadata: string
  origin: number
  hidden: number
  createdAt: number
  updatedAt: number
  shareBps: number
  reward: string
}

export type TextSegment = { text: string; href?: string }

const URL_IN_TEXT = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi

/**
 * Splits free text into plain and link segments so URLs pasted into a
 * description render as links. Only http(s) and www. addresses become links,
 * and closing punctuation stays outside the link.
 */
export function splitTextLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let last = 0
  for (const match of text.matchAll(URL_IN_TEXT)) {
    let raw = match[0]
    const trailing = raw.match(/[.,;:!?)\]}]+$/)?.[0] ?? ''
    // Keep a closing paren that belongs to the URL, e.g. a Wikipedia link.
    const keep = trailing.startsWith(')') && raw.includes('(') ? 1 : 0
    const cut = trailing.length - keep
    if (cut > 0) raw = raw.slice(0, -cut)
    const start = match.index ?? 0
    const href = normalizeLink(raw)
    if (!href) continue
    if (start > last) segments.push({ text: text.slice(last, start) })
    segments.push({ text: raw, href })
    last = start + raw.length
  }
  if (last < text.length) segments.push({ text: text.slice(last) })
  return segments
}
