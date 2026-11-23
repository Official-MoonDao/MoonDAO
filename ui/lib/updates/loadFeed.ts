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
  try {
    return await fetchNewsletterPosts()
  } catch (error) {
    console.warn('[updates] newsletter archive unavailable, using snapshot:', error)
    return snapshot as NewsletterPost[]
  }
}

/** The one list behind both `/news` and `/updates`. */
export async function loadFeedProps(): Promise<FeedProps> {
  const updates = listUpdates()
  const entries = mergeFeed(updates, await loadNewsletterPosts())
  // The featured slot is for a long-form Updates post, never a newsletter issue.
  const featured = entries.find((entry) => entry.featured && !entry.externalUrl) ?? null
  return { entries, featured }
}
