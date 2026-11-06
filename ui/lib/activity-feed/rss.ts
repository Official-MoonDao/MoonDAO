import type { UpdateMeta } from '@/lib/updates/types'

export type FeedCategory =
  | 'Citizen'
  | 'Team'
  | 'Job'
  | 'Marketplace'
  | 'Contribution'
  | 'Town Hall'
  | 'Update'

// One RSS item. `guid` must never change for the same piece of activity:
// feed readers and Kit's RSS-to-email use it to tell new items from ones
// they've already sent.
export type FeedItem = {
  guid: string
  title: string
  // Absolute URL
  link: string
  pubDate: Date
  category: FeedCategory
  // Plain text; HTML-escaped when the feed is built
  summary?: string
  // Plain-text bullet points shown under the summary
  lines?: string[]
  // Absolute https:// URL
  image?: string
}

export const SITE_ORIGIN = 'https://moondao.com'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function absoluteUrl(href: string, origin: string = SITE_ORIGIN): string {
  if (/^https?:\/\//.test(href)) return href
  return `${origin.replace(/\/$/, '')}/${href.replace(/^\//, '')}`
}

export function feedItemsFromUpdates(
  updates: UpdateMeta[],
  origin: string = SITE_ORIGIN
): FeedItem[] {
  return updates.map((update) => {
    const link = absoluteUrl(`/updates/${update.slug}`, origin)
    return {
      // Matches the guid the old static feed used, so readers don't see the
      // existing posts as new.
      guid: link,
      title: update.title,
      link,
      pubDate: new Date(`${update.date}T00:00:00.000Z`),
      category: 'Update',
      summary: update.description,
    }
  })
}

// Email clients and Kit render the description as HTML, so it carries the
// image and a call to action; the plain summary alone would be bare text.
function itemHtml(item: FeedItem): string {
  const parts: string[] = []
  if (item.image) {
    parts.push(
      `<p><a href="${escapeXml(item.link)}"><img src="${escapeXml(item.image)}" alt="${escapeXml(
        item.title
      )}" width="120" /></a></p>`
    )
  }
  if (item.summary) parts.push(`<p>${escapeXml(item.summary)}</p>`)
  if (item.lines?.length) {
    parts.push(`<ul>${item.lines.map((line) => `<li>${escapeXml(line)}</li>`).join('')}</ul>`)
  }
  parts.push(`<p><a href="${escapeXml(item.link)}">View on MoonDAO</a></p>`)
  return parts.join('')
}

export function buildActivityRssXml(
  items: FeedItem[],
  opts: { origin?: string; now?: Date } = {}
): string {
  const base = (opts.origin ?? SITE_ORIGIN).replace(/\/$/, '')
  const sorted = [...items].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
  const body = sorted
    .map((item) => {
      const image = item.image
        ? `\n      <media:content url="${escapeXml(item.image)}" medium="image" />`
        : ''
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>
      <pubDate>${item.pubDate.toUTCString()}</pubDate>
      <category>${escapeXml(item.category)}</category>
      <description>${escapeXml(itemHtml(item))}</description>${image}
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>MoonDAO Updates</title>
    <link>${escapeXml(`${base}/updates`)}</link>
    <atom:link href="${escapeXml(
      `${base}/updates/rss.xml`
    )}" rel="self" type="application/rss+xml" />
    <description>New citizens, teams, jobs, marketplace listings, contributions, Town Halls and updates from the Internet's Space Program.</description>
    <language>en-us</language>
    <lastBuildDate>${(opts.now ?? new Date()).toUTCString()}</lastBuildDate>
${body}
  </channel>
</rss>
`
}
