import { DEPLOYED_ORIGIN } from 'const/config'
import { bytesOfString } from '@/lib/utils/strings'

/**
 * Rich job postings without a contract redeploy.
 *
 * `JobBoardTable.sol` creates its Tableland table in the constructor, so adding
 * columns means redeploy + migrate on three chains. It already has an unused
 * `metadata` text column, and every free-text column in this repo is capped at
 * 1024 bytes to keep Tableland calldata gas predictable. So:
 *
 *   - `metadata` holds a compact envelope: an IPFS CID plus the handful of facts
 *     the board needs to render cards and run filters without a network hop.
 *   - The full posting (markdown body, responsibilities, hiring process, ...)
 *     lives in a JSON document on IPFS, fetched only when a job page is opened.
 *   - `description` stops being a truncated posting and becomes the short hook
 *     shown on cards, in OG previews, and in the Discord ping.
 *
 * Everything here tolerates the two shapes already in the table: `''`, and the
 * legacy `{ compensation, location }` object the card used to read.
 */

export const JOB_METADATA_VERSION = 1

/**
 * The `/jobs` index stays a Citizen perk, but an individual role is publicly
 * readable so a link shared on X isn't a dead end behind a blur overlay. Flip
 * this to `false` to gate single roles the same way the index is gated.
 */
export const JOB_DETAIL_PUBLIC = true

export const MAX_METADATA_BYTES = 1024
export const MAX_SUMMARY_CHARS = 280
export const MAX_ENVELOPE_SKILLS = 8

export type JobCompensationPeriod = 'hour' | 'week' | 'month' | 'year' | 'project'

export type JobCompensation = {
  min?: number
  max?: number
  currency?: string
  period?: JobCompensationPeriod
  /** Free-text override; wins over min/max when an author types their own wording. */
  display?: string
  /** How it is paid, e.g. "fiat and/or $MOONEY". */
  paidIn?: string
  notes?: string
}

export type JobLocationType = 'remote' | 'hybrid' | 'onsite'

export type JobLocation = {
  type?: JobLocationType
  region?: string
  timezones?: string
}

export type JobCommitmentType =
  | 'full-time'
  | 'part-time'
  | 'contract'
  | 'internship'
  | 'bounty'
  | 'volunteer'

export type JobCommitment = {
  type?: JobCommitmentType
  hoursPerWeek?: number
  duration?: string
  startDate?: string
}

export type JobProcessStep = {
  label: string
  detail?: string
}

export type JobLink = {
  label: string
  url: string
}

/** The full posting, stored as JSON on IPFS. */
export type JobPostingDoc = {
  v: number
  summary?: string
  body?: string
  responsibilities?: string[]
  requirements?: string[]
  niceToHave?: string[]
  successCriteria?: string[]
  whatWeOffer?: string[]
  applicationRequirements?: string[]
  hiringProcess?: JobProcessStep[]
  skills?: string[]
  links?: JobLink[]
  compensation?: JobCompensation
  location?: JobLocation
  commitment?: JobCommitment
  level?: string
  applicationDeadline?: number
  applyUrl?: string
}

/** The compact pointer stored on-chain in the `metadata` column. */
export type JobMetadataEnvelope = {
  v: number
  cid?: string
  compensation?: string
  location?: string
  locationType?: JobLocationType
  commitment?: string
  commitmentType?: JobCommitmentType
  hoursPerWeek?: number
  level?: string
  deadline?: number
  paid?: boolean
  skills?: string[]
}

export const EMPTY_JOB_METADATA: JobMetadataEnvelope = { v: 0 }

export const JOB_CATEGORIES = [
  'Engineering',
  'Design',
  'Marketing',
  'Community',
  'Operations',
  'Research',
  'Governance',
  'Finance',
  'Business Development',
  'Content',
  'Other',
] as const

export const JOB_COMMITMENT_TYPES: { value: JobCommitmentType; label: string }[] = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'bounty', label: 'Bounty' },
  { value: 'volunteer', label: 'Volunteer' },
]

export const JOB_LOCATION_TYPES: { value: JobLocationType; label: string }[] = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
]

export const JOB_COMPENSATION_PERIODS: { value: JobCompensationPeriod; label: string }[] = [
  { value: 'hour', label: 'per hour' },
  { value: 'week', label: 'per week' },
  { value: 'month', label: 'per month' },
  { value: 'year', label: 'per year' },
  { value: 'project', label: 'per project' },
]

const PERIOD_LABELS: Record<JobCompensationPeriod, string> = {
  hour: '/ hour',
  week: '/ week',
  month: '/ month',
  year: '/ year',
  project: 'per project',
}

const COMMITMENT_LABELS: Record<JobCommitmentType, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  bounty: 'Bounty',
  volunteer: 'Volunteer',
}

