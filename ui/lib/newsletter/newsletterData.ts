const NEWS_URL = 'https://news.moondao.com/posts'

/** Fallback: fetch newsletters by parsing recentPosts from news.moondao.com page. No API key required. */
export async function fetchNewslettersFromNewsSite(): Promise<any[]> {
  try {
    const res = await fetch('https://news.moondao.com/posts', {
      headers: { 'User-Agent': 'MoonDAO/1.0' },
      next: { revalidate: 300 },
    })
    const html = await res.text()
    // Page assigns __PROPS__ twice; we need the object (has recentPosts), not the string
    const objStart = html.indexOf('window.__PROPS__ = {')
    if (objStart === -1) return []
    const jsonStart = objStart + 'window.__PROPS__ = '.length
    const objEnd = html.indexOf('};', jsonStart)
    if (objEnd === -1) return []
    const jsonStr = html.substring(jsonStart, objEnd + 1)

    let props: any
    try {
      props = JSON.parse(jsonStr)
    } catch {
      return []
    }

    const posts = props?.recentPosts
    if (!Array.isArray(posts) || posts.length === 0) return []

    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

    return posts
      .filter((p: any) => p?.status === 'published' && p?.publishedAt)
      .filter((p: any) => new Date(p.publishedAt) >= fiveYearsAgo)
      .slice(0, 20)
      .map((p: any) => ({
        id: String(p.id ?? Math.random()),
        title: p.title || 'Newsletter Update',
        description: p.introContent || null,
        publishedAt: p.publishedAt,
        views: null,
        image: p.thumbnailUrl || null,
        url: p.url || `${NEWS_URL}/${p.slug || ''}`,
        stats: {},
        readTime: p.readingTime ?? null,
        isArchived: new Date(p.publishedAt) < new Date('2024-01-01'),
        isPublic: true,
      }))
  } catch {
    return []
  }
}

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '')
}

function buildNewsletterUrl(broadcast: any): string {
  const urlFields = [
    'public_url',
    'web_url',
    'preview_url',
    'share_url',
    'permalink',
    'url',
    'link',
  ]
  for (const field of urlFields) {
    const val = broadcast?.[field]
    if (val && typeof val === 'string' && val.includes('http')) {
      const hostname = (val.match(/https?:\/\/([^/]+)/)?.[1] || '').replace(
        /^www\./,
        ''
      )
      if (hostname.includes('moondao.com') || hostname.includes('kit.com')) {
        return val.includes('news.moondao.com')
          ? val
          : val.replace(/^https?:\/\/[^/]+/, 'https://news.moondao.com')
      }
      return val
    }
  }
  if (broadcast?.subject) {
    const slug = titleToSlug(broadcast.subject)
    if (slug) return `https://news.moondao.com/posts/${slug}`
  }
  return NEWS_URL
}

