import type { UpdateMeta } from './types'

/**
 * The newsletter archive at news.moondao.com (a Kit creator profile) is the
 * source of truth for which newsletter issues exist. These helpers read it so
 * `/news` and `/updates` list the same things, and read each issue's body from
 * the Kit API so it can be rendered on-site at `/updates/<slug>`. No
 * filesystem access here: the committed snapshot is passed in by the caller,
 * so this module is safe to import from tests and scripts.
 */

export const NEWSLETTER_ORIGIN = 'https://news.moondao.com'
/** Set by `next build` while pages are generated. */
export const PRODUCTION_BUILD_PHASE = 'phase-production-build'
export const NEWSLETTER_CATEGORY = 'Newsletter'
export const NEWSLETTER_AUTHOR = 'MoonDAO'

const POSTS_ENDPOINT = `${NEWSLETTER_ORIGIN}/profile/fetch-posts`
const KIT_API = 'https://api.kit.com/v4'
const PAGE_SIZE = 10
const MAX_PAGES = 60
// One budget for the whole archive. A per-page timeout can add up past the
// 60s Next.js allows for getStaticProps, which fails the build before the
// snapshot fallback gets a chance to run.
const REQUEST_TIMEOUT_MS = 12000
const DESCRIPTION_MAX_CHARS = 220

// Image hosts the site's Content-Security-Policy allows (see `img-src` in
// next.config.js). An image anywhere else would be blocked in the browser and
// leave an empty box, so it is left out of the card or the issue body.
// `api.filekitcdn.com` serves the videos Kit hosts and their poster frames.
const IMAGE_HOSTS = new Set([
  'embed.filekitcdn.com',
  'api.filekitcdn.com',
  'pbs.twimg.com',
  'img.youtube.com',
  'images.lumacdn.com',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'cdn.shopify.com',
])

/** True for an https URL on a host the site's CSP allows images from. */
export function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && IMAGE_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

/** The fields of a Kit post this site uses. Everything else is dropped. */
export type NewsletterPost = {
  slug: string
  title: string
  /** `YYYY-MM-DD`, in UTC. */
  date: string
  description: string
  image: string | null
  url: string
  readingMinutes: number
  /** The Kit broadcast ID, used to read the issue's body from the Kit API. */
  kitId: number | null
}