const LOCATION_LABELS: Record<JobLocationType, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}

function isPlainObject(value: any): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function cleanStringArray(value: any, limit?: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
  if (!items.length) return undefined
  return limit ? items.slice(0, limit) : items
}

function cleanNumber(value: any): number | undefined {
  const num = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value
  return typeof num === 'number' && Number.isFinite(num) ? num : undefined
}

function cleanString(value: any): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/** Drop `undefined`, `''` and empty arrays so the serialized envelope stays small. */
function compact<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    if (isPlainObject(value) && Object.keys(compact(value)).length === 0) continue
    out[key] = isPlainObject(value) ? compact(value) : value
  }
  return out as Partial<T>
}

export function formatCompensation(compensation?: JobCompensation): string | undefined {
  if (!compensation) return undefined
  if (compensation.display) return compensation.display

  const { min, max, period } = compensation
  if (min === undefined && max === undefined) return undefined

  const currency = compensation.currency || 'USD'
  const symbol = currency === 'USD' ? '$' : ''
  const amount = (value: number) => `${symbol}${value.toLocaleString('en-US')}`

  const range =
    min !== undefined && max !== undefined && min !== max
      ? `${amount(min)}–${amount(max)}`
      : amount((min ?? max) as number)

  const suffix = period ? ` ${PERIOD_LABELS[period]}` : ''
  const currencyLabel = symbol ? '' : ` ${currency}`
  return `${range}${currencyLabel}${suffix}`.trim()
}

export function formatLocation(location?: JobLocation): string | undefined {
  if (!location) return undefined
  const parts: string[] = []
  if (location.type) parts.push(LOCATION_LABELS[location.type])
  if (location.region) parts.push(location.region)
  if (!parts.length) return undefined
  return parts.join(' · ')
}

export function formatCommitment(commitment?: JobCommitment): string | undefined {
  if (!commitment) return undefined
  const parts: string[] = []
  if (commitment.type) parts.push(COMMITMENT_LABELS[commitment.type])
  if (commitment.hoursPerWeek) parts.push(`≤${commitment.hoursPerWeek} hrs/week`)
  if (!parts.length) return undefined
  return parts.join(' · ')
}

export function commitmentTypeLabel(type?: JobCommitmentType): string | undefined {
  return type ? COMMITMENT_LABELS[type] : undefined
}

export function locationTypeLabel(type?: JobLocationType): string | undefined {
  return type ? LOCATION_LABELS[type] : undefined
}

export function isPaidRole(compensation?: JobCompensation): boolean | undefined {
  if (!compensation) return undefined
  if (compensation.min !== undefined || compensation.max !== undefined) return true
  return compensation.display ? true : undefined
}

/**
 * Parse the on-chain `metadata` column. Accepts a JSON string, an already-parsed
 * object (Tableland's HTTP/SDK validators return TEXT JSON as an object — the
 * same way citizen `location` comes back), the legacy `{ compensation, location }`
 * shape, and anything unrecognizable (which degrades to "no metadata" rather
 * than throwing on a job page).
 */
export function parseJobMetadata(raw?: unknown): JobMetadataEnvelope {
  if (raw == null || raw === '') return EMPTY_JOB_METADATA

  let parsed: any
  if (typeof raw === 'string') {
    if (raw.trim() === '') return EMPTY_JOB_METADATA
    try {
      parsed = JSON.parse(raw)
    } catch {
      return EMPTY_JOB_METADATA
    }
  } else if (isPlainObject(raw)) {
    parsed = raw
  } else {
    return EMPTY_JOB_METADATA
  }
  if (!isPlainObject(parsed)) return EMPTY_JOB_METADATA

  const envelope: JobMetadataEnvelope = {
    v: cleanNumber(parsed.v) ?? 0,
    cid: cleanString(parsed.cid),
    compensation: cleanString(parsed.compensation),
    location: cleanString(parsed.location),
    locationType: JOB_LOCATION_TYPES.some((t) => t.value === parsed.locationType)
      ? parsed.locationType
      : undefined,
    commitment: cleanString(parsed.commitment),
    commitmentType: JOB_COMMITMENT_TYPES.some((t) => t.value === parsed.commitmentType)
      ? parsed.commitmentType
      : undefined,
    hoursPerWeek: cleanNumber(parsed.hoursPerWeek),
    level: cleanString(parsed.level),
    deadline: cleanNumber(parsed.deadline),
    paid: typeof parsed.paid === 'boolean' ? parsed.paid : undefined,
    skills: cleanStringArray(parsed.skills, MAX_ENVELOPE_SKILLS),
  }

  return compact(envelope) as JobMetadataEnvelope
}

