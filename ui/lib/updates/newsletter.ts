import type { UpdateMeta } from './types'

/**
 * The newsletter archive at news.moondao.com (a Kit creator profile) is the
 * source of truth for newsletter issues. These helpers read it so `/news` and
 * `/updates` list the same things. No filesystem access here: the committed
 * snapshot is passed in by the caller, so this module is safe to import from
 * tests and scripts.
 */

export const NEWSLETTER_ORIGIN = 'https://news.moondao.com'
export const NEWSLETTER_CATEGORY = 'Newsletter'
export const NEWSLETTER_AUTHOR = 'MoonDAO'

const POSTS_ENDPOINT = `${NEWSLETTER_ORIGIN}/profile/fetch-posts`
const PAGE_SIZE = 10
const MAX_PAGES = 60
const REQUEST_TIMEOUT_MS = 8000
const DESCRIPTION_MAX_CHARS = 220

// Image hosts the site's Content-Security-Policy allows (see `img-src` in
// next.config.js). A thumbnail anywhere else would be blocked in the browser
// and leave an empty box, so those issues are listed without an image.
const IMAGE_HOSTS = new Set([
  'embed.filekitcdn.com',
  'pbs.twimg.com',
  'img.youtube.com',
  'images.lumacdn.com',
  'cdn.discordapp.com',
  'media.discordapp.net',
])

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
  return {
    slug,
    title,
    date,
    description: summarize(post.introContent),
    image: normalizeThumbnail(post.thumbnailUrl),
    url: asString(post.url) || `${NEWSLETTER_ORIGIN}/posts/${slug}`,
    readingMinutes: Number.isFinite(reading) && reading > 0 ? Math.round(reading) : 1,
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
 * Reads every public issue from the archive, newest first. Throws if the
 * archive cannot be read, so callers decide on a fallback.
 */
export async function fetchNewsletterPosts(
  fetchImpl: typeof fetch = fetch
): Promise<NewsletterPost[]> {
  const raw: unknown[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetchImpl(`${POSTS_ENDPOINT}?page=${page}&perPage=${PAGE_SIZE}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
    slug: `newsletter-${post.slug}`,
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
    externalUrl: post.url,
  }
}

/**
 * One list, newest first, of Updates posts and newsletter issues. An Updates
 * post wins a same-day tie so the longer piece leads.
 */
export function mergeFeed(updates: UpdateMeta[], newsletter: NewsletterPost[]): UpdateMeta[] {
  const issues = newsletter.map(newsletterToUpdateMeta)
  const rank = (entry: UpdateMeta) => (entry.externalUrl ? 1 : 0)

  // `sort` is stable, and `newsletter` arrives newest first, so two issues
  // from the same day keep the order they were sent.
  return [...updates, ...issues].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return rank(a) - rank(b)
  })
}
