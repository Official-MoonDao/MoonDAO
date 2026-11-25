/**
 * Server-only. Import from `getStaticProps` / scripts, never from a component.
 *
 * Newsletter issues render at `/updates/<slug>` like an Updates post. Their
 * bodies come from the Kit API, converted to markdown by `kitHtmlToMarkdown`.
 * `yarn sync:newsletter` commits one file per issue to `content/newsletter/`,
 * so the production build needs no network. An issue sent after the last sync
 * is converted on first request instead.
 */
import fs from 'fs'
import path from 'path'
import { kitHtmlToMarkdown } from './kitHtml'
import { fetchKitBroadcast, kitApiKey, newsletterToUpdateMeta } from './newsletter'
import type { KitBroadcast, NewsletterPost } from './newsletter'
import type { Update } from './types'

export const NEWSLETTER_ROOT = path.join(process.cwd(), 'content', 'newsletter')

/** Slugs Kit generates: lowercase words joined by hyphens. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * A synced file that starts with this line was fixed by hand, and
 * `yarn sync:newsletter` leaves it alone.
 */
export const EDITED_MARKER = '<!-- edited: keep this file when syncing -->'

export function isNewsletterSlug(slug: string): boolean {
  return slug.length <= 160 && SLUG_RE.test(slug)
}

export function newsletterBodyPath(slug: string, root: string = NEWSLETTER_ROOT): string {
  return path.join(root, `${slug}.md`)
}

/** The committed body of an issue, or null when it has not been synced. */
export function readNewsletterBody(slug: string, root: string = NEWSLETTER_ROOT): string | null {
  if (!isNewsletterSlug(slug)) return null
  const file = newsletterBodyPath(slug, root)
  if (!fs.existsSync(file)) return null
  return fs.readFileSync(file, 'utf8').replace(EDITED_MARKER, '').trim()
}

export function isHandEdited(slug: string, root: string = NEWSLETTER_ROOT): boolean {
  const file = newsletterBodyPath(slug, root)
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8').startsWith(EDITED_MARKER)
}

export function listNewsletterBodySlugs(root: string = NEWSLETTER_ROOT): Set<string> {
  if (!fs.existsSync(root)) return new Set()
  return new Set(
    fs
      .readdirSync(root)
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.slice(0, -3))
  )
}

export function broadcastToMarkdown(broadcast: KitBroadcast, post: NewsletterPost): string {
  return kitHtmlToMarkdown(broadcast.content, {
    title: post.title,
    heroImage: broadcast.thumbnailUrl || post.image,
  })
}

/** The full issue, from its committed body or, failing that, the Kit API. */
export async function loadNewsletterIssue(
  post: NewsletterPost,
  options: { root?: string; fetchImpl?: typeof fetch } = {}
): Promise<Update | null> {
  let body = readNewsletterBody(post.slug, options.root)
  if (!body) {
    const apiKey = kitApiKey()
    if (!apiKey || !post.kitId) return null
    const broadcast = await fetchKitBroadcast(post.kitId, apiKey, options.fetchImpl)
    // The archive lists only public issues; the API also returns the rest.
    if (!broadcast.public) return null
    body = broadcastToMarkdown(broadcast, post).trim()
  }
  if (!body) return null
  return { ...newsletterToUpdateMeta(post), body }
}
