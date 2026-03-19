import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'

const emptyResponse = (res: NextApiResponse) =>
  res.status(200).json({ newsletters: [], total: 0, source: null })

/** Extract a short teaser from HTML content (strips tags, decodes entities, truncates) */
function extractTeaserFromHtml(html: string, maxLen: number): string | null {
  if (!html || typeof html !== 'string') return null
  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Decode common HTML entities
  text = text
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
  if (!text || text.length < 20) return null
  if (text.length <= maxLen) return text
  const truncated = text.slice(0, maxLen)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > maxLen * 0.6 ? truncated.slice(0, lastSpace) : truncated) + '…'
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const CONVERTKIT_API_KEY =
      process.env.CONVERT_KIT_V4_API_KEY || process.env.CONVERT_KIT_API_KEY
    // Try v3 API first (uses api_secret - many accounts have v3 key, v4 returns 401 for v3 keys)
    const v3ApiSecret =
      process.env.CONVERT_KIT_API_SECRET || process.env.CONVERT_KIT_API_KEY

    // Allow proceeding if either a v4/v3 API key or a v3 API secret is configured
    if (!CONVERTKIT_API_KEY && !v3ApiSecret) {
      console.log('[newsletters] API key/secret not found')
      return emptyResponse(res)
    }

    let allBroadcasts: any[] = []
    let source = 'convertkit'

    if (v3ApiSecret) {
      try {
        const v3Url = `https://api.convertkit.com/v3/broadcasts?page=1&sort_order=desc&api_secret=${encodeURIComponent(v3ApiSecret)}`
        const v3Response = await fetch(v3Url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
        const v3Body = await v3Response.json().catch(() => ({}))
        if (v3Response.ok && v3Body.broadcasts && Array.isArray(v3Body.broadcasts)) {
          if (v3Body.broadcasts.length > 0) {
            console.log(`[newsletters] Fetched ${v3Body.broadcasts.length} broadcasts from v3 API`)
          }
          allBroadcasts = v3Body.broadcasts
          source = 'convertkit_v3'
        } else {
          const errMsg = v3Body?.errors?.[0] || v3Body?.message || v3Body?.error || ''
          console.warn('[newsletters] v3 API failed:', v3Response.status, errMsg)
        }
      } catch (err) {
        console.warn('[newsletters] v3 API error:', err)
      }
    }

    // Fallback: try v4 API if v3 returned nothing (v4 uses X-Kit-Api-Key header)
    if (allBroadcasts.length === 0) {
      const v4Endpoints = [
        'https://api.kit.com/v4/broadcasts',
        'https://api.convertkit.com/v4/broadcasts',
      ]
      for (const endpoint of v4Endpoints) {
        try {
          const url = `${endpoint}?per_page=100`
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Kit-Api-Key': CONVERTKIT_API_KEY,
            },
          })

          const body = await response.json().catch(() => ({}))
          if (response.ok && body.broadcasts && Array.isArray(body.broadcasts)) {
            if (body.broadcasts.length > 0) {
              console.log(`[newsletters] Fetched ${body.broadcasts.length} broadcasts from ${endpoint}`)
            }
            for (const broadcast of body.broadcasts) {
              if (!allBroadcasts.find((b) => b.id === broadcast.id)) {
                allBroadcasts.push(broadcast)
              }
            }
            source = 'convertkit'
            break
          } else {
            const errMsg = body?.errors?.[0] || body?.message || body?.error || ''
            console.warn(`[newsletters] ${endpoint} failed: ${response.status}`, errMsg)
          }
        } catch (err) {
          console.warn(`[newsletters] ${endpoint} error:`, err)
        }
      }
    }

    if (allBroadcasts.length === 0) {
      return emptyResponse(res)
    }

    // For v3, list endpoint may not return public/thumbnail - fetch full details for first N
    if (source === 'convertkit_v3' && v3ApiSecret) {
      const toEnrich = allBroadcasts.slice(0, 30)
      const enriched = await Promise.all(
        toEnrich.map(async (b: any) => {
          try {
            const res = await fetch(
              `https://api.convertkit.com/v3/broadcasts/${b.id}?api_secret=${encodeURIComponent(v3ApiSecret)}`
            )
            const data = await res.json().catch(() => ({}))
            const full = data.broadcast
            if (full) {
              return { ...b, ...full }
            }
            return b
          } catch {
            return b
          }
        })
      )
      allBroadcasts = [...enriched, ...allBroadcasts.slice(30)]
    }

    const publishedBroadcasts = allBroadcasts.filter(
      (broadcast: any) =>
        (broadcast.published_at != null ||
          broadcast.send_at != null ||
          broadcast.created_at != null) &&
        // Only include public newsletters (non-public ones 404 when opened)
        broadcast.public === true
    )

    if (publishedBroadcasts.length === 0) {
      return emptyResponse(res)
    }

    // Sort all broadcasts by date (newest first) - use published_at, send_at, or created_at
    publishedBroadcasts.sort((a: any, b: any) => {
      const dateA = new Date(a.published_at || a.send_at || a.created_at || 0).getTime()
      const dateB = new Date(b.published_at || b.send_at || b.created_at || 0).getTime()
      return dateB - dateA
    })

    // Transform ConvertKit data to our format
    const newsletters =
      publishedBroadcasts.slice(0, 50).map((broadcast: any) => {
        // Function to convert newsletter title to URL slug
        const titleToSlug = (title: string): string => {
          return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
            .replace(/^-+|-+$/g, '')
        }

        // Try multiple URL fields from ConvertKit v4
        let publicUrl = null
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
          if (
            broadcast[field] &&
            typeof broadcast[field] === 'string' &&
            broadcast[field].includes('http')
          ) {
            publicUrl = broadcast[field]
            break
          }
        }

        // If no specific URL found, construct using news.moondao.com pattern
        if (!publicUrl && broadcast.subject) {
          const slug = titleToSlug(broadcast.subject)
          if (slug) {
            publicUrl = `https://news.moondao.com/posts/${slug}`
          }
        }

        // Final fallback to newsletter archive
        if (!publicUrl) {
          publicUrl = 'https://news.moondao.com/posts'
        }

        // Use published_at, send_at, or created_at for date display
        const publishedDate = broadcast.published_at || broadcast.send_at || broadcast.created_at

        // Description/teaser: use API fields first, else extract from HTML content
        let description: string | null =
          broadcast.description || broadcast.preview_text || null
        if (!description && broadcast.content && typeof broadcast.content === 'string') {
          const teaser = extractTeaserFromHtml(broadcast.content, 140)
          if (teaser) description = teaser
        }

        // Resolve image URL - playbutton URLs embed YouTube thumbnails via thumbnailof param
        const rawThumb = broadcast.thumbnail_url
        let imageUrl: string | null = null
        if (rawThumb && typeof rawThumb === 'string' && rawThumb.startsWith('http')) {
          if (rawThumb.includes('playbutton') && rawThumb.includes('thumbnailof=')) {
            try {
              const match = rawThumb.match(/thumbnailof=([^&]+)/)
              const decoded = match ? decodeURIComponent(match[1]) : ''
              const ytMatch = decoded.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
              if (ytMatch) {
                imageUrl = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`
              }
            } catch {
              // ignore parse errors
            }
          } else if (!rawThumb.includes('playbutton') && !rawThumb.includes('functions-js')) {
            imageUrl = rawThumb
          }
        }

        return {
          id: broadcast.id?.toString() || Math.random().toString(),
          title: broadcast.subject || 'Newsletter Update',
          description,
          publishedAt: publishedDate,
          views: broadcast.total_recipients || null,
          image: imageUrl,
          url: publicUrl,
          stats: broadcast.stats || {},
          isArchived: new Date(publishedDate) < new Date('2024-01-01'),
          isPublic: broadcast.public || false,
        }
      }) || []

    // Filter to newsletters from the last 5 years (avoid very stale content)
    const cutoffDate = new Date()
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 5)

    const recentNewsletters = newsletters.filter((newsletter: any) => {
      // Require valid published date
      if (!newsletter.publishedAt) {
        return false
      }

      const publishedDate = new Date(newsletter.publishedAt)
      return publishedDate >= cutoffDate
    })

    // Sort by published date (newest first)
    recentNewsletters.sort((a: any, b: any) => {
      const dateA = new Date(a.publishedAt || 0).getTime()
      const dateB = new Date(b.publishedAt || 0).getTime()
      return dateB - dateA
    })

    const toReturn = recentNewsletters.slice(0, 20)

    res.status(200).json({
      newsletters: toReturn,
      total: toReturn.length,
      source,
    })
  } catch (error) {
    console.error('[newsletters] Error:', error)
    return emptyResponse(res)
  }
}

export default withMiddleware(handler, rateLimit)