/** Server-side fetch of newsletters from Kit/ConvertKit API. Returns [] on failure. */
export async function fetchNewslettersFromKit(): Promise<any[]> {
  const v4Key = process.env.CONVERT_KIT_V4_API_KEY
  const v3Key =
    process.env.CONVERT_KIT_API_SECRET || process.env.CONVERT_KIT_API_KEY

  if (!v4Key && !v3Key) return fetchNewslettersFromNewsSite()

  let allBroadcasts: any[] = []

  // Try V4 first (Kit is current platform)
  if (v4Key) {
    for (const endpoint of [
      'https://api.kit.com/v4/broadcasts',
      'https://api.convertkit.com/v4/broadcasts',
    ]) {
      try {
        const res = await fetch(`${endpoint}?per_page=100`, {
          headers: { 'Content-Type': 'application/json', 'X-Kit-Api-Key': v4Key },
        })
        const body = await res.json().catch(() => ({}))
        if (res.ok && body.broadcasts && Array.isArray(body.broadcasts)) {
          allBroadcasts = body.broadcasts
          break
        }
      } catch {
        /* continue */
      }
      if (allBroadcasts.length > 0) break
    }
  }

  // Fallback to V3
  if (allBroadcasts.length === 0 && v3Key) {
    for (const base of [
      'https://api.kit.com/v3/broadcasts',
      'https://api.convertkit.com/v3/broadcasts',
    ]) {
      for (const param of ['api_secret', 'api_key']) {
        try {
          const res = await fetch(
            `${base}?${param}=${encodeURIComponent(v3Key)}&page=1&sort_order=desc`,
            { headers: { 'Content-Type': 'application/json' } }
          )
          const body = await res.json().catch(() => ({}))
          if (res.ok && body.broadcasts && Array.isArray(body.broadcasts)) {
            allBroadcasts = body.broadcasts.map((b: any) => ({
              ...b,
              published_at: b.published_at ?? b.send_at,
              public_url:
                b.public_url ??
                (b.subject
                  ? `https://news.moondao.com/posts/${titleToSlug(b.subject)}`
                  : null),
            }))
            break
          }
        } catch {
          /* continue */
        }
        if (allBroadcasts.length > 0) break
      }
      if (allBroadcasts.length > 0) break
    }
  }

  if (allBroadcasts.length === 0) {
    return fetchNewslettersFromNewsSite()
  }

  const fiveYearsAgo = new Date()
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

  const filtered = allBroadcasts
    .filter((b) => {
      const sent = b?.published_at || b?.send_at
      if (!sent) return false
      return new Date(sent) >= fiveYearsAgo
    })
    .sort((a, b) => {
      const dA = new Date(a.published_at || a.send_at || a.created_at || 0).getTime()
      const dB = new Date(b.published_at || b.send_at || b.created_at || 0).getTime()
      return dB - dA
    })
    .slice(0, 20)

  return filtered.map((b) => {
    const published = b.published_at || b.send_at || b.created_at
    return {
      id: b?.id?.toString() || Math.random().toString(),
      title: b?.subject || 'Newsletter Update',
      description: b?.description || b?.preview_text || null,
      publishedAt: published,
      views: b?.total_recipients || null,
      image: b?.thumbnail_url || null,
      url: buildNewsletterUrl(b),
      stats: b?.stats || {},
      isArchived: new Date(published) < new Date('2024-01-01'),
      isPublic: true,
    }
  })
}

function normalizeNewsletterUrl(rawUrl: string): string | null {
  try {
    const parsedUrl = new URL(rawUrl)
    const hostname = parsedUrl.hostname.replace(/^www\./, '')

    if (
      (hostname === 'news.moondao.com' || hostname === 'moondao.kit.com') &&
      /^\/posts\/[^/]+/.test(parsedUrl.pathname)
    ) {
      return `https://news.moondao.com${parsedUrl.pathname}`
    }

    return null
  } catch {
    return null
  }
}

export function getRecentPublicNewsletters(
  broadcasts: any[] = [],
  now = new Date()
) {
  const fiveYearsAgo = new Date(now)
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

  return broadcasts
    .filter((broadcast) => {
      // Filter by published_at or send_at only - drafts have null for both
      const sentDate =
        broadcast?.published_at || broadcast?.send_at
      if (!sentDate) return false

      return new Date(sentDate) >= fiveYearsAgo
    })
    .sort((a, b) => {
      const dateA = new Date(
        a.published_at || a.send_at || a.created_at || 0
      ).getTime()
      const dateB = new Date(
        b.published_at || b.send_at || b.created_at || 0
      ).getTime()
      return dateB - dateA
    })
    .slice(0, 20)
    .map((broadcast) => {
      const publishedDate =
        broadcast?.published_at || broadcast?.send_at || broadcast?.created_at

      let url = broadcast?.public_url
        ? normalizeNewsletterUrl(broadcast.public_url) || broadcast.public_url
        : null
      if (!url) url = buildNewsletterUrl(broadcast)

      return {
        id: broadcast?.id?.toString() || Math.random().toString(),
        title: broadcast?.subject || 'Newsletter Update',
        description: broadcast?.description || broadcast?.preview_text || null,
        publishedAt: publishedDate,
        views: broadcast?.total_recipients || null,
        image: broadcast?.thumbnail_url || null,
        url,
        stats: broadcast?.stats || {},
        isArchived: new Date(publishedDate) < new Date('2024-01-01'),
        isPublic: true,
      }
    })
}
