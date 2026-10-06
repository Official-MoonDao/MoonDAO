// Pure helpers for the head-to-head contribution matchup prototype
// (`/contribute-vote`). See docs/CONTRIBUTIONS_2.0_SPEC.md, "Version 1: the
// simple system".
//
// Everything here is free of I/O so the pairing and scoring rules can be unit
// tested; Redis access lives in `matchupStore.ts`.
import type { Contribution } from './getSheetContributions'

// A sheet row plus the stable id assigned in `matchupPool.ts`.
export type IdentifiedContribution = Contribution & { id: string }

// Matchups only draw from contributions submitted in this rolling window.
export const MATCHUP_WINDOW_DAYS = 90
// Contributions with fewer matchups than this go to the Senate instead of
// being paid from matchup results.
export const MIN_MATCHUPS_FOR_PAYOUT = 5
// Share of ranked contributions (from the bottom) that earn nothing.
export const PAYOUT_CUTOFF_FRACTION = 0.25
// Win rate is raised to this power before normalizing into shares.
export const PAYOUT_EXPONENT = 2
export const MAX_VOTES_PER_DAY = 10

// What the matchup screen shows. Author name, email and wallet are left out on
// purpose so votes judge the work, not the person.
export type MatchupCard = {
  id: string
  area: string
  description: string
  timeCommitment: string
  links: string[]
  submittedAt: string | null
}

export type MatchupStats = {
  wins: Record<string, number>
  matchups: Record<string, number>
}

export type Standing = {
  card: MatchupCard
  wins: number
  matchups: number
  winRate: number | null
  /** Projected share of the peer reward pool (0-1); null when not eligible. */
  share: number | null
  status: 'paid' | 'cut' | 'needs-votes'
}

// Google Forms writes timestamps as "M/D/YYYY H:mm:ss". Fall back to
// Date.parse for anything else (e.g. ISO strings in a re-exported sheet).
export function parseSheetTimestamp(value: string): Date | null {
  const trimmed = (value || '').trim()
  const m = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  )
  if (m) {
    const [, month, day, year, h = '0', min = '0', s = '0'] = m
    const date = new Date(
      Date.UTC(+year, +month - 1, +day, +h, +min, +s)
    )
    return isNaN(date.getTime()) ? null : date
  }
  const parsed = Date.parse(trimmed)
  return isNaN(parsed) ? null : new Date(parsed)
}

// Pull http(s) URLs out of the free-text links field. Anything that isn't
// plainly a web link is dropped so a `javascript:` value can never render.
export function parseLinks(raw: string): string[] {
  const seen = new Set<string>()
  for (const token of (raw || '').split(/[\s,;]+/)) {
    let t = token.trim().replace(/[)\].]+$/, '')
    if (!t) continue
    if (/^www\./i.test(t) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(t)) {
      t = `https://${t}`
    }
    if (!/^https?:\/\/[^\s]+$/i.test(t)) continue
    try {
      seen.add(new URL(t).toString())
    } catch {
      // not a URL
    }
  }
  return Array.from(seen).slice(0, 5)
}

export function toMatchupCard(c: IdentifiedContribution): MatchupCard {
  const submitted = parseSheetTimestamp(c.timestamp)
  return {
    id: c.id,
    area: c.area || '',
    description: c.description,
    timeCommitment: c.timeCommitment || '',
    links: parseLinks(c.links),
    submittedAt: submitted ? submitted.toISOString() : null,
  }
}

// Contributions eligible for matchups: inside the window, de-duplicated by id,
// and never the voter's own (matched on the typed-in wallet address).
export function eligibleCards(
  contributions: IdentifiedContribution[],
  options: { now?: Date; excludeWallet?: string } = {}
): MatchupCard[] {
  const now = options.now ?? new Date()
  const cutoff = now.getTime() - MATCHUP_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const exclude = options.excludeWallet?.trim().toLowerCase()
  const byId = new Map<string, MatchupCard>()
  for (const c of contributions) {
    if (exclude && c.walletAddress?.trim().toLowerCase() === exclude) continue
    const submitted = parseSheetTimestamp(c.timestamp)
    if (!submitted || submitted.getTime() < cutoff) continue
    if (submitted.getTime() > now.getTime() + 24 * 60 * 60 * 1000) continue
    const card = toMatchupCard(c)
    if (!byId.has(card.id)) byId.set(card.id, card)
  }
  return Array.from(byId.values())
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

// Least-compared first: the first card is one of the cards with the fewest
// matchups; its opponent is the least-compared card this voter hasn't already
// judged it against. Ties break randomly so the same pair doesn't repeat.
export function pickPair(
  cards: MatchupCard[],
  matchupCounts: Record<string, number>,
  judgedPairs: Set<string> = new Set(),
  random: () => number = Math.random
): [MatchupCard, MatchupCard] | null {
  if (cards.length < 2) return null
  const count = (id: string) => matchupCounts[id] || 0
  const shuffled = cards
    .map((card) => ({ card, r: random() }))
    .sort((x, y) => count(x.card.id) - count(y.card.id) || x.r - y.r)
    .map((x) => x.card)

  for (const first of shuffled) {
    const opponent = shuffled.find(
      (c) => c.id !== first.id && !judgedPairs.has(pairKey(first.id, c.id))
    )
    if (opponent) {
      return random() < 0.5 ? [first, opponent] : [opponent, first]
    }
  }
  // The voter has judged every pair; let them go again.
  return [shuffled[0], shuffled[1]]
}

const STATUS_ORDER: Record<Standing['status'], number> = {
  paid: 0,
  cut: 1,
  'needs-votes': 2,
}

// Version 1 scoring: win rate, bottom-quarter cutoff (ties at the line are
// paid), squared win rates normalized into shares.
export function computeStandings(
  cards: MatchupCard[],
  stats: MatchupStats
): Standing[] {
  const rows = cards.map((card) => {
    const wins = stats.wins[card.id] || 0
    const matchups = stats.matchups[card.id] || 0
    return {
      card,
      wins,
      matchups,
      winRate: matchups > 0 ? wins / matchups : null,
    }
  })

  const ranked = rows
    .filter((r) => r.matchups >= MIN_MATCHUPS_FOR_PAYOUT)
    .sort((a, b) => (b.winRate as number) - (a.winRate as number))

  const cutCount = Math.floor(ranked.length * PAYOUT_CUTOFF_FRACTION)
  const paidCount = ranked.length - cutCount
  const lineRate = paidCount > 0 ? (ranked[paidCount - 1].winRate as number) : 1
  const paid = new Set(
    ranked.filter((r) => (r.winRate as number) >= lineRate).map((r) => r.card.id)
  )
  const total = ranked
    .filter((r) => paid.has(r.card.id))
    .reduce((sum, r) => sum + Math.pow(r.winRate as number, PAYOUT_EXPONENT), 0)

  return rows
    .map((r): Standing => {
      if (r.matchups < MIN_MATCHUPS_FOR_PAYOUT) {
        return { ...r, share: null, status: 'needs-votes' }
      }
      if (!paid.has(r.card.id)) return { ...r, share: 0, status: 'cut' }
      return {
        ...r,
        share:
          total > 0 ? Math.pow(r.winRate as number, PAYOUT_EXPONENT) / total : 0,
        status: 'paid',
      }
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (b.winRate ?? -1) - (a.winRate ?? -1) ||
        b.matchups - a.matchups
    )
}
