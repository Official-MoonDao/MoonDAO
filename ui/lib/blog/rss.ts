import type { BlogPostMeta } from './types'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildRssXml(posts: BlogPostMeta[], origin: string = 'https://moondao.com'): string {
  const base = origin.replace(/\/$/, '')
  const items = posts
    .map((post) => {
      const url = `${base}/blog/${post.slug}`
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid>${escapeXml(url)}</guid>
      <pubDate>${new Date(`${post.date}T00:00:00.000Z`).toUTCString()}</pubDate>
      <description>${escapeXml(post.description)}</description>
      <author>${escapeXml(post.author)}</author>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>MoonDAO Blog</title>
    <link>${escapeXml(`${base}/blog`)}</link>
    <description>Long-form updates and essays from the Internet's Space Program.</description>
    <language>en-us</language>
${items}
  </channel>
</rss>
`
}
