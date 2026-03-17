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
  const twoYearsAgo = new Date(now)
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

  return broadcasts
    .filter((broadcast) => {
      if (!broadcast?.public) return false

      const publishedDate =
        broadcast?.published_at || broadcast?.send_at || broadcast?.created_at
      if (!publishedDate) return false

      return new Date(publishedDate) >= twoYearsAgo
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

      const url = broadcast?.public_url
        ? normalizeNewsletterUrl(broadcast.public_url) || broadcast.public_url
        : null

      return {
        id: broadcast?.id?.toString() || Math.random().toString(),
        title: broadcast?.subject || 'Newsletter Update',
        description: broadcast?.description || broadcast?.preview_text || null,
        publishedAt: publishedDate,
        views: broadcast?.total_recipients || null,
        image: broadcast?.thumbnail_url || null,
        url: url || 'https://news.moondao.com/posts',
        stats: broadcast?.stats || {},
        isArchived: new Date(publishedDate) < new Date('2024-01-01'),
        isPublic: true,
      }
    })
}
