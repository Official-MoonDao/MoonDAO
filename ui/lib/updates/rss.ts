import type { UpdateMeta } from './types'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildRssXml(updates: UpdateMeta[], origin: string = 'https://moondao.com'): string {
  const base = origin.replace(/\/$/, '')
  const items = updates
    .map((update) => {
      const url = `${base}/updates/${update.slug}`
      return `    <item>
      <title>${escapeXml(update.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid>${escapeXml(url)}</guid>
      <pubDate>${new Date(`${update.date}T00:00:00.000Z`).toUTCString()}</pubDate>
      <category>${escapeXml(update.category)}</category>
      <description>${escapeXml(update.description)}</description>
      <author>${escapeXml(update.author)}</author>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>MoonDAO Updates</title>
    <link>${escapeXml(`${base}/updates`)}</link>
    <description>Announcements, updates, and long-form essays from the Internet's Space Program.</description>
    <language>en-us</language>
${items}
  </channel>
</rss>
`
}
