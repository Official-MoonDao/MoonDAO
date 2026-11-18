/**
 * Share link and prefilled post for a free forecast.
 *
 * The URL is a public page on www.moondao.com. Query, hash, and wallet
 * addresses from the visitor's page stay off the link. When the pick is a
 * listed competitor in a Moon Base Zero race, the link goes to that race's
 * prize page with `pick=<projectId>` so the preview card can name it. The
 * post names the forecast they are sharing.
 */
import { findDePrizeIdForGoal, getDePrizeRaceBinding } from '@/lib/deprize/competitions'
import { SEED_ATLAS } from '@/lib/lunar-atlas/seed'
import { orgById, projectById, sharedGoalById } from '@/lib/lunar-atlas/selectors'

export const FORECAST_SHARE_ORIGIN = 'https://www.moondao.com'

export const FORECAST_SHARE_INVITE = "Who's your pick?"

/** Used when the saved competitor has no public name yet. */
export const FORECAST_SHARE_TEXT = `I made my forecast on MoonDAO 🌕\n\n${FORECAST_SHARE_INVITE}`

/** X counts every attached URL as 23 characters, plus the space before it. */
export const X_URL_WEIGHT = 23
export const X_POST_LIMIT = 280

/** Vehicle names come from the public race, which lives on Arbitrum. */
const SHARE_CHAIN_SLUG = 'arbitrum'

const GENERIC_PICK = /^(this competitor|team #\d+)$/i
/** The site's names for the catch-all outcome. */
const FIELD_PICK = /^(other|other entrants|open field)$/i
const PROJECT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/

/** A pick resolved against the atlas. Every field is public atlas copy. */
export type ForecastSharePick = {
  raceId: string
  projectId: string
  /** Vehicle label on the live prize page, else the atlas project name. */
  name: string
  /** Operator, left out when the name already says it. */
  org?: string
  /** Short race name before the dash, e.g. "Touchdown". */
  raceName?: string
  /** The race as a phrase, e.g. "next successful lunar landing". */
  race: string
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function sharePickName(pick?: string | null): string | null {
  if (pick == null) return null
  const name = String(pick).replace(/\s+/g, ' ').trim()
  if (!name || GENERIC_PICK.test(name)) return null
  if (/0x[a-fA-F0-9]{40}/i.test(name) || name.includes('@')) return null
  return name
}

function vehicleLabel(raceId: string, projectId: string): string | undefined {
  const binding = getDePrizeRaceBinding(
    SHARE_CHAIN_SLUG,
    findDePrizeIdForGoal(SHARE_CHAIN_SLUG, raceId)
  )
  return binding?.outcomes.find((o) => !o.field && o.projectId === projectId)?.vehicleLabel
}

function raceWording(title: string): { raceName?: string; race: string } {
  const [head, ...rest] = title.split(' — ')
  const phrase = rest.length ? rest.join(' — ') : head
  const race = phrase.trim().replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())
  return rest.length ? { raceName: head.trim(), race } : { race }
}

/**
 * Match a saved pick to a competitor in one race. Accepts the project id or
 * any name the site shows for it (vehicle label, project name, operator).
 * Null for the open field, a team with no atlas entry, or an unknown race.
 */
export function resolveForecastSharePick(
  raceId?: string | null,
  pick?: string | null
): ForecastSharePick | null {
  if (!raceId || pick == null) return null
  const goal = sharedGoalById(SEED_ATLAS, String(raceId))
  if (!goal) return null
  const wanted = normalize(String(pick))
  if (!wanted) return null
  for (const projectId of goal.projectIds) {
    const project = projectById(SEED_ATLAS, projectId)
    if (!project) continue
    const org = orgById(SEED_ATLAS, project.orgId)
    const label = vehicleLabel(goal.id, projectId)
    const names = [projectId, project.name, label, org?.name].filter(Boolean) as string[]
    if (!names.some((n) => normalize(n) === wanted)) continue
    const name = label || project.name
    const orgName = org?.name
    const showOrg =
      orgName &&
      !normalize(name).includes(normalize(orgName)) &&
      !normalize(orgName).includes(normalize(name))
    return {
      raceId: goal.id,
      projectId,
      name,
      org: showOrg ? orgName : undefined,
      ...raceWording(goal.title),
    }
  }
  return null
}

/** Inverse of the `pick` query param on a race page. */
export function forecastSharePickFromQuery(
  raceId: string | null | undefined,
  value: string | string[] | undefined
): ForecastSharePick | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || !PROJECT_ID.test(raw)) return null
  const share = resolveForecastSharePick(raceId, raw)
  return share && share.projectId === raw ? share : null
}

function fitName(name: string, budget: number): string {
  if (name.length <= budget) return name
  const cut = name.slice(0, Math.max(1, budget - 1))
  const space = cut.lastIndexOf(' ')
  return `${(space > 8 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}…`
}