/**
 * Serialize an envelope for the `metadata` column, shedding the most droppable
 * fields until it fits the 1024-byte budget the rest of the app assumes. Long
 * content belongs in the IPFS document, so nothing important is lost here.
 */
export function serializeJobMetadata(envelope: JobMetadataEnvelope): string {
  const shedOrder: (keyof JobMetadataEnvelope)[] = [
    'skills',
    'level',
    'commitment',
    'location',
    'compensation',
  ]

  let candidate: Record<string, any> = compact({
    ...envelope,
    v: envelope.v || JOB_METADATA_VERSION,
  })

  for (const field of shedOrder) {
    if (bytesOfString(JSON.stringify(candidate)) <= MAX_METADATA_BYTES) break
    const { [field as string]: _dropped, ...rest } = candidate
    candidate = rest
  }

  const serialized = JSON.stringify(candidate)
  return bytesOfString(serialized) <= MAX_METADATA_BYTES
    ? serialized
    : JSON.stringify({ v: candidate.v, cid: candidate.cid })
}

/** Derive the on-chain envelope from a full posting document plus its IPFS CID. */
export function buildJobMetadata(doc: JobPostingDoc, cid?: string): JobMetadataEnvelope {
  return compact({
    v: JOB_METADATA_VERSION,
    cid,
    compensation: formatCompensation(doc.compensation),
    location: formatLocation(doc.location),
    locationType: doc.location?.type,
    commitment: formatCommitment(doc.commitment),
    commitmentType: doc.commitment?.type,
    hoursPerWeek: doc.commitment?.hoursPerWeek,
    level: doc.level,
    deadline: doc.applicationDeadline,
    paid: isPaidRole(doc.compensation),
    skills: cleanStringArray(doc.skills, MAX_ENVELOPE_SKILLS),
  }) as JobMetadataEnvelope
}

/**
 * The authoring doc for a role is easy to paste whole: a structured-fields
 * table, a `## Body (markdown)` heading, then the public posting, then internal
 * notes. The live page only wants the public posting. This pulls that out and
 * leaves a normal markdown body untouched.
 */
const BODY_SECTION_HEADING = /^#{1,3}\s+body(?:\s*\(.*\))?\s*$/i
const INTERNAL_NOTES_HEADING = /^#{1,3}\s+notes on what changed\b/i
const TABLE_ROW = /^\s*\|.+\|\s*$/
const AUTHORING_TABLE_FIELD =
  /^\s*\|\s*(Title|Category|Summary|Compensation|Commitment|Location|Seniority|Application deadline|Apply URL|Skills)\s*\|/i

export function extractPublicJobBody(markdown: string): string {
  if (!markdown || !markdown.trim()) return ''

  const lines = markdown.replace(/\r\n/g, '\n').split('\n')

  let start = 0
  for (let i = 0; i < lines.length; i++) {
    if (BODY_SECTION_HEADING.test(lines[i].trim())) {
      start = i + 1
      break
    }
  }

  let end = lines.length
  for (let i = start; i < lines.length; i++) {
    if (INTERNAL_NOTES_HEADING.test(lines[i].trim())) {
      end = i
      break
    }
  }

  return stripLeadingAuthoringTable(lines.slice(start, end).join('\n'))
}

function stripLeadingAuthoringTable(markdown: string): string {
  const lines = markdown.split('\n')
  let i = 0
  while (i < lines.length && lines[i].trim() === '') i++
  if (i >= lines.length || !TABLE_ROW.test(lines[i])) return markdown.trim()

  const tableStart = i
  while (i < lines.length && (TABLE_ROW.test(lines[i]) || lines[i].trim() === '')) {
    if (lines[i].trim() === '' && i + 1 < lines.length && !TABLE_ROW.test(lines[i + 1])) break
    i++
  }

  const tableBlock = lines.slice(tableStart, i).join('\n')
  const fieldHits = tableBlock.split('\n').filter((line) => AUTHORING_TABLE_FIELD.test(line))
  if (fieldHits.length < 2) return markdown.trim()

  while (i < lines.length && (/^\s*-{3,}\s*$/.test(lines[i]) || lines[i].trim() === '')) i++
  return lines.slice(i).join('\n').trim()
}

