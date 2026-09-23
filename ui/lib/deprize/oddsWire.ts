import { DEPRIZE_AVAILABILITY_LEGEND } from '@/lib/deprize/constants'
import { maxProbDelta } from '@/lib/deprize/lmsr-history'
import { getLadderForCompetition } from '@/lib/deprize/capabilityLadder'
import { escapeDiscordUserText } from '@/lib/discord/escapeUserText'
import type { DiscordPostResult } from '@/lib/discord/postChannelMessage'
import type { DiscordEmbed } from '@/lib/og/preview'

export const ODDS_WIRE_THRESHOLD_PT = 5
export const ODDS_WIRE_MIN_INTERVAL_MIN = 60
export const ODDS_WIRE_DAILY_CAP = 6
export const ODDS_WIRE_ALERT_STREAK = 3
export const ODDS_ACK_BUDGET_MS = 2000

export type OddsWireSnapshot = {
  v: 1
  p: number[]
  outcomeCount: number
  postedAt: number | null
  postedCount: number
}

export type OddsWireReason =
  | 'first-run'
  | 'unparseable-baseline'
  | 'outcome-set-changed'
  | 'bad-read'
  | 'market-closed'
  | 'below-threshold'
  | 'cooldown'
  | 'daily-cap'
  | 'move'

export function parseOddsWireSnapshot(raw: string | null): OddsWireSnapshot | null {
  if (raw == null || raw === '') return null
  let parsed: any
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
  if (!parsed || parsed.v !== 1) return null
  if (!Array.isArray(parsed.p) || typeof parsed.outcomeCount !== 'number') return null
  if (parsed.p.some((x: unknown) => !Number.isFinite(Number(x)))) return null
  if (parsed.outcomeCount !== parsed.p.length) return null
  if (parsed.postedAt != null && !Number.isFinite(parsed.postedAt)) return null
  if (!Number.isInteger(parsed.postedCount) || parsed.postedCount < 0) return null
  return {
    v: 1,
    p: parsed.p.map(Number),
    outcomeCount: parsed.outcomeCount,
    postedAt: parsed.postedAt ?? null,
    postedCount: parsed.postedCount,
  }
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function sameUtcDay(a: number | null, b: number): boolean {
  if (a == null) return false
  return utcDay(a) === utcDay(b)
}

export function planOddsWirePost(opts: {
  previous: OddsWireSnapshot | null
  current: number[]
  closed: boolean
  now: number
  unparseable?: boolean
  thresholdPt?: number
  minIntervalMin?: number
  dailyCap?: number
}): { post: boolean; reason: OddsWireReason } {
  const threshold = opts.thresholdPt ?? ODDS_WIRE_THRESHOLD_PT
  const minIntervalMin = opts.minIntervalMin ?? ODDS_WIRE_MIN_INTERVAL_MIN
  const dailyCap = opts.dailyCap ?? ODDS_WIRE_DAILY_CAP

  if (opts.closed) return { post: false, reason: 'market-closed' }
  if (!opts.current.length || opts.current.some((p) => !Number.isFinite(p))) {
    return { post: false, reason: 'bad-read' }
  }
  if (opts.unparseable && !opts.previous) {
    return { post: false, reason: 'unparseable-baseline' }
  }
  if (!opts.previous) return { post: false, reason: 'first-run' }
  if (opts.previous.outcomeCount !== opts.current.length) {
    return { post: false, reason: 'outcome-set-changed' }
  }
  const delta = maxProbDelta(opts.previous.p, opts.current)
  if (!Number.isFinite(delta) || delta < threshold) {
    return { post: false, reason: 'below-threshold' }
  }
  if (
    opts.previous.postedAt != null &&
    opts.now - opts.previous.postedAt < minIntervalMin * 60_000
  ) {
    return { post: false, reason: 'cooldown' }
  }
  if (
    sameUtcDay(opts.previous.postedAt, opts.now) &&
    opts.previous.postedCount >= dailyCap
  ) {
    return { post: false, reason: 'daily-cap' }
  }
  return { post: true, reason: 'move' }
}

function emptyBaseline(current: number[]): OddsWireSnapshot {
  return {
    v: 1,
    p: current.slice(),
    outcomeCount: current.length,
    postedAt: null,
    postedCount: 0,
  }
}

export function nextOddsWireSnapshot(opts: {
  previous: OddsWireSnapshot | null
  current: number[]
  plan: { post: boolean; reason: OddsWireReason }
  posted: DiscordPostResult | null
  now: number
}): { write: true; value: OddsWireSnapshot } | { write: false } {
  const { plan, posted, current, previous, now } = opts
  if (
    plan.reason === 'first-run' ||
    plan.reason === 'unparseable-baseline' ||
    plan.reason === 'outcome-set-changed'
  ) {
    return { write: true, value: emptyBaseline(current) }
  }
  if (plan.reason === 'move' && posted?.ok) {
    const postedCount =
      previous && sameUtcDay(previous.postedAt, now) ? previous.postedCount + 1 : 1
    return {
      write: true,
      value: {
        v: 1,
        p: current.slice(),
        outcomeCount: current.length,
        postedAt: now,
        postedCount,
      },
    }
  }
  return { write: false }
}

export function oddsWireWatchIds(chainSlug: string): number[] {
  const ids = new Set<number>([22])
  const ladder = getLadderForCompetition(chainSlug, undefined)
  for (const rung of ladder.rungs) {
    if (rung.status === 'live' && rung.deprizeId != null) ids.add(rung.deprizeId)
  }
  return [...ids]
}

export function buildOddsWireEmbed(opts: {
  title: string
  deprizeId: number
  site: string
  labels: string[]
  current: number[]
  previous: number[]
}): DiscordEmbed {
  const lines = opts.labels.map((label, i) => {
    const now = opts.current[i] ?? 0
    const was = opts.previous[i] ?? now
    const delta = now - was
    const sign = delta >= 0 ? '+' : ''
    return `${escapeDiscordUserText(label)}  ${now.toFixed(1)}%  (${sign}${delta.toFixed(1)})`
  })
  return {
    title: escapeDiscordUserText(opts.title),
    description: lines.join('\n'),
    url: `${opts.site.replace(/\/$/, '')}/deprize/${opts.deprizeId}`,
    footer: { text: DEPRIZE_AVAILABILITY_LEGEND },
  }
}
