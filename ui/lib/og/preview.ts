import { DEPLOYED_ORIGIN } from 'const/config'
import {
  JobMetadataEnvelope,
  JobPostingDoc,
  formatCommitment,
  formatCompensation,
  formatLocation,
} from '@/lib/jobs/jobMetadata'
import { formatListingPrice } from '@/lib/marketplace/listing'
import type { TeamListing } from '@/components/subscription/TeamListing'

export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

export const OG_FIELD_LIMITS = {
  title: 80,
  team: 48,
  location: 40,
  compensation: 40,
  commitment: 36,
  tag: 28,
  price: 32,
  image: 80,
  summary: 280,
} as const

/** CIDv0 (`Qm…`) or a typical CIDv1 (`bafy…`) — anything else is rejected as an image src. */
const CID_RE = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{20,})$/i

export type JobOgFields = {
  title: string
  team?: string
  location?: string
  compensation?: string
  commitment?: string
  tag?: string
}

export type ListingOgFields = {
  title: string
  team?: string
  price?: string
  image?: string
}

export type DiscordEmbed = {
  title?: string
  description?: string
  url?: string
  color?: number
  image?: { url: string }
  footer?: { text: string }
  author?: { name: string }
}

const JOB_EMBED_COLOR = 0x2563eb
const LISTING_EMBED_COLOR = 0x7c3aed

export function clip(value: string | undefined | null, max: number): string {
  if (!value) return ''
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}

/**
 * Accept an `ipfs://` URI, a gateway URL, or a bare CID. Rejects anything that
 * is not a CID so the OG route never fetches an arbitrary host.
 */
export function extractIpfsCid(image?: string | null): string {
  if (!image) return ''
  const trimmed = image.trim()
  if (!trimmed) return ''

  let candidate = trimmed
  if (trimmed.startsWith('ipfs://')) {
    candidate = trimmed.slice('ipfs://'.length)
  } else if (trimmed.includes('/ipfs/')) {
    candidate = trimmed.split('/ipfs/')[1] || ''
  } else if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  ) {
    return ''
  }

  const cid = candidate.split(/[/?#]/)[0]
  return CID_RE.test(cid) ? cid : ''
}

function compactParams(
  fields: Record<string, string | undefined>,
  limits: Record<string, number>
): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(fields)) {
    const clipped = clip(value, limits[key] ?? 40)
    if (clipped) params.set(key, clipped)
  }
  return params
}

/**
 * Apex `moondao.com` 307s to `www.moondao.com`. Twitter, Slack and iMessage
 * often abandon `og:image` on that redirect and show an empty loading card.
 */
export function previewOrigin(origin = DEPLOYED_ORIGIN): string {
  return origin === 'https://moondao.com' ? 'https://www.moondao.com' : origin
}

export function buildJobOgImageUrl(fields: JobOgFields): string {
  const params = compactParams(
    {
      title: fields.title,
      team: fields.team,
      location: fields.location,
      compensation: fields.compensation,
      commitment: fields.commitment,
      tag: fields.tag,
    },
    OG_FIELD_LIMITS
  )
  return `${previewOrigin()}/api/og/job?${params.toString()}`
}

export function buildListingOgImageUrl(fields: ListingOgFields): string {
  const params = compactParams(
    {
      title: fields.title,
      team: fields.team,
      price: fields.price,
      image: extractIpfsCid(fields.image),
    },
    OG_FIELD_LIMITS
  )
  return `${previewOrigin()}/api/og/listing?${params.toString()}`
}

export function parseJobOgParams(searchParams: URLSearchParams): JobOgFields {
  return {
    title: clip(searchParams.get('title'), OG_FIELD_LIMITS.title) || 'Open Role',
    team: clip(searchParams.get('team'), OG_FIELD_LIMITS.team) || undefined,
    location: clip(searchParams.get('location'), OG_FIELD_LIMITS.location) || undefined,
    compensation: clip(searchParams.get('compensation'), OG_FIELD_LIMITS.compensation) || undefined,
    commitment: clip(searchParams.get('commitment'), OG_FIELD_LIMITS.commitment) || undefined,
    tag: clip(searchParams.get('tag'), OG_FIELD_LIMITS.tag) || undefined,
  }
}