/**
 * Prefilled post: the pick, the race it is in, and an invitation to pick too.
 * No availability or jurisdiction line.
 */
export function forecastShareText(pick?: string | null, raceId?: string | null): string {
  const share = resolveForecastSharePick(raceId, pick)
  const tail = ` 🌕\n\n${FORECAST_SHARE_INVITE}`
  const room = X_POST_LIMIT - 1 - X_URL_WEIGHT - tail.length
  if (share) {
    const pickLine = share.org ? `${share.name} (${share.org})` : share.name
    const full = `My forecast for the ${share.race}: ${pickLine}`
    if (full.length <= room) return `${full}${tail}`
    return `My forecast: ${fitName(share.name, room - 'My forecast: '.length)}${tail}`
  }
  const name = sharePickName(pick)
  if (!name) return FORECAST_SHARE_TEXT
  if (FIELD_PICK.test(name)) {
    const goal = raceId ? sharedGoalById(SEED_ATLAS, String(raceId)) : undefined
    const race = goal ? ` for the ${raceWording(goal.title).race}` : ''
    return `My forecast${race}: the Open Field${tail}`
  }
  const prefix = 'My forecast: '
  return `${prefix}${fitName(name, room - prefix.length)}${tail}`
}

export type ForecastShareMethod = 'x' | 'copy'

const WALLET_SEGMENT = /^0x[a-fA-F0-9]{40}$/i
const TX_SEGMENT = /^0x[a-fA-F0-9]{64}$/i
const ADDRESS_IN_SEGMENT = /0x[a-fA-F0-9]{40}/i

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

/**
 * Pathname only. Drops a query, a hash, and any segment that is an address
 * or a transaction hash. Null when the input is not a site path.
 */
export function canonicalForecastPath(input: string | null | undefined): string | null {
  if (input == null) return null
  let raw = String(input).trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('mailto:') || raw.startsWith('#')) {
    return null
  }
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) {
      const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw)
      raw = url.pathname
    }
  } catch {
    return null
  }
  const pathOnly = raw.split('#')[0].split('?')[0]
  if (!pathOnly.startsWith('/') || pathOnly.includes('\\') || pathOnly.includes('@')) return null
  const segments: string[] = []
  let droppedIdentity = false
  for (const segment of pathOnly.split('/')) {
    if (!segment) continue
    const decoded = decodeSegment(segment)
    if (decoded == null) return null
    if (
      decoded.includes('/') ||
      decoded.includes('\\') ||
      decoded.includes('@') ||
      decoded === '.' ||
      decoded === '..'
    ) {
      return null
    }
    if (
      WALLET_SEGMENT.test(decoded) ||
      TX_SEGMENT.test(decoded) ||
      ADDRESS_IN_SEGMENT.test(decoded)
    ) {
      droppedIdentity = true
      continue
    }
    segments.push(encodeURIComponent(decoded))
  }
  if (segments.length === 0) return droppedIdentity ? null : '/'
  return `/${segments.join('/')}`
}

/**
 * A named pick links to a race prize page, which can render its card. Moon
 * Base pages are static and cannot, so they hand off to `/deprize/<race>`.
 */
export function forecastShareUrl(
  input: string | null | undefined,
  method: ForecastShareMethod,
  share?: ForecastSharePick | null
): string {
  const canonical = canonicalForecastPath(input)
  const source = method === 'copy' ? 'copy' : 'x'
  const utm = `utm_source=${source}&utm_medium=social&utm_campaign=forecast_share`
  if (share) {
    const path = canonical?.startsWith('/deprize/') ? canonical : `/deprize/${share.raceId}`
    return `${FORECAST_SHARE_ORIGIN}${path}?pick=${encodeURIComponent(share.projectId)}&${utm}`
  }
  return `${FORECAST_SHARE_ORIGIN}${canonical ?? '/deprize'}?${utm}`
}

/** Composed X post length. The attached page URL counts as 23, not its full length. */
export function forecastXPostLength(text: string = FORECAST_SHARE_TEXT): number {
  const separator = text.length > 0 ? 1 : 0
  return text.length + separator + X_URL_WEIGHT
}

export function forecastXIntentUrl(
  input: string | null | undefined,
  pick?: string | null,
  raceId?: string | null
): string {
  const url = forecastShareUrl(input, 'x', resolveForecastSharePick(raceId, pick))
  return `https://x.com/intent/post?text=${encodeURIComponent(
    forecastShareText(pick, raceId)
  )}&url=${encodeURIComponent(url)}`
}

/** Absolute URL of the preview card for a resolved pick. */
export function forecastOgImagePath(
  share: Pick<ForecastSharePick, 'raceId' | 'projectId'>
): string {
  const params = new URLSearchParams({ race: share.raceId, pick: share.projectId })
  return `/api/og/forecast?${params.toString()}`
}
