/**
 * Server-only. Import from `getStaticProps` / scripts, never from a component.
 */
import { listUpdates } from './loadUpdates'
import { fetchNewsletterPosts, mergeFeed, readsLiveArchive } from './newsletter'
import type { NewsletterPost } from './newsletter'
import snapshot from './newsletterSnapshot.json'
import type { UpdateMeta } from './types'

export type FeedProps = {
  entries: UpdateMeta[]
  featured: UpdateMeta | null
}

export const FEED_REVALIDATE_SECONDS = 3600

/**
 * The production build uses the committed snapshot and does not call out, so
 * a slow archive cannot fail the deploy. Afterward, the hourly refresh reads
 * the live archive and a new send shows up without a deploy. If that read
 * does not finish, the page keeps the snapshot (`yarn sync:newsletter`
 * refreshes it).
 */
export async function loadNewsletterPosts(): Promise<NewsletterPost[]> {
  if (!readsLiveArchive()) return snapshot as NewsletterPost[]
  // An issue page rendered on demand reads the archive too. One read serves a
  // few minutes of those, so a burst of unknown slugs cannot fan out requests.
  if (liveCache && Date.now() - liveCache.at < LIVE_CACHE_MS) return liveCache.posts
  try {
    const posts = await fetchNewsletterPosts()
    liveCache = { at: Date.now(), posts }
    return posts
  } catch (error) {
    console.warn('[updates] newsletter archive unavailable, using snapshot:', error)
    return snapshot as NewsletterPost[]
  }
}

const LIVE_CACHE_MS = 5 * 60 * 1000
let liveCache: { at: number; posts: NewsletterPost[] } | null = null

/** The one list behind both `/news` and `/updates`. */
export async function loadFeedProps(): Promise<FeedProps> {
  const updates = listUpdates()
  const entries = mergeFeed(updates, await loadNewsletterPosts())
  // The featured slot is for a long-form Updates post, never a newsletter issue.
  const featured = entries.find((entry) => entry.featured && entry.source !== 'newsletter') ?? null
  return { entries, featured }
}