export function parseListingOgParams(searchParams: URLSearchParams): ListingOgFields {
  return {
    title: clip(searchParams.get('title'), OG_FIELD_LIMITS.title) || 'Marketplace Listing',
    team: clip(searchParams.get('team'), OG_FIELD_LIMITS.team) || undefined,
    price: clip(searchParams.get('price'), OG_FIELD_LIMITS.price) || undefined,
    image: extractIpfsCid(searchParams.get('image')),
  }
}

export function jobOgFieldsFrom({
  job,
  envelope,
  doc,
  teamName,
}: {
  job: { title?: string; tag?: string }
  envelope?: JobMetadataEnvelope | null
  doc?: JobPostingDoc | null
  teamName?: string
}): JobOgFields {
  return {
    title: job.title || 'Open Role',
    team: teamName,
    location: formatLocation(doc?.location) || envelope?.location,
    compensation: formatCompensation(doc?.compensation) || envelope?.compensation,
    commitment: formatCommitment(doc?.commitment) || envelope?.commitment,
    tag: job.tag,
  }
}

export function listingOgFieldsFrom(
  listing: Pick<TeamListing, 'title' | 'price' | 'currency' | 'tag' | 'image' | 'teamName'>,
  teamName?: string
): ListingOgFields {
  const price = formatListingPrice(listing, true)
  return {
    title: listing.title || 'Marketplace Listing',
    team: teamName || listing.teamName,
    price: price.display,
    image: listing.image,
  }
}

export function jobDiscordEmbed({
  fields,
  summary,
  url,
  teamName,
}: {
  fields: JobOgFields
  summary?: string
  url: string
  teamName?: string
}): DiscordEmbed {
  return {
    title: clip(fields.title, 256),
    description: clip(summary, OG_FIELD_LIMITS.summary) || undefined,
    url,
    color: JOB_EMBED_COLOR,
    image: { url: buildJobOgImageUrl(fields) },
    footer: { text: 'MoonDAO Jobs' },
    author: teamName ? { name: teamName } : undefined,
  }
}

export function listingDiscordEmbed({
  fields,
  summary,
  url,
  teamName,
}: {
  fields: ListingOgFields
  summary?: string
  url: string
  teamName?: string
}): DiscordEmbed {
  return {
    title: clip(fields.title, 256),
    description: clip(summary, OG_FIELD_LIMITS.summary) || undefined,
    url,
    color: LISTING_EMBED_COLOR,
    image: { url: buildListingOgImageUrl(fields) },
    footer: { text: 'MoonDAO Marketplace' },
    author: teamName ? { name: teamName } : undefined,
  }
}

const ALLOWED_EMBED_URL_PREFIX = 'https://'

/** Keep only the fields Discord needs so the send route never forwards arbitrary JSON. */
export function sanitizeDiscordEmbeds(embeds: unknown): DiscordEmbed[] | undefined {
  if (!Array.isArray(embeds)) return undefined

  const cleaned = embeds.slice(0, 2).map((entry) => {
    if (!entry || typeof entry !== 'object') return null
    const embed = entry as Record<string, any>
    const imageUrl =
      typeof embed.image?.url === 'string' && embed.image.url.startsWith(ALLOWED_EMBED_URL_PREFIX)
        ? embed.image.url
        : undefined
    const url =
      typeof embed.url === 'string' && embed.url.startsWith(ALLOWED_EMBED_URL_PREFIX)
        ? embed.url
        : undefined

    const next: DiscordEmbed = {
      title: typeof embed.title === 'string' ? clip(embed.title, 256) : undefined,
      description:
        typeof embed.description === 'string' ? clip(embed.description, 4096) : undefined,
      url,
      color:
        typeof embed.color === 'number' && Number.isFinite(embed.color) ? embed.color : undefined,
      image: imageUrl ? { url: imageUrl } : undefined,
      footer:
        typeof embed.footer?.text === 'string' ? { text: clip(embed.footer.text, 256) } : undefined,
      author:
        typeof embed.author?.name === 'string' ? { name: clip(embed.author.name, 256) } : undefined,
    }

    return next.title || next.description || next.image ? next : null
  })

  const kept = cleaned.filter((embed): embed is DiscordEmbed => embed !== null)
  return kept.length ? kept : undefined
}