type KitPostResponse = {
  posts?: unknown
  hasMore?: unknown
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function youtubeThumbnail(playbuttonUrl: string): string | null {
  try {
    const target = new URL(playbuttonUrl).searchParams.get('thumbnailof')
    const id = target?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
  } catch {
    return null
  }
}

export function normalizeThumbnail(raw: unknown): string | null {
  const value = asString(raw)
  if (!value.startsWith('https://')) return null

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  // Kit renders a YouTube link as a "play button" image that wraps the video's
  // own thumbnail; use the thumbnail directly.
  if (url.pathname.includes('playbutton')) return youtubeThumbnail(value)

  // Kit sometimes appends `/email`, which serves an email-sized variant that
  // does not load on the web.
  const cleaned = value.replace(/\/email$/, '')
  return IMAGE_HOSTS.has(url.hostname) ? cleaned : null
}

export function summarize(intro: unknown): string {
  const text = asString(intro)
    // Kit stores the email's greeting as the first words of the intro.
    .replace(/^\s*(?:hey|hello|hi)\s+(?:reader|there|moondao|friend)s?\s*[,!:.-]*\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*(?:\.{3}|…)\s*$/, '')
    .trim()

  if (text.length <= DESCRIPTION_MAX_CHARS) {
    return text
  }
  const cut = text.slice(0, DESCRIPTION_MAX_CHARS)
  const lastSpace = cut.lastIndexOf(' ')
  const clipped = lastSpace > DESCRIPTION_MAX_CHARS * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${clipped.replace(/[\s,;:.-]+$/, '')}…`
}

/** Maps one raw Kit post, or returns null if it is unusable or not public. */
export function normalizeKitPost(raw: unknown): NewsletterPost | null {
  if (!raw || typeof raw !== 'object') return null
  const post = raw as Record<string, unknown>

  const slug = asString(post.slug)
  const title = asString(post.title).trim()
  const publishedAt = asString(post.publishedAt)
  const date = /^\d{4}-\d{2}-\d{2}/.test(publishedAt) ? publishedAt.slice(0, 10) : ''
  if (!slug || !title || !date) return null
  if (post.status !== 'published' || post.isPaid === true) return null

  const reading = Number(post.readingTime)
  const kitId = Number(post.campaignId)
  return {
    slug,
    title,
    date,
    description: summarize(post.introContent),
    image: normalizeThumbnail(post.thumbnailUrl),
    url: asString(post.url) || `${NEWSLETTER_ORIGIN}/posts/${slug}`,
    readingMinutes: Number.isFinite(reading) && reading > 0 ? Math.round(reading) : 1,
    kitId: Number.isInteger(kitId) && kitId > 0 ? kitId : null,
  }
}

export function normalizeKitPosts(raw: unknown[]): NewsletterPost[] {
  const seen = new Set<string>()
  const posts: NewsletterPost[] = []
  for (const entry of raw) {
    const post = normalizeKitPost(entry)
    if (post && !seen.has(post.slug)) {
      seen.add(post.slug)
      posts.push(post)
    }
  }
  return posts
}

/**
 * The production build serves the committed snapshot and does not call the
 * archive. A hung request there is killed as a failed deploy, before any
 * fallback can run. The hourly refresh reads the archive live.
 */
export function readsLiveArchive(phase: string | undefined = process.env.NEXT_PHASE): boolean {
  return phase !== PRODUCTION_BUILD_PHASE
}

/**
 * Reads every public issue from the archive, newest first. Throws if the
 * archive cannot be read, so callers decide on a fallback.
 */
export async function fetchNewsletterPosts(
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<NewsletterPost[]> {
  const raw: unknown[] = []
  const signal = AbortSignal.timeout(timeoutMs)

  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetchImpl(`${POSTS_ENDPOINT}?page=${page}&perPage=${PAGE_SIZE}`, {
      headers: { Accept: 'application/json' },
      signal,
    })
    if (!response.ok) {
      throw new Error(`Newsletter archive returned ${response.status} for page ${page}`)
    }
    const body = (await response.json()) as KitPostResponse
    if (!Array.isArray(body.posts)) {
      throw new Error(`Newsletter archive page ${page} has no posts array`)
    }
    raw.push(...body.posts)
    if (body.hasMore !== true || body.posts.length === 0) break
  }

  const posts = normalizeKitPosts(raw)
  if (posts.length === 0) throw new Error('Newsletter archive returned no public posts')
  return posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/** Fits an issue into the shape the Updates cards already render. */
export function newsletterToUpdateMeta(post: NewsletterPost): UpdateMeta {
  return {
    slug: post.slug,
    filePath: `kit:${post.slug}`,
    title: post.title,
    description: post.description,
    date: post.date,
    author: NEWSLETTER_AUTHOR,
    authorRole: null,
    image: post.image,
    imageAlt: null,
    imageCaption: null,
    category: NEWSLETTER_CATEGORY,
    tags: [],
    featured: false,
    draft: false,
    readingMinutes: post.readingMinutes,
    externalUrl: null,
    source: 'newsletter',
    newsletter: null,
  }
}

/**
 * The issues that get a page and a card of their own. An issue is left out
 * when an Updates post has the same slug, or names the issue in its
 * `newsletter:` frontmatter because it was sent as that issue.
 */
export function standaloneIssues(
  updates: Pick<UpdateMeta, 'slug' | 'newsletter'>[],
  newsletter: NewsletterPost[]
): NewsletterPost[] {
  const covered = new Set<string>()
  for (const update of updates) {
    covered.add(update.slug)
    if (update.newsletter) covered.add(update.newsletter)
  }
  return newsletter.filter((post) => !covered.has(post.slug))
}

/**
 * One list, newest first, of Updates posts and newsletter issues. An Updates
 * post wins a same-day tie so the longer piece leads.
 */
export function mergeFeed(updates: UpdateMeta[], newsletter: NewsletterPost[]): UpdateMeta[] {
  const issues = standaloneIssues(updates, newsletter).map(newsletterToUpdateMeta)
  const rank = (entry: UpdateMeta) => (entry.source === 'newsletter' ? 1 : 0)

  // `sort` is stable, and `newsletter` arrives newest first, so two issues
  // from the same day keep the order they were sent.
  return [...updates, ...issues].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return rank(a) - rank(b)
  })
}

/** The fields of a Kit broadcast this site reads. */
export type KitBroadcast = {
  id: number
  subject: string
  content: string
  public: boolean
  publicUrl: string | null
  thumbnailUrl: string | null
}

function toKitBroadcast(raw: unknown): KitBroadcast | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  const id = Number(b.id)
  if (!Number.isInteger(id)) return null
  return {
    id,
    subject: asString(b.subject),
    content: asString(b.content),
    public: b.public === true,
    publicUrl: asString(b.public_url) || null,
    thumbnailUrl: asString(b.thumbnail_url) || null,
  }
}

/** The slug of an issue at news.moondao.com/posts/<slug>. */
export function slugFromPublicUrl(publicUrl: string | null): string | null {
  return publicUrl?.match(/\/posts\/([^/?#]+)/)?.[1] ?? null
}

async function kitGet(
  pathAndQuery: string,
  apiKey: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(`${KIT_API}${pathAndQuery}`, {
    headers: { Accept: 'application/json', 'X-Kit-Api-Key': apiKey },
    signal,
  })
  if (!response.ok) throw new Error(`Kit API returned ${response.status} for ${pathAndQuery}`)
  return (await response.json()) as Record<string, unknown>
}

/** Reads one broadcast, body included. */
export async function fetchKitBroadcast(
  id: number,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<KitBroadcast> {
  const body = await kitGet(`/broadcasts/${id}`, apiKey, fetchImpl, AbortSignal.timeout(timeoutMs))
  const broadcast = toKitBroadcast(body.broadcast)
  if (!broadcast) throw new Error(`Kit API returned no broadcast ${id}`)
  return broadcast
}

/** Reads every broadcast with its body, 100 per request. */
export async function fetchKitBroadcasts(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = 60000
): Promise<KitBroadcast[]> {
  const signal = AbortSignal.timeout(timeoutMs)
  const broadcasts: KitBroadcast[] = []
  let after: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = `/broadcasts?per_page=100&include=content${
      after ? `&after=${encodeURIComponent(after)}` : ''
    }`
    const body = await kitGet(query, apiKey, fetchImpl, signal)
    const list = Array.isArray(body.broadcasts) ? body.broadcasts : []
    for (const raw of list) {
      const broadcast = toKitBroadcast(raw)
      if (broadcast) broadcasts.push(broadcast)
    }
    const pagination = (body.pagination || {}) as Record<string, unknown>
    after = pagination.has_next_page === true ? asString(pagination.end_cursor) || null : null
    if (!after) break
  }
  return broadcasts
}

/** The Kit API key, if this environment has one. */
export function kitApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  // The older CONVERT_KIT_API_KEY is a v3 key, which the v4 API rejects.
  return env.CONVERT_KIT_V4_API_KEY || null
}