/** Normalize an IPFS document, discarding anything that isn't the expected shape. */
export function normalizeJobPostingDoc(raw: any): JobPostingDoc | null {
  if (!isPlainObject(raw)) return null

  const compensation = isPlainObject(raw.compensation)
    ? (compact({
        min: cleanNumber(raw.compensation.min),
        max: cleanNumber(raw.compensation.max),
        currency: cleanString(raw.compensation.currency),
        period: cleanString(raw.compensation.period) as JobCompensationPeriod | undefined,
        display: cleanString(raw.compensation.display),
        paidIn: cleanString(raw.compensation.paidIn),
        notes: cleanString(raw.compensation.notes),
      }) as JobCompensation)
    : undefined

  const location = isPlainObject(raw.location)
    ? (compact({
        type: cleanString(raw.location.type) as JobLocationType | undefined,
        region: cleanString(raw.location.region),
        timezones: cleanString(raw.location.timezones),
      }) as JobLocation)
    : undefined

  const commitment = isPlainObject(raw.commitment)
    ? (compact({
        type: cleanString(raw.commitment.type) as JobCommitmentType | undefined,
        hoursPerWeek: cleanNumber(raw.commitment.hoursPerWeek),
        duration: cleanString(raw.commitment.duration),
        startDate: cleanString(raw.commitment.startDate),
      }) as JobCommitment)
    : undefined

  const hiringProcess = Array.isArray(raw.hiringProcess)
    ? raw.hiringProcess
        .filter((step: any) => isPlainObject(step) && cleanString(step.label))
        .map((step: any) => compact({ label: step.label.trim(), detail: cleanString(step.detail) }))
    : undefined

  const links = Array.isArray(raw.links)
    ? raw.links
        .filter((link: any) => isPlainObject(link) && cleanString(link.url))
        .map((link: any) =>
          compact({ label: cleanString(link.label) || link.url.trim(), url: link.url.trim() })
        )
    : undefined

  const doc = compact({
    v: cleanNumber(raw.v) ?? JOB_METADATA_VERSION,
    summary: cleanString(raw.summary),
    body:
      typeof raw.body === 'string' && raw.body.trim() !== ''
        ? extractPublicJobBody(raw.body) || undefined
        : undefined,
    responsibilities: cleanStringArray(raw.responsibilities),
    requirements: cleanStringArray(raw.requirements),
    niceToHave: cleanStringArray(raw.niceToHave),
    successCriteria: cleanStringArray(raw.successCriteria),
    whatWeOffer: cleanStringArray(raw.whatWeOffer),
    applicationRequirements: cleanStringArray(raw.applicationRequirements),
    hiringProcess: hiringProcess?.length ? hiringProcess : undefined,
    skills: cleanStringArray(raw.skills),
    links: links?.length ? links : undefined,
    compensation,
    location,
    commitment,
    level: cleanString(raw.level),
    applicationDeadline: cleanNumber(raw.applicationDeadline),
    applyUrl: cleanString(raw.applyUrl),
  }) as JobPostingDoc

  const hasContent = Object.keys(doc).some((key) => key !== 'v')
  return hasContent ? doc : null
}

/** True when a posting carries more than the four original fields. */
export function isRichPosting(envelope: JobMetadataEnvelope, doc?: JobPostingDoc | null): boolean {
  if (doc) return true
  return Boolean(envelope.cid || envelope.compensation || envelope.location || envelope.commitment)
}

export function getJobHref(job: { id: number | string }): string {
  return `/jobs/${job.id}`
}

export function getJobShareUrl(job: { id: number | string }): string {
  return `${DEPLOYED_ORIGIN}${getJobHref(job)}`
}

/** The date applications close: an explicit deadline, else the listing's expiry. */
export function getApplicationDeadline(
  envelope: JobMetadataEnvelope,
  endTime?: number
): number | undefined {
  if (envelope.deadline) return envelope.deadline
  return endTime && endTime > 0 ? endTime : undefined
}

/**
 * Whole local calendar days between now and a deadline. Authors pick a calendar
 * date (stored as local midnight), so comparing local day indexes rather than
 * UTC day numbers keeps the badge aligned with the date input in every timezone.
 */
export function daysUntil(timestamp?: number, now = Math.floor(Date.now() / 1000)): number | null {
  if (!timestamp || timestamp <= 0) return null
  const localDayIndex = (unix: number) => {
    const date = new Date(unix * 1000)
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
  }
  return localDayIndex(timestamp) - localDayIndex(now)
}

export function formatDeadlineCountdown(
  timestamp?: number,
  now = Math.floor(Date.now() / 1000)
): string | null {
  const days = daysUntil(timestamp, now)
  if (days === null) return null
  if (days < 0) return 'Closed'
  if (days === 0) return 'Closes today'
  if (days === 1) return 'Closes tomorrow'
  return `Closes in ${days} days`
}

export function formatPostedAt(timestamp?: number, now = Math.floor(Date.now() / 1000)): string {
  if (!timestamp || timestamp <= 0) return ''
  const days = Math.floor((now - timestamp) / 86400)
  if (days <= 0) return 'Posted today'
  if (days === 1) return 'Posted yesterday'
  if (days < 30) return `Posted ${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? 'Posted 1 month ago' : `Posted ${months} months ago`
}

export function formatDate(timestamp?: number): string | null {
  if (!timestamp || timestamp <= 0) return null
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
